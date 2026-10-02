//! The play gate through the router with Sylphx Money as the only source of
//! access: a paid user plays a Plus-only game and the archive, an unpaid user
//! is refused with `plus_required`, and Money being unreachable locks nothing.
//! Needs `PUZZLED_TEST_DATABASE_URL` (CI sets it).

use std::sync::{Arc, Mutex};

use axum::body::{to_bytes, Body};
use axum::extract::State;
use axum::http::{Method, Request, StatusCode};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde_json::{json, Value};
use tower::ServiceExt;

use crate::capabilities::money::Money;
use crate::test_support::{fresh_database, token};
use crate::{router, AppState};

const PAID: &str = "0b6f7d3e-1111-4a4a-9c9c-0000000000b1";
const UNPAID: &str = "0b6f7d3e-1111-4a4a-9c9c-0000000000b2";
const OUTAGE: &str = "0b6f7d3e-1111-4a4a-9c9c-0000000000b3";

#[derive(Default)]
struct FakeMoney {
    /// Subjects that hold `plus`.
    paid: Vec<String>,
    /// Answer every entitlement check with a 503.
    down: bool,
    /// Answer only the `seats` check with a 503.
    seats_down: bool,
}

type Fake = Arc<Mutex<FakeMoney>>;

async fn check(State(fake): State<Fake>, Json(body): Json<Value>) -> (StatusCode, Json<Value>) {
    let fake = fake.lock().unwrap();
    if fake.down {
        return (StatusCode::SERVICE_UNAVAILABLE, Json(json!({})));
    }
    let subject = body["subject"]["end_user"].as_str().unwrap_or_default();
    if body["feature"] == "seats" {
        if fake.seats_down {
            return (StatusCode::SERVICE_UNAVAILABLE, Json(json!({})));
        }
        return (
            StatusCode::OK,
            Json(json!({"entitled": true, "limit": "4"})),
        );
    }
    let held = fake.paid.iter().any(|p| p == subject);
    let entitled = held && (body["feature"] == "plus" || body["feature"] == "family");
    (StatusCode::OK, Json(json!({"entitled": entitled})))
}

/// One product with `plus` so sales are open.
async fn catalog() -> Json<Value> {
    Json(json!({"spec": {"products": [{
        "key": "solo", "display_name": "Plus",
        "features": {"plus": "true", "seats": "1"},
        "prices": [{"key": "k_m", "recurring_interval": "month", "tax_behavior": "inclusive",
                    "unit_amounts": {"USD": "1100"}}]
    }]}}))
}

async fn spawn_money(fake: Fake) -> Money {
    let app = Router::new()
        .route("/env/entitlement_grants:check", post(check))
        .route("/env/price_catalogs/default", get(catalog))
        .with_state(fake);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    Money::new(
        &format!("http://{addr}/env"),
        "sk_test",
        "https://puzzled.test",
    )
}

async fn get_daily(app: &Router, body: Value, bearer: &str) -> (StatusCode, Value) {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/puzzled.v1.PuzzleService/GetDaily")
                .header("content-type", "application/json")
                .header("authorization", format!("Bearer {bearer}"))
                .body(Body::from(body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status();
    let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    (
        status,
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
    )
}

/// A game that is not today's free one.
fn paid_game() -> &'static str {
    let today = puzzled_core::puzzle_play::daily_time::product_day_key(chrono::Utc::now());
    if puzzled_core::puzzle_play::game_slugs::todays_free_game(today) == "sudoku" {
        "crossword"
    } else {
        "sudoku"
    }
}

fn free_game() -> &'static str {
    let today = puzzled_core::puzzle_play::daily_time::product_day_key(chrono::Utc::now());
    puzzled_core::puzzle_play::game_slugs::todays_free_game(today)
}

fn refused(body: &Value, code: &str) -> bool {
    body["message"].as_str().unwrap_or("").contains(code)
}

#[tokio::test]
async fn money_alone_decides_who_plays_paid_games_and_the_archive() {
    let _key = crate::capabilities::identity_access::adapters::platform_jwt::test_key_lock()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let Some(pool) = fresh_database().await else {
        return;
    };
    let fake: Fake = Arc::default();
    fake.lock().unwrap().paid.push(PAID.to_string());
    let money = spawn_money(fake.clone()).await;
    let app = router(AppState::new(Some(pool)).with_money(Some(money)));
    let archive = json!({"gameSlug": free_game(), "puzzleDate": "2026-01-01"});

    // Paid: a Plus-only game and the archive both open.
    let paid_token = token(PAID);
    let (status, body) = get_daily(&app, json!({"gameSlug": paid_game()}), &paid_token).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let (status, body) = get_daily(&app, archive.clone(), &paid_token).await;
    assert_eq!(status, StatusCode::OK, "{body}");

    // Unpaid: today's free game plays; another game and the archive are refused.
    let unpaid_token = token(UNPAID);
    let (status, _) = get_daily(&app, json!({"gameSlug": free_game()}), &unpaid_token).await;
    assert_eq!(status, StatusCode::OK);
    let (status, body) = get_daily(&app, json!({"gameSlug": paid_game()}), &unpaid_token).await;
    assert_eq!(status, StatusCode::FORBIDDEN, "{body}");
    assert!(refused(&body, "plus_required"), "{body}");
    let (status, body) = get_daily(&app, archive.clone(), &unpaid_token).await;
    assert_eq!(status, StatusCode::FORBIDDEN, "{body}");
    assert!(refused(&body, "plus_required_archive"), "{body}");

    // Money unreachable: it cannot vouch for anyone, so nothing free today is
    // locked (Money's outage never takes content away); the free daily puzzle
    // never reads billing and still plays.
    fake.lock().unwrap().down = true;
    let outage_token = token(OUTAGE);
    let (status, body) = get_daily(&app, json!({"gameSlug": paid_game()}), &outage_token).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let (status, _) = get_daily(&app, json!({"gameSlug": free_game()}), &outage_token).await;
    assert_eq!(status, StatusCode::OK);
}

