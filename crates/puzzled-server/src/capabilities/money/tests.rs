//! Money client, entitlement, checkout and pricing against a fake Money.

use std::sync::{Arc, Mutex};
use std::time::Duration;

use axum::extract::State;
use axum::http::StatusCode;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde_json::{json, Value};

use super::access::{
    family_active, is_premium, seats, FEATURE_FAMILY, FEATURE_PLUS, FEATURE_SEATS,
};
use super::checkout::{create_session, session_body, CheckoutError, Consent};
use super::client::{Catalog, Money};
use super::pricing::{plan, plans};

const USER: &str = "0190a0a0-0000-7000-8000-000000000001";

#[derive(Default)]
struct FakeMoney {
    status: u16,
    answer: Value,
    checks: Vec<Value>,
    sessions: Vec<Value>,
    catalog: Value,
}

type Fake = Arc<Mutex<FakeMoney>>;

async fn check(State(fake): State<Fake>, Json(body): Json<Value>) -> (StatusCode, Json<Value>) {
    let mut fake = fake.lock().unwrap();
    fake.checks.push(body);
    (
        StatusCode::from_u16(fake.status).unwrap(),
        Json(fake.answer.clone()),
    )
}

async fn session(State(fake): State<Fake>, Json(body): Json<Value>) -> Json<Value> {
    fake.lock().unwrap().sessions.push(body);
    Json(json!({"url": "https://checkout.example/pay/cs_1", "state": "open"}))
}

async fn subscriptions(State(fake): State<Fake>) -> (StatusCode, Json<Value>) {
    let fake = fake.lock().unwrap();
    (
        StatusCode::from_u16(fake.status).unwrap(),
        Json(fake.answer.clone()),
    )
}

async fn catalog(State(fake): State<Fake>) -> Json<Value> {
    Json(fake.lock().unwrap().catalog.clone())
}

/// A Money whose answer is `answer` with HTTP `status`.
async fn fake_money(status: u16, answer: Value) -> (Money, Fake) {
    let fake: Fake = Arc::new(Mutex::new(FakeMoney {
        status,
        answer,
        catalog: catalog_fixture(&[]),
        ..Default::default()
    }));
    let app = Router::new()
        .route("/env/entitlement_grants:check", post(check))
        .route("/env/checkout_sessions", post(session))
        .route("/env/catalogs/default", get(catalog))
        .route("/env/customer_subscriptions", get(subscriptions))
        .with_state(fake.clone());
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    (
        Money::new(
            &format!("http://{addr}/env"),
            "sk_test",
            "https://puzzled.test",
        ),
        fake,
    )
}

/// Money's catalogue: keys and amounts are arbitrary on purpose, so nothing in
/// the code can depend on them. `archived` lists price keys Money archived.
fn catalog_fixture(archived: &[&str]) -> Value {
    let price = |key: &str, interval: &str, usd: i64| {
        json!({
            "key": key, "recurring_interval": interval, "tax_behavior": "inclusive",
            "archived": archived.contains(&key),
            "unit_amounts": {"USD": usd.to_string(), "GBP": (usd - 100).to_string()},
        })
    };
    json!({"spec": {"products": [
        {"key": "fam", "display_name": "Family",
         "features": {"plus": "true", "family": "true", "seats": "4"},
         "prices": [price("k_fam_y", "year", 6100), price("k_fam_m", "month", 1200)]},
        {"key": "solo", "display_name": "Plus",
         "features": {"plus": "true", "seats": "1"},
         "prices": [price("k_solo_m", "month", 1100), price("k_solo_y", "year", 5100)]},
        {"key": "other", "display_name": "Not Plus", "features": {"pro": "true"},
         "prices": [price("k_other_m", "month", 9900)]}
    ]}})
}

fn parsed(value: Value) -> Catalog {
    serde_json::from_value(value).unwrap()
}

fn granted() -> Value {
    json!({"entitled": true, "entitlement_grant": "g1"})
}

// ---- entitlement -----------------------------------------------------------

#[tokio::test]
async fn granted_check_makes_the_account_premium() {
    let (money, fake) = fake_money(200, granted()).await;
    assert!(is_premium(&money, USER).await);
    let sent = fake.lock().unwrap().checks[0].clone();
    assert_eq!(sent["subject"]["end_user"], USER);
    assert_eq!(sent["feature"], FEATURE_PLUS);
}

#[tokio::test]
async fn denied_check_is_not_premium() {
    let (money, _) = fake_money(200, json!({"entitled": false})).await;
    assert!(!is_premium(&money, USER).await);
    assert!(!family_active(&money, USER).await);
}

#[tokio::test]
async fn money_unavailable_fails_closed() {
    let (money, _) = fake_money(503, json!({"title": "down"})).await;
    assert!(!is_premium(&money, USER).await);
    let (money, _) = fake_money(200, json!("not an object")).await;
    assert!(!is_premium(&money, USER).await);
    // Nothing listens here at all.
    let gone = Money::new("http://127.0.0.1:1/env", "sk_test", "https://puzzled.test");
    assert!(!is_premium(&gone, USER).await);
}

