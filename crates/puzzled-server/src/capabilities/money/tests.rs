//! Money client, entitlement, checkout and pricing against a fake Money.

use std::sync::{Arc, Mutex};
use std::time::Duration;

use axum::extract::State;
use axum::http::StatusCode;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde_json::{json, Value};

use super::access::{family_active, is_premium, seats, FEATURE_PLUS, FEATURE_SEATS};
use super::checkout::{create_session, session_body, CheckoutError, Consent};
use super::client::{Catalog, Money};
use super::pricing::{plan, plans};

const USER: &str = "0190a0a0-0000-7000-8000-000000000001";

#[derive(Default)]
struct FakeMoney {
    actions: Vec<String>,
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

async fn action(
    State(fake): State<Fake>,
    axum::extract::Path(rest): axum::extract::Path<String>,
    Json(body): Json<Value>,
) -> Json<Value> {
    fake.lock().unwrap().actions.push(format!("{rest} {body}"));
    Json(json!({}))
}

async fn portal(State(fake): State<Fake>, Json(body): Json<Value>) -> (StatusCode, Json<Value>) {
    let mut fake = fake.lock().unwrap();
    fake.actions.push(format!("portal {body}"));
    (
        StatusCode::from_u16(fake.status).unwrap(),
        Json(json!({"url": "https://portal.example/p/1"})),
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
        .route("/env/customer_subscriptions/{*rest}", post(action))
        .route("/env/portal_sessions", post(portal))
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
async fn answers_are_cached_and_a_failure_is_cached_briefly() {
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
    // A failed call is cached as "not entitled", but only for 5 seconds.
    let (money, fake) = fake_money(503, json!({})).await;
    assert!(!is_premium(&money, USER).await);
    assert!(!is_premium(&money, USER).await);
    assert_eq!(
        fake.lock().unwrap().checks.len(),
        1,
        "an outage is not retried per request"
    );
    // Another feature is its own answer.
    assert!(!family_active(&money, USER).await);
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
    assert_eq!(seats(&money, USER).await, Ok(Some(4)));
    assert_eq!(fake.lock().unwrap().checks[0]["feature"], FEATURE_SEATS);
    let (money, _) = fake_money(200, json!({"entitled": false})).await;
    assert_eq!(seats(&money, USER).await, Ok(None));
    // Money unable to answer is an error, not "no seats".
    let (down, _) = fake_money(503, json!({})).await;
    assert!(seats(&down, USER).await.is_err());
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
    let Some(pool) = crate::test_support::fresh_database().await else {
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
    json!({"name": "orgs/o/projects/p/envs/e/customer_subscriptions/csb_1",
           "subject": {"end_user": user}, "status": status, "cancel_at_period_end": ends,
           "current_period_end_time": "2099-01-01T00:00:00Z",
           "items": [{"price": "k_solo_m", "quantity": 1}]})
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

#[tokio::test]
async fn a_failed_check_is_asked_again_after_five_seconds() {
    let (money, fake) = fake_money(503, json!({})).await;
    assert!(!is_premium(&money, USER).await);
    tokio::time::sleep(super::client::FAILED_CACHE_TTL + Duration::from_millis(300)).await;
    assert!(!is_premium(&money, USER).await);
    assert_eq!(fake.lock().unwrap().checks.len(), 2);
    // Money recovers: the next answer after the window is the real one.
    {
        let mut f = fake.lock().unwrap();
        f.status = 200;
        f.answer = granted();
    }
    tokio::time::sleep(super::client::FAILED_CACHE_TTL + Duration::from_millis(300)).await;
    assert!(is_premium(&money, USER).await);
}

#[tokio::test]
async fn subscriptions_are_read_with_their_period_and_prices() {
    let (money, _) = fake_money(
        200,
        json!({"customer_subscriptions": [sub(USER, "active", false)]}),
    )
    .await;
    let subs = money.subscriptions(USER).await.unwrap();
    assert_eq!(subs.len(), 1);
    assert_eq!(subs[0].id, "csb_1");
    assert!(subs[0].live() && subs[0].renews());
    assert_eq!(subs[0].price_keys, ["k_solo_m"]);
    assert_eq!(
        subs[0].current_period_end.unwrap().timestamp(),
        4_070_908_800_i64
    );
}

#[tokio::test]
async fn cancel_ends_at_the_period_end_with_no_refund_and_resume_undoes_it() {
    let (money, fake) = fake_money(200, json!({})).await;
    money.cancel_at_period_end("csb_1").await.unwrap();
    money.resume("csb_1").await.unwrap();
    let actions = fake.lock().unwrap().actions.clone();
    assert_eq!(actions[0], r#"csb_1:cancel {"at_period_end":true}"#);
    assert!(!actions[0].contains("refund"));
    assert_eq!(actions[1], "csb_1:resume {}");
    // An id cannot escape its path segment.
    money.cancel_at_period_end("../x").await.unwrap();
    assert!(fake.lock().unwrap().actions[2].starts_with("x:cancel"));
}

#[tokio::test]
async fn portal_session_url_comes_from_money() {
    let (money, fake) = fake_money(200, json!({})).await;
    let url = money
        .portal_url(USER, "https://puzzled.test/settings/subscription")
        .await
        .unwrap();
    assert_eq!(url, "https://portal.example/p/1");
    assert!(fake.lock().unwrap().actions[0].contains(USER));
    let (down, _) = fake_money(503, json!({})).await;
    assert!(down.portal_url(USER, "https://x").await.is_err());
}

#[tokio::test]
async fn access_is_money_alone_and_fails_closed() {
    let Some(pool) = crate::test_support::fresh_database().await else {
        return;
    };
    let (granted, _) = fake_money(200, json!({"entitled": true})).await;
    let e = crate::capabilities::billing::service::access(&pool, Some(&granted), USER)
        .await
        .unwrap();
    assert!(e.entitled && e.family_owner.is_none());
    let (down, _) = fake_money(503, json!({})).await;
    let e = crate::capabilities::billing::service::access(&pool, Some(&down), USER)
        .await
        .unwrap();
    assert!(!e.entitled);
    let none = crate::capabilities::billing::service::access(&pool, None, USER)
        .await
        .unwrap();
    assert!(!none.entitled);
}

// ---- environment discovery --------------------------------------------------

#[tokio::test]
async fn the_environment_comes_from_the_keys_whoami_and_is_kept() {
    let hits = Arc::new(Mutex::new(0u32));
    let counter = hits.clone();
    let app = Router::new()
        .route(
            "/v1/whoami",
            get(move || {
                let counter = counter.clone();
                async move {
                    *counter.lock().unwrap() += 1;
                    Json(json!({"org": "acme", "project": "puz", "env": "env_x1"}))
                }
            }),
        )
        .route(
            "/v1/orgs/acme/projects/puz/envs/env_x1/entitlement_grants:check",
            post(|| async { Json(json!({"entitled": true})) }),
        );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    let money = Money::discovering(&format!("http://{addr}"), "sk_app", "https://puzzled.test");
    assert!(is_premium(&money, USER).await);
    assert!(family_active(&money, USER).await);
    assert_eq!(*hits.lock().unwrap(), 1, "whoami is read once");
}

#[tokio::test]
async fn a_key_that_is_not_scoped_to_an_environment_grants_nothing() {
    let app = Router::new().route(
        "/v1/whoami",
        get(|| async { Json(json!({"org": "acme", "project": "", "env": ""})) }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    let money = Money::discovering(&format!("http://{addr}"), "sk_org", "https://puzzled.test");
    assert!(money.warm().await.is_err());
    assert!(!is_premium(&money, USER).await);
}

#[test]
fn money_reads_only_its_own_key() {
    let only = |name: &'static str| move |asked: &str| (asked == name).then(|| "sk_x".to_string());
    // The general key never enables Money: it fails closed (no client).
    assert!(Money::from_lookup(only("SYLPHX_API_KEY")).is_none());
    assert!(Money::from_lookup(|_| None).is_none());
    assert!(Money::from_lookup(only("SYLPHX_MONEY_API_KEY")).is_some());
}

#[tokio::test]
async fn money_calls_carry_the_money_key() {
    async fn echo(headers: axum::http::HeaderMap) -> Json<Value> {
        let auth = headers.get("authorization").and_then(|v| v.to_str().ok());
        Json(json!({"entitled": auth == Some("Bearer sk_money"), "entitlement_grant": "g1"}))
    }
    let app = Router::new().route("/env/entitlement_grants:check", post(echo));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    let money = Money::new(
        &format!("http://{addr}/env"),
        "sk_money",
        "https://puzzled.test",
    );
    assert!(is_premium(&money, USER).await);
}
