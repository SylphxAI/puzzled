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
        .route("/env/catalogs/default", get(catalog))
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

/// The retire migration refuses to run over data: a billing row means a
/// payment happened, and the whole migration rolls back with nothing renamed.
/// When the tables are empty it renames them and drops nothing.
#[tokio::test]
async fn the_billing_retire_refuses_to_run_over_data() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    // fresh_database has applied every migration, so the tables are already
    // retired: put the original tables back (their DDL, up to the family
    // tables) so the migration meets exactly what production has.
    const TABLES: [&str; 3] = [
        "billing_customers",
        "billing_subscriptions",
        "billing_ledger",
    ];
    let migrations = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../apps/puzzled/atlas/migrations");
    let original =
        std::fs::read_to_string(migrations.join("20260926120000_puzzled_plus_billing.sql"))
            .unwrap();
    let billing_only = &original[..original.find(r#"CREATE TABLE "family_groups""#).unwrap()];
    for table in TABLES {
        sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"DROP TABLE IF EXISTS "{table}__retired_20260929""#
        )))
        .execute(&pool)
        .await
        .unwrap();
    }
    sqlx::raw_sql(sqlx::AssertSqlSafe(billing_only.to_string()))
        .execute(&pool)
        .await
        .unwrap();
    let retire_sql =
        std::fs::read_to_string(migrations.join("20261001020000_retire_billing_tables.sql"))
            .unwrap();
    let exists = |table: String| {
        let pool = pool.clone();
        async move {
            sqlx::query_scalar::<_, bool>("SELECT to_regclass($1) IS NOT NULL")
                .bind(table)
                .fetch_one(&pool)
                .await
                .unwrap()
        }
    };

    sqlx::query(
        r#"INSERT INTO "billing_customers" ("user_id", "stripe_customer_id")
           VALUES ('0b6f7d3e-1111-4a4a-9c9c-0000000000c1'::uuid, 'cus_1')"#,
    )
    .execute(&pool)
    .await
    .unwrap();
    let refused = sqlx::raw_sql(sqlx::AssertSqlSafe(retire_sql.clone()))
        .execute(&pool)
        .await;
    assert!(refused.is_err(), "a row must stop the retire");
    for table in TABLES {
        assert!(
            exists(table.to_string()).await,
            "{table} must survive a refused retire"
        );
        assert!(
            !exists(format!("{table}__retired_20260929")).await,
            "{table} must not be renamed by a refused retire"
        );
    }

    sqlx::query(r#"DELETE FROM "billing_customers""#)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::raw_sql(sqlx::AssertSqlSafe(retire_sql))
        .execute(&pool)
        .await
        .unwrap();
    for table in TABLES {
        assert!(
            !exists(table.to_string()).await,
            "{table} is renamed away when empty"
        );
        assert!(
            exists(format!("{table}__retired_20260929")).await,
            "{table} is kept under its retired name, not dropped"
        );
    }
}