#[tokio::test]
async fn answers_are_cached_and_a_failure_is_not() {
    let (money, fake) = fake_money(200, granted()).await;
    assert!(is_premium(&money, USER).await);
    assert!(is_premium(&money, USER).await);
    assert_eq!(
        fake.lock().unwrap().checks.len(),
        1,
        "second read is cached"
    );
    // A different feature or subject is a different answer.
    assert!(family_active(&money, USER).await);
    assert_eq!(fake.lock().unwrap().checks.len(), 2);
    // A failed call is never cached: the next read asks again.
    let (money, fake) = fake_money(503, json!({})).await;
    assert!(!is_premium(&money, USER).await);
    assert!(!is_premium(&money, USER).await);
    assert_eq!(fake.lock().unwrap().checks.len(), 2);
}

#[tokio::test]
async fn cache_never_runs_past_expire_time() {
    let ends = chrono::Utc::now() + chrono::Duration::milliseconds(1200);
    let (money, fake) = fake_money(
        200,
        json!({"entitled": true, "expire_time": ends.to_rfc3339()}),
    )
    .await;
    assert!(is_premium(&money, USER).await);
    tokio::time::sleep(Duration::from_millis(1400)).await;
    // The cache window (60 s) is far from over, but the grant has ended: the
    // check goes back to Money, which now answers with an ended grant.
    assert!(!is_premium(&money, USER).await);
    assert_eq!(fake.lock().unwrap().checks.len(), 2);
}

#[tokio::test]
async fn an_answer_already_past_its_end_grants_nothing() {
    let past = chrono::Utc::now() - chrono::Duration::seconds(5);
    let (money, _) = fake_money(
        200,
        json!({"entitled": true, "expire_time": past.to_rfc3339()}),
    )
    .await;
    assert!(!is_premium(&money, USER).await);
}

#[tokio::test]
async fn seats_is_a_limit_feature() {
    let (money, fake) = fake_money(200, json!({"entitled": true, "limit": "4"})).await;
    assert_eq!(seats(&money, USER).await, Some(4));
    assert_eq!(fake.lock().unwrap().checks[0]["feature"], FEATURE_SEATS);
    let (money, _) = fake_money(200, json!({"entitled": false})).await;
    assert_eq!(seats(&money, USER).await, None);
}

// ---- checkout ---------------------------------------------------------------

#[tokio::test]
async fn checkout_creates_a_money_session_and_returns_its_url() {
    let (money, fake) = fake_money(200, json!({"entitled": false})).await;
    let catalog = parsed(catalog_fixture(&[]));
    let consent = Consent::require(true).unwrap();
    let url = create_session(
        &money,
        &catalog,
        USER,
        "individual_monthly",
        "en-GB",
        "gbp",
        None,
        consent,
    )
    .await
    .unwrap();
    assert_eq!(url, "https://checkout.example/pay/cs_1");
    let body = fake.lock().unwrap().sessions[0].clone();
    assert_eq!(body["subject"]["end_user"], USER);
    assert_eq!(body["line_items"][0]["price"], "k_solo_m");
    assert_eq!(body["currency_code"], "GBP");
    assert_eq!(body["metadata"]["plan_id"], "individual_monthly");
    assert_eq!(body["metadata"]["immediate_supply_consent"], "true");
    assert_eq!(body["locale"], "en-GB");
    assert_eq!(
        body["success_url"],
        "https://puzzled.test/en-GB/settings/subscription?checkout=success&s={CHECKOUT_SESSION_ID}"
    );
    assert_eq!(
        body["cancel_url"],
        "https://puzzled.test/en-GB/pricing?checkout=cancelled"
    );
}

#[tokio::test]
async fn checkout_drops_a_currency_money_does_not_price() {
    let (money, fake) = fake_money(200, json!({"entitled": false})).await;
    let catalog = parsed(catalog_fixture(&[]));
    let consent = Consent::require(true).unwrap();
    create_session(
        &money,
        &catalog,
        USER,
        "family_yearly",
        "",
        "jpy",
        None,
        consent,
    )
    .await
    .unwrap();
    let body = fake.lock().unwrap().sessions[0].clone();
    assert!(body.get("currency_code").is_none());
    assert!(body.get("locale").is_none());
}

#[test]
fn no_consent_no_checkout() {
    assert_eq!(
        Consent::require(false).unwrap_err(),
        CheckoutError::ConsentRequired
    );
    assert!(Consent::require(true).is_ok());
}

#[tokio::test]
async fn checkout_refuses_unknown_archived_and_already_subscribed() {
    let consent = Consent::require(true).unwrap();
    let (money, fake) = fake_money(200, json!({"entitled": false})).await;
    let catalog = parsed(catalog_fixture(&[]));
    assert_eq!(
        create_session(&money, &catalog, USER, "nope", "", "usd", None, consent).await,
        Err(CheckoutError::PlanNotOnSale)
    );
    let archived = parsed(catalog_fixture(&["k_solo_m"]));
    assert_eq!(
        create_session(
            &money,
            &archived,
            USER,
            "individual_monthly",
            "",
            "usd",
            None,
            consent
        )
        .await,
        Err(CheckoutError::PlanNotOnSale)
    );
    assert!(fake.lock().unwrap().sessions.is_empty());
    let (money, fake) = fake_money(200, granted()).await;
    assert_eq!(
        create_session(
            &money,
            &catalog,
            USER,
            "individual_monthly",
            "",
            "usd",
            None,
            consent
        )
        .await,
        Err(CheckoutError::AlreadySubscribed)
    );
    assert!(fake.lock().unwrap().sessions.is_empty());
}

