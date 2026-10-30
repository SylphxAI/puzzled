//! Durable checkout custody against migrated disposable Postgres. The local
//! Money adapter is deliberately a stub; these are never processor receipts.
use std::sync::{Arc, Mutex};

use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post},
};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::capabilities::money::{Money, attempts, fixtures};
use crate::test_support::fresh_database;

#[derive(Default)]
struct Remote {
    posts: usize,
    session: Option<Value>,
    lost_reply: bool,
}
type Shared = Arc<Mutex<Remote>>;

async fn create(
    State(state): State<Shared>,
    Query(query): Query<std::collections::HashMap<String, String>>,
    headers: axum::http::HeaderMap,
    Json(body): Json<Value>,
) -> (StatusCode, Json<Value>) {
    let mut state = state.lock().unwrap();
    state.posts += 1;
    let id = query.get("checkout_session_id").unwrap();
    assert_eq!(
        headers.get("idempotency-key").unwrap(),
        format!("puzzled-checkout-{id}").as_str()
    );
    let session = json!({"name":format!("env/checkout_sessions/{id}"),"subject":body["subject"],"url":"https://checkout.example/held"});
    state.session = Some(session.clone());
    if state.lost_reply {
        (StatusCode::BAD_GATEWAY, Json(json!({})))
    } else {
        (StatusCode::OK, Json(session))
    }
}
async fn read(State(state): State<Shared>, Path(id): Path<String>) -> (StatusCode, Json<Value>) {
    match state.lock().unwrap().session.clone() {
        Some(session) if session["name"] == format!("env/checkout_sessions/{id}") => {
            (StatusCode::OK, Json(session))
        }
        _ => (StatusCode::NOT_FOUND, Json(json!({}))),
    }
}
async fn remote(state: Shared) -> Money {
    let app = Router::new()
        .route("/env/checkout_sessions", post(create))
        .route("/env/checkout_sessions/{id}", get(read))
        .with_state(state);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });
    Money::new(
        &format!("http://{address}/env"),
        "example-key",
        "https://product.example",
    )
}

#[tokio::test]
async fn concurrent_requests_submit_once_and_a_lost_reply_recovers_the_named_resource() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let shared = Shared::default();
    shared.lock().unwrap().lost_reply = true;
    let money = remote(shared.clone()).await;
    let user = Uuid::now_v7().to_string();
    let request = Uuid::now_v7().to_string();
    let body =
        json!({"subject":{"end_user":user},"line_items":[{"price":"example_once","quantity":"1"}]});
    let mut tasks = Vec::new();
    for _ in 0..12 {
        let (pool, money, user, request, body) = (
            pool.clone(),
            money.clone(),
            user.clone(),
            request.clone(),
            body.clone(),
        );
        tasks.push(tokio::spawn(async move {
            attempts::create(&pool, &money, &user, &request, &body).await
        }));
    }
    for task in tasks {
        let _ = task.await.unwrap();
    }
    assert_eq!(shared.lock().unwrap().posts, 1);
    let held = attempts::get(&pool, &money, &user, Some(&request))
        .await
        .unwrap()
        .unwrap();
    assert_eq!(held.state, "ready");
    let original = shared.lock().unwrap().session.clone().unwrap();
    assert_eq!(held.session.unwrap()["name"], original["name"]);
    // The same request never posts again, even after the upstream window.
    sqlx::query("UPDATE checkout_attempts SET created_at=now()-interval '2 days'")
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(
        attempts::create(&pool, &money, &user, &request, &body)
            .await
            .unwrap()["name"],
        original["name"]
    );
    assert_eq!(shared.lock().unwrap().posts, 1);
    let changed = json!({"subject":{"end_user":user},"line_items":[]});
    assert!(matches!(
        attempts::create(&pool, &money, &user, &request, &changed).await,
        Err(attempts::Error::RequestChanged)
    ));
    assert!(
        attempts::get(&pool, &money, &Uuid::now_v7().to_string(), Some(&request))
            .await
            .unwrap()
            .is_none()
    );
    shared.lock().unwrap().session.as_mut().unwrap()["subject"]["end_user"] = json!(Uuid::now_v7());
    assert!(
        attempts::get(&pool, &money, &user, Some(&request))
            .await
            .is_err()
    );
    assert_eq!(shared.lock().unwrap().posts, 1);
}