#[tokio::test]
async fn without_money_nothing_is_sold_and_nothing_is_locked() {
    let _key = crate::capabilities::identity_access::adapters::platform_jwt::test_key_lock()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let Some(pool) = fresh_database().await else {
        return;
    };
    let app = router(AppState::new(Some(pool)));
    let (status, body) = get_daily(&app, json!({"gameSlug": paid_game()}), &token(UNPAID)).await;
    assert_eq!(status, StatusCode::OK, "{body}");
}

async fn call(app: &Router, path: &str, body: Value, bearer: &str) -> (StatusCode, Value) {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri(path)
                .header("content-type", "application/json")
                .header("authorization", format!("Bearer {bearer}"))
                .body(Body::from(body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status();
    let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    (
        status,
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
    )
}

#[tokio::test]
async fn a_family_join_is_refused_and_retryable_when_money_cannot_answer_seats() {
    let _key = crate::capabilities::identity_access::adapters::platform_jwt::test_key_lock()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let Some(pool) = fresh_database().await else {
        return;
    };
    let fake: Fake = Arc::default();
    // PAID owns a family plan; UNPAID and OUTAGE try to join it.
    fake.lock().unwrap().paid.push(PAID.to_string());
    sqlx::query(r#"INSERT INTO "family_groups" ("owner_user_id", "invite_code") VALUES ($1::uuid, 'FAMILYCODE')"#)
        .bind(PAID)
        .execute(&pool)
        .await
        .unwrap();
    let money = spawn_money(fake.clone()).await;
    let app = router(AppState::new(Some(pool)).with_money(Some(money)));
    let join = json!({"inviteCode": "FAMILYCODE"});

    // Seats unanswered: no new member, and the error is the retryable one.
    fake.lock().unwrap().seats_down = true;
    let (status, body) = call(
        &app,
        "/puzzled.v1.BillingService/JoinFamily",
        join.clone(),
        &token(OUTAGE),
    )
    .await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE, "{body}");
    assert!(refused(&body, "seats_unavailable"), "{body}");

    // Seats answered: the same join succeeds, and the member then plays.
    // The failed check is remembered for FAILED_CACHE_TTL; wait it out.
    fake.lock().unwrap().seats_down = false;
    tokio::time::sleep(
        crate::capabilities::money::client::FAILED_CACHE_TTL
            + std::time::Duration::from_millis(300),
    )
    .await;
    let member = token(UNPAID);
    let (status, body) = call(&app, "/puzzled.v1.BillingService/JoinFamily", join, &member).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let (status, body) = get_daily(&app, json!({"gameSlug": paid_game()}), &member).await;
    assert_eq!(status, StatusCode::OK, "{body}");
}

/// WORKAROUND(plus-grace-window): with the window open, an account that
/// finished a puzzle before the open instant plays a Plus game through the
/// real gate; an account without history is still refused; past the end the
/// history account is refused too.
#[tokio::test]
async fn the_grace_window_opens_plus_play_only_for_accounts_with_history() {
    let _key = crate::capabilities::identity_access::adapters::platform_jwt::test_key_lock()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let Some(pool) = fresh_database().await else {
        return;
    };
    const HISTORY: &str = "0b6f7d3e-1111-4a4a-9c9c-0000000000c1";
    const FRESH: &str = "0b6f7d3e-1111-4a4a-9c9c-0000000000c2";
    let open = chrono::Utc::now() - chrono::Duration::days(1);
    let ended_open = chrono::Utc::now() - chrono::Duration::days(31);
    // Both are signed-in accounts (an Auth sign-in writes this row).
    for account in [HISTORY, FRESH] {
        sqlx::query("INSERT INTO auth_subjects (subject, user_id) VALUES ($1, $1::uuid)")
            .bind(account)
            .execute(&pool)
            .await
            .unwrap();
    }
    // History before both windows' open instants.
    for finished in [
        open - chrono::Duration::days(2),
        ended_open - chrono::Duration::days(9),
    ] {
        sqlx::query(
            "INSERT INTO game_sessions (user_id, game_slug, status, started_at, completed_at) \
             VALUES ($1::uuid, 'sudoku', 'won', $2, $2)",
        )
        .bind(HISTORY)
        .bind(finished.naive_utc())
        .execute(&pool)
        .await
        .unwrap();
    }
    let fake: Fake = Arc::default();
    let money = spawn_money(fake).await;
    let window = |open: chrono::DateTime<chrono::Utc>| {
        Some(crate::capabilities::plus_grace::window::GraceWindow::new(
            open,
            30,
            vec![],
        ))
    };
    let app = router(
        AppState::new(Some(pool.clone()))
            .with_money(Some(money.clone()))
            .with_plus_grace(window(open)),
    );
    let paid = json!({"gameSlug": paid_game()});

    let (status, body) = get_daily(&app, paid.clone(), &token(HISTORY)).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let (status, body) = get_daily(&app, paid.clone(), &token(FRESH)).await;
    assert_eq!(status, StatusCode::FORBIDDEN, "{body}");
    assert!(refused(&body, "plus_required"), "{body}");

    // A window that ended: the history account is refused again.
    let ended = router(
        AppState::new(Some(pool))
            .with_money(Some(money))
            .with_plus_grace(window(ended_open)),
    );
    let (status, body) = get_daily(&ended, paid, &token(HISTORY)).await;
    assert_eq!(status, StatusCode::FORBIDDEN, "{body}");
}