#[test]
fn session_body_carries_attribution() {
    let money = Money::new("http://x/env", "k", "https://puzzled.test/");
    let tags = puzzled_core::attribution::Attribution {
        source: Some("tryit".into()),
        referral: Some("res_1".into()),
        ..Default::default()
    };
    let body = session_body(
        &money,
        USER,
        "individual_monthly",
        "k_solo_m",
        "",
        None,
        Some(&tags),
    );
    assert_eq!(body["metadata"]["utm_source"], "tryit");
    assert_eq!(body["metadata"]["ref"], "res_1");
    assert_eq!(
        body["success_url"],
        "https://puzzled.test/settings/subscription?checkout=success&s={CHECKOUT_SESSION_ID}"
    );
}

// ---- pricing ----------------------------------------------------------------

#[tokio::test]
async fn pricing_is_derived_from_the_catalogue_fixture() {
    let (money, _) = fake_money(200, json!({})).await;
    let catalog = money.catalog().await.unwrap();
    let shown = plans(&catalog);
    let ids: Vec<&str> = shown.iter().map(|p| p.plan_id.as_str()).collect();
    // Individual (seats 1) before family, month before year; the product
    // without `plus` is not a plan.
    assert_eq!(
        ids,
        [
            "individual_monthly",
            "individual_yearly",
            "family_monthly",
            "family_yearly"
        ]
    );
    let first = &shown[0];
    assert_eq!(first.price_key, "k_solo_m");
    assert_eq!(first.interval, "month");
    assert!(!first.family && shown[2].family && shown[2].seats == 4);
    assert_eq!(
        first.prices,
        vec![("gbp".to_string(), 1000), ("usd".to_string(), 1100)]
    );
}

#[test]
fn an_archived_or_unpriced_price_is_not_sold() {
    let archived = parsed(catalog_fixture(&["k_fam_y"]));
    assert_eq!(plans(&archived).len(), 3);
    assert!(plan(&archived, "family_yearly").is_none());
    assert!(plan(&archived, "family_monthly").is_some());
    let mut weekly = catalog_fixture(&[]);
    weekly["spec"]["products"][1]["prices"][0]["recurring_interval"] = json!("week");
    assert!(plan(&parsed(weekly), "individual_monthly").is_none());
    assert!(plans(&Catalog::default()).is_empty());
}

// ---- consent row ------------------------------------------------------------

#[tokio::test]
async fn consent_is_recorded_once_per_checkout() {
    let Some(pool) = crate::billing_flow_tests::fresh_database().await else {
        return;
    };
    super::consent_db::record(&pool, USER, "individual_monthly", "k_solo_m", "en-US")
        .await
        .unwrap();
    let (n, statement): (i64, String) = sqlx::query_as(
        r#"SELECT count(*), max("statement") FROM "checkout_consents" WHERE "user_id" = $1::uuid"#,
    )
    .bind(USER)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(n, 1);
    assert_eq!(statement, super::consent_db::IMMEDIATE_SUPPLY_STATEMENT);
}

// ---- erasure guard ----------------------------------------------------------

fn sub(user: &str, status: &str, ends: bool) -> Value {
    json!({"subject": {"end_user": user}, "status": status, "cancel_at_period_end": ends})
}

#[tokio::test]
async fn erasure_guard_sees_a_renewing_money_subscription() {
    let (money, _) = fake_money(
        200,
        json!({"customer_subscriptions": [sub(USER, "active", false)]}),
    )
    .await;
    assert_eq!(money.has_renewing_subscription(USER).await, Ok(true));
}

#[tokio::test]
async fn erasure_guard_ignores_ended_cancelled_and_other_peoples_subscriptions() {
    let rows = json!({"customer_subscriptions": [
        sub(USER, "active", true),
        sub(USER, "canceled", false),
        sub("someone-else", "active", false)]});
    let (money, _) = fake_money(200, rows).await;
    assert_eq!(money.has_renewing_subscription(USER).await, Ok(false));
    let (money, _) = fake_money(200, json!({})).await;
    assert_eq!(money.has_renewing_subscription(USER).await, Ok(false));
}

#[tokio::test]
async fn erasure_guard_errors_when_money_is_unavailable() {
    let (money, _) = fake_money(503, json!({})).await;
    assert!(money.has_renewing_subscription(USER).await.is_err());
    let gone = Money::new("http://127.0.0.1:1/env", "sk_test", "https://puzzled.test");
    assert!(gone.has_renewing_subscription(USER).await.is_err());
}