#[tokio::test]
async fn a_crash_before_the_network_call_remains_pending_without_replay() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let shared = Shared::default();
    let money = remote(shared.clone()).await;
    let user = Uuid::now_v7();
    let request = Uuid::now_v7();
    let body = json!({"subject":{"end_user":user}});
    sqlx::query("INSERT INTO checkout_attempts (user_id,request_id,money_session_id,request,created_at) VALUES ($1,$2,'chk-held',$3,now()-interval '2 days')")
        .bind(user).bind(request).bind(&body).execute(&pool).await.unwrap();
    let held = attempts::get(&pool, &money, &user.to_string(), Some(&request.to_string()))
        .await
        .unwrap()
        .unwrap();
    assert_eq!(held.state, "pending");
    assert!(matches!(
        attempts::create(
            &pool,
            &money,
            &user.to_string(),
            &request.to_string(),
            &body
        )
        .await,
        Err(attempts::Error::Pending)
    ));
    assert_eq!(shared.lock().unwrap().posts, 0);
}

#[tokio::test]
async fn fixture_registration_is_atomic_idempotent_and_cannot_reclassify_a_player() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let stamp = chrono::Utc::now();
    let (a, b) = tokio::join!(
        fixtures::register_proven(&pool, "example-synthetic", "checkout-owned", stamp),
        fixtures::register_proven(&pool, "example-synthetic", "checkout-owned", stamp)
    );
    assert!(a.is_ok() && b.is_ok());
    let player: Uuid = sqlx::query_scalar(
        "SELECT user_id FROM synthetic_fixtures WHERE fixture_key='checkout-owned'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    let mapped: Uuid =
        sqlx::query_scalar("SELECT user_id FROM auth_subjects WHERE subject='example-synthetic'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(player, mapped);
    assert!(
        fixtures::register_proven(&pool, "other-synthetic", "checkout-owned", stamp)
            .await
            .is_err()
    );
    assert!(
        fixtures::register_proven(&pool, "example-synthetic", "other-key", stamp)
            .await
            .is_err()
    );
    let real = Uuid::now_v7();
    sqlx::query("INSERT INTO auth_subjects(subject,user_id) VALUES ('example-real',$1)")
        .bind(real)
        .execute(&pool)
        .await
        .unwrap();
    assert!(
        fixtures::register_proven(&pool, "example-real", "other-key", stamp)
            .await
            .is_err()
    );
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM synthetic_fixtures")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 1);
    let unchanged: Uuid =
        sqlx::query_scalar("SELECT user_id FROM auth_subjects WHERE subject='example-real'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(real, unchanged);
    crate::capabilities::funnel::record_signup(&pool, &player.to_string())
        .await
        .unwrap();
    crate::capabilities::metrics::audience(&pool, &player.to_string(), true).await;
    let observed: i64 = sqlx::query_scalar("SELECT (SELECT count(*) FROM funnel_signup_receipts)+(SELECT count(*) FROM metric_audiences)").fetch_one(&pool).await.unwrap();
    assert_eq!(observed, 0);
}

#[tokio::test]
async fn registered_synthetic_activity_is_excluded_from_canonical_and_product_reports() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let now = chrono::Utc::now();
    fixtures::register_proven(&pool, "example-synthetic", "checkout-owned", now)
        .await
        .unwrap();
    let fixture: Uuid = sqlx::query_scalar("SELECT user_id FROM synthetic_fixtures")
        .fetch_one(&pool)
        .await
        .unwrap();
    let player = Uuid::now_v7();
    sqlx::query("INSERT INTO auth_subjects(subject,user_id) VALUES ('example-player',$1)")
        .bind(player)
        .execute(&pool)
        .await
        .unwrap();
    let day = puzzled_core::puzzle_play::daily_time::product_day_key(now).to_string();
    for uid in [fixture, player] {
        sqlx::query("INSERT INTO game_sessions(user_id,game_slug,day_key,is_ritual,module_class,status,started_at,completed_at) VALUES ($1,'sudoku',$2,true,'puzzle_ritual','won',$3,$3)")
            .bind(uid).bind(&day).bind(now.naive_utc()).execute(&pool).await.unwrap();
        crate::capabilities::metrics::audience(&pool, &uid.to_string(), true).await;
    }
    let counts: (chrono::DateTime<chrono::Utc>, i64, i64, i64, i64) =
        sqlx::query_as("SELECT * FROM desk_report.activity_summary($1)")
            .bind(now + chrono::Duration::minutes(1))
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!((counts.1, counts.2, counts.3, counts.4), (1, 1, 1, 1));
    crate::capabilities::metrics::rollup(&pool, now)
        .await
        .unwrap();
    let report: Value = sqlx::query_scalar("SELECT report FROM metric_days WHERE day_key=$1")
        .bind(day)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(report["daily_puzzle_completers"], 1);
    assert_eq!(report["signed_in_completers"], 1);
    assert_eq!(report["paid_active"], 1);
    assert_eq!(report["paid_completers"], 1);
}
