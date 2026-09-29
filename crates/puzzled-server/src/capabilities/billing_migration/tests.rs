//! The migration against a real Postgres, a fake Money and a fake Stripe.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::routing::get;
use axum::{Form, Json, Router};
use serde_json::{json, Value};
use sqlx::PgPool;

use super::grants::{reason, run_grants, verify, Mailer};
use crate::capabilities::billing::adapters::stripe::Stripe;
use crate::capabilities::money::Money;

const INDIVIDUAL: &str = "0190a0a0-0000-7000-8000-0000000000a1";
const FAMILY: &str = "0190a0a0-0000-7000-8000-0000000000a2";
const ENDED: &str = "0190a0a0-0000-7000-8000-0000000000a3";
const NO_EMAIL: &str = "0190a0a0-0000-7000-8000-0000000000a4";

// ---- fake Money ---------------------------------------------------------------

#[derive(Default)]
struct FakeMoney {
    /// (idempotency key, body) of every create, in order.
    creates: Vec<(String, Value)>,
    /// key -> body of grants that exist.
    grants: HashMap<String, Value>,
    /// Refuse every create with 503 while set.
    down: bool,
}

type MoneyState = Arc<Mutex<FakeMoney>>;

async fn list_grants(State(fake): State<MoneyState>) -> Json<Value> {
    let fake = fake.lock().unwrap();
    Json(json!({"entitlement_grants": fake.grants.values().collect::<Vec<_>>()}))
}

async fn create_grant(
    State(fake): State<MoneyState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> (StatusCode, Json<Value>) {
    let mut fake = fake.lock().unwrap();
    if fake.down {
        return (StatusCode::SERVICE_UNAVAILABLE, Json(json!({})));
    }
    let key = headers["idempotency-key"].to_str().unwrap().to_string();
    // A used key with a different body is Money's 409.
    if let Some(first) = fake.grants.get(&key) {
        if *first != body {
            return (
                StatusCode::CONFLICT,
                Json(json!({"code": "IDEMPOTENCY_KEY_REUSED"})),
            );
        }
    }
    fake.creates.push((key.clone(), body.clone()));
    fake.grants.insert(key, body.clone());
    (StatusCode::OK, Json(body))
}

async fn fake_money() -> (Money, MoneyState) {
    let state: MoneyState = Arc::default();
    let app = Router::new()
        .route(
            "/env/entitlement_grants",
            get(list_grants).post(create_grant),
        )
        .with_state(state.clone());
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    (
        Money::new(
            &format!("http://{addr}/env"),
            "sk_app",
            "https://puzzled.test",
        ),
        state,
    )
}

// ---- fake Stripe --------------------------------------------------------------

#[derive(Default)]
struct FakeStripe {
    /// subscription id -> cancel_at_period_end
    cancelling: HashMap<String, bool>,
    posts: u32,
}

type StripeState = Arc<Mutex<FakeStripe>>;

fn subscription_json(id: &str, cancel: bool) -> Value {
    let plan = if id.contains("fam") {
        "family_monthly"
    } else {
        "individual_monthly"
    };
    json!({
        "id": id, "customer": "cus_1", "status": "active",
        "current_period_end": 4_102_444_800_i64, "start_date": 1_000,
        "cancel_at_period_end": cancel,
        "items": {"data": [{"price": {"lookup_key": format!("puzzled_{plan}")}}]},
        "metadata": {},
    })
}

async fn stripe_get(State(s): State<StripeState>, Path(id): Path<String>) -> Json<Value> {
    let cancel = *s.lock().unwrap().cancelling.get(&id).unwrap_or(&false);
    Json(subscription_json(&id, cancel))
}

async fn stripe_post(
    State(s): State<StripeState>,
    Path(id): Path<String>,
    Form(form): Form<HashMap<String, String>>,
) -> Json<Value> {
    let mut s = s.lock().unwrap();
    s.posts += 1;
    let cancel = form
        .get("cancel_at_period_end")
        .is_some_and(|v| v == "true");
    s.cancelling.insert(id.clone(), cancel);
    Json(subscription_json(&id, cancel))
}

async fn fake_stripe() -> (Stripe, StripeState) {
    let state: StripeState = Arc::default();
    let app = Router::new()
        .route("/v1/subscriptions/{id}", get(stripe_get).post(stripe_post))
        .with_state(state.clone());
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    (
        Stripe::new(
            "sk_test".into(),
            "whsec".into(),
            format!("http://{addr}"),
            "https://puzzled.test".into(),
        ),
        state,
    )
}

// ---- fake mailer ---------------------------------------------------------------

#[derive(Default)]
struct FakeMailer {
    sent: Mutex<Vec<Value>>,
}

impl Mailer for FakeMailer {
    async fn send(&self, delivery: Value) -> Result<(), String> {
        self.sent.lock().unwrap().push(delivery);
        Ok(())
    }
    fn connector(&self) -> Result<String, String> {
        Ok("conn-email".into())
    }
    fn sender(&self) -> String {
        "noreply@puzzled.test".into()
    }
}

// ---- data ------------------------------------------------------------------------

async fn seed(pool: &PgPool) {
    for (sub, user, plan, status, end, email) in [
        (
            "sub_ind_1",
            INDIVIDUAL,
            "individual_monthly",
            "active",
            "2099-01-01",
            Some("a@example.com"),
        ),
        (
            "sub_fam_1",
            FAMILY,
            "family_monthly",
            "trialing",
            "2099-02-01",
            Some("b@example.com"),
        ),
        (
            "sub_old_1",
            ENDED,
            "individual_yearly",
            "canceled",
            "2099-03-01",
            Some("c@example.com"),
        ),
        (
            "sub_ind_2",
            NO_EMAIL,
            "individual_monthly",
            "past_due",
            "2099-04-01",
            None,
        ),
    ] {
        sqlx::query(
            r#"INSERT INTO "billing_subscriptions"
               ("stripe_subscription_id", "user_id", "stripe_customer_id", "plan_id", "status",
                "current_period_end", "cancel_at_period_end", "started_at")
               VALUES ($1, $2::uuid, 'cus_1', $3, $4, $5::timestamp, false, '2026-01-01')"#,
        )
        .bind(sub)
        .bind(user)
        .bind(plan)
        .bind(status)
        .bind(end)
        .execute(pool)
        .await
        .unwrap();
        if let Some(email) = email {
            sqlx::query(
                r#"INSERT INTO "user_display_cache" ("user_id", "email") VALUES ($1::uuid, $2)"#,
            )
            .bind(user)
            .bind(email)
            .execute(pool)
            .await
            .unwrap();
        }
    }
}

#[tokio::test]
async fn grants_cancel_and_email_every_live_row_once_and_a_rerun_does_nothing() {
    let Some(pool) = crate::billing_flow_tests::fresh_database().await else {
        return;
    };
    seed(&pool).await;
    let (money, money_state) = fake_money().await;
    let (stripe, stripe_state) = fake_stripe().await;
    let mailer = FakeMailer::default();

    let first = run_grants(&pool, &stripe, &money, &mailer).await.unwrap();
    // Three live rows (the canceled one is not live).
    assert_eq!(first.live, 3);
    // individual: plus; family: plus + family + seats; individual: plus.
    assert_eq!(first.granted, 5);
    assert_eq!(first.cancelled, 3);
    assert_eq!(first.emailed, 2);
    assert_eq!(first.no_email, 1);
    assert_eq!(first.failed, 0);

    {
        let m = money_state.lock().unwrap();
        // The first key is the old subscription id, and the body is the
        // deterministic one: reason and expire_time come from the row.
        let (_, body) = m.creates.iter().find(|(k, _)| k == "sub_ind_1").unwrap();
        assert_eq!(body["subject"]["end_user"], INDIVIDUAL);
        assert_eq!(body["feature"], "plus");
        assert_eq!(body["reason"], reason("sub_ind_1"));
        assert_eq!(body["reason"], "legacy stripe sub sub_ind_1 migrated");
        assert_eq!(body["expire_time"], "2099-01-01T00:00:00Z");
        let family: Vec<&str> = m
            .creates
            .iter()
            .filter(|(k, _)| k.starts_with("sub_fam_1"))
            .map(|(_, b)| b["feature"].as_str().unwrap())
            .collect();
        assert_eq!(family, ["plus", "family", "seats"]);
        let (_, seats) = m
            .creates
            .iter()
            .find(|(k, _)| k == "sub_fam_1:seats")
            .unwrap();
        assert_eq!(seats["limit"], "4");
    }
    assert_eq!(stripe_state.lock().unwrap().posts, 3);
    let sent = mailer.sent.lock().unwrap().clone();
    assert_eq!(sent.len(), 2);
    let text = sent[0]["intent"]["email"]["message"]["text_body"]
        .as_str()
        .unwrap();
    assert!(text.contains("continues until"));
    assert!(text.contains("nothing changes before then"));
    assert!(text.contains("https://puzzled.test/pricing?plan="));
    assert!(!text.to_lowercase().contains("refund"));
    let mut keys: Vec<&str> = sent
        .iter()
        .map(|d| d["idempotency_key"].as_str().unwrap())
        .collect();
    keys.sort_unstable();
    assert_eq!(
        keys,
        ["plus-migration-sub_fam_1", "plus-migration-sub_ind_1"]
    );

    // The readback is complete.
    let found = verify(&pool, &stripe, &money).await.unwrap();
    assert!(found.complete(), "{found:?}");
    assert_eq!(found.live, 3);

    // A rerun creates nothing, cancels nothing, and the same email keys.
    let creates_before = money_state.lock().unwrap().creates.len();
    let second = run_grants(&pool, &stripe, &money, &mailer).await.unwrap();
    assert_eq!(second.granted, 0);
    assert_eq!(second.already_granted, 5);
    assert_eq!(second.cancelled, 0);
    assert_eq!(second.already_cancelled, 3);
    assert_eq!(money_state.lock().unwrap().creates.len(), creates_before);
    assert_eq!(stripe_state.lock().unwrap().posts, 3);
    let keys: Vec<String> = mailer
        .sent
        .lock()
        .unwrap()
        .iter()
        .map(|d| d["idempotency_key"].as_str().unwrap().to_string())
        .collect();
    assert_eq!(keys[0], keys[2], "the rerun's email carries the same key");
}

#[tokio::test]
async fn a_row_whose_grant_fails_is_not_cancelled_or_emailed() {
    let Some(pool) = crate::billing_flow_tests::fresh_database().await else {
        return;
    };
    seed(&pool).await;
    let (money, money_state) = fake_money().await;
    let (stripe, stripe_state) = fake_stripe().await;
    let mailer = FakeMailer::default();
    money_state.lock().unwrap().down = true;
    let report = run_grants(&pool, &stripe, &money, &mailer).await.unwrap();
    assert_eq!(report.failed, 3);
    assert_eq!(report.cancelled, 0);
    assert_eq!(
        stripe_state.lock().unwrap().posts,
        0,
        "no renewal is stopped without access"
    );
    assert!(mailer.sent.lock().unwrap().is_empty());
    let found = verify(&pool, &stripe, &money).await.unwrap();
    assert!(!found.complete());
    assert_eq!(found.missing_grant, 3);
    assert_eq!(found.still_renewing, 3);
}

#[tokio::test]
async fn zero_live_rows_is_a_no_op() {
    let Some(pool) = crate::billing_flow_tests::fresh_database().await else {
        return;
    };
    let (money, money_state) = fake_money().await;
    let (stripe, stripe_state) = fake_stripe().await;
    let mailer = FakeMailer::default();
    let report = run_grants(&pool, &stripe, &money, &mailer).await.unwrap();
    assert_eq!(report, Default::default());
    assert!(money_state.lock().unwrap().creates.is_empty());
    assert_eq!(stripe_state.lock().unwrap().posts, 0);
    assert!(mailer.sent.lock().unwrap().is_empty());
    let found = verify(&pool, &stripe, &money).await.unwrap();
    assert!(found.complete());
    assert_eq!(found.live, 0);
}

#[tokio::test]
async fn export_writes_every_table_and_reads_it_back() {
    let Some(pool) = crate::billing_flow_tests::fresh_database().await else {
        return;
    };
    seed(&pool).await;
    sqlx::query(r#"INSERT INTO "billing_customers" ("user_id", "stripe_customer_id") VALUES ($1::uuid, 'cus_1')"#)
        .bind(INDIVIDUAL)
        .execute(&pool)
        .await
        .unwrap();
    let dir = std::env::temp_dir().join(format!("puzzled-export-{}", uuid::Uuid::now_v7()));
    let manifest = super::export::run_export(&pool, &dir).await.unwrap();
    let rows = |t: &str| manifest.iter().find(|m| m.table == t).unwrap().rows;
    assert_eq!(rows("billing_subscriptions"), 4);
    assert_eq!(rows("billing_customers"), 1);
    assert_eq!(rows("billing_ledger"), 0);
    super::export::verify_export(&pool, &dir).await.unwrap();
    // A row added after the export is caught by the readback.
    sqlx::query(r#"INSERT INTO "billing_customers" ("user_id", "stripe_customer_id") VALUES ($1::uuid, 'cus_2')"#)
        .bind(FAMILY)
        .execute(&pool)
        .await
        .unwrap();
    assert!(super::export::verify_export(&pool, &dir).await.is_err());
    let _ = std::fs::remove_dir_all(&dir);
}

#[tokio::test]
async fn money_unavailable_at_listing_fails_the_run_before_any_write() {
    let Some(pool) = crate::billing_flow_tests::fresh_database().await else {
        return;
    };
    seed(&pool).await;
    let (stripe, stripe_state) = fake_stripe().await;
    let mailer = FakeMailer::default();
    let gone = Money::new("http://127.0.0.1:1/env", "sk_app", "https://puzzled.test");
    assert!(run_grants(&pool, &stripe, &gone, &mailer).await.is_err());
    assert_eq!(stripe_state.lock().unwrap().posts, 0);
    assert!(mailer.sent.lock().unwrap().is_empty());
}
