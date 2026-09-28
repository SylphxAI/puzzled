//! Puzzled Plus end to end against a real Postgres and a fake Stripe.
//!
//! Buy, unlock, family share, cancel with refund, and lock again, through the
//! same router production serves. Needs `PUZZLED_TEST_DATABASE_URL` (a server
//! where a throwaway database can be created); CI sets it and
//! `PUZZLED_REQUIRE_DB_TESTS=1`, so a missing database fails there instead of
//! skipping.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use axum::body::{to_bytes, Body};
use axum::extract::{Path, Query, State};
use axum::http::{Method, Request, StatusCode};
use axum::routing::get;
use axum::{Form, Json, Router};
use serde_json::{json, Value};
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use tower::ServiceExt;

use crate::capabilities::billing::adapters::stripe::{sign_webhook, Stripe};
use crate::{router, AppState};

const WEBHOOK_SECRET: &str = "whsec_test_flow";

// ---- fake Stripe -------------------------------------------------------------

#[derive(Default)]
struct FakeStripe {
    next: u32,
    /// Added to every USD amount the fake publishes, so a test can make
    /// Stripe disagree with the catalogue without editing the catalogue.
    price_drift_usd: i64,
    customers: HashMap<String, String>,
    subscriptions: HashMap<String, Value>,
    invoices: HashMap<String, Value>,
    refunds: Vec<Value>,
    checkouts: Vec<HashMap<String, String>>,
}

type Fake = Arc<Mutex<FakeStripe>>;

/// A published price for a catalogue plan, exactly as the catalogue declares
/// it (amounts, interval and tax behaviour alike).
fn price(id: &str, plan_id: &str) -> Value {
    let plan = puzzled_core::billing_access::catalogue::catalogue()
        .plan(plan_id)
        .unwrap();
    let usd = plan.declared_amount("usd").unwrap();
    let gbp = plan.declared_amount("gbp").unwrap();
    json!({"id": id, "lookup_key": plan.provider_lookup_key, "currency": "usd",
           "unit_amount": usd, "tax_behavior": plan.tax_behavior,
           "recurring": {"interval": plan.interval},
           "currency_options": {"usd": {"unit_amount": usd}, "gbp": {"unit_amount": gbp}}})
}

async fn prices(State(fake): State<Fake>) -> Json<Value> {
    let drift = fake.lock().unwrap().price_drift_usd;
    let mut data = vec![
        price("price_im", "individual_monthly"),
        price("price_iy", "individual_yearly"),
        price("price_fm", "family_monthly"),
        price("price_fy", "family_yearly"),
    ];
    if drift != 0 {
        // What a price edited in the dashboard looks like to the api: the
        // catalogue is unchanged, Stripe is not.
        for price in &mut data {
            let usd = price["unit_amount"].as_i64().unwrap() + drift;
            price["unit_amount"] = json!(usd);
            price["currency_options"]["usd"]["unit_amount"] = json!(usd);
        }
    }
    Json(json!({"data": data}))
}

async fn create_customer(
    State(fake): State<Fake>,
    Form(form): Form<Vec<(String, String)>>,
) -> Json<Value> {
    let mut fake = fake.lock().unwrap();
    fake.next += 1;
    let id = format!("cus_{}", fake.next);
    let user = form
        .iter()
        .find(|(k, _)| k == "metadata[user_id]")
        .map(|(_, v)| v.clone())
        .unwrap_or_default();
    fake.customers.insert(id.clone(), user);
    Json(json!({"id": id}))
}

async fn create_checkout(
    State(fake): State<Fake>,
    Form(form): Form<Vec<(String, String)>>,
) -> Json<Value> {
    let mut fake = fake.lock().unwrap();
    fake.checkouts.push(form.into_iter().collect());
    Json(json!({"id": "cs_1", "url": "https://checkout.stripe.test/cs_1"}))
}

async fn get_subscription(State(fake): State<Fake>, Path(id): Path<String>) -> Json<Value> {
    Json(fake.lock().unwrap().subscriptions[&id].clone())
}

async fn list_subscriptions(
    State(fake): State<Fake>,
    Query(query): Query<HashMap<String, String>>,
) -> Json<Value> {
    let fake = fake.lock().unwrap();
    let data: Vec<Value> = fake
        .subscriptions
        .values()
        .filter(|s| {
            Some(s["customer"].as_str().unwrap_or("")) == query.get("customer").map(String::as_str)
        })
        .cloned()
        .collect();
    Json(json!({"data": data}))
}

async fn update_subscription(
    State(fake): State<Fake>,
    Path(id): Path<String>,
    Form(form): Form<Vec<(String, String)>>,
) -> Json<Value> {
    let mut fake = fake.lock().unwrap();
    let sub = fake.subscriptions.get_mut(&id).unwrap();
    for (key, value) in form {
        if key == "cancel_at_period_end" {
            sub["cancel_at_period_end"] = json!(value == "true");
        }
    }
    Json(sub.clone())
}

async fn delete_subscription(State(fake): State<Fake>, Path(id): Path<String>) -> Json<Value> {
    let mut fake = fake.lock().unwrap();
    let sub = fake.subscriptions.get_mut(&id).unwrap();
    sub["status"] = json!("canceled");
    Json(sub.clone())
}

async fn list_invoices(
    State(fake): State<Fake>,
    Query(query): Query<HashMap<String, String>>,
) -> Json<Value> {
    let fake = fake.lock().unwrap();
    let data: Vec<Value> = fake
        .invoices
        .values()
        .filter(|i| i["subscription"].as_str() == query.get("subscription").map(String::as_str))
        .cloned()
        .collect();
    Json(json!({"data": data}))
}

async fn get_invoice(State(fake): State<Fake>, Path(id): Path<String>) -> Json<Value> {
    Json(fake.lock().unwrap().invoices[&id].clone())
}

async fn create_refund(
    State(fake): State<Fake>,
    Form(form): Form<Vec<(String, String)>>,
) -> Json<Value> {
    let mut fake = fake.lock().unwrap();
    let charge = form
        .iter()
        .find(|(k, _)| k == "charge")
        .map(|(_, v)| v.clone())
        .unwrap();
    let invoice = fake
        .invoices
        .values()
        .find(|i| i["charge"] == json!(charge))
        .cloned()
        .unwrap();
    let refund = json!({"id": format!("re_{charge}"), "status": "succeeded",
        "amount": invoice["amount_paid"], "currency": invoice["currency"], "created": 1_800_000_000,
        "charge": charge});
    fake.refunds.push(refund.clone());
    Json(refund)
}

async fn portal_configurations() -> Json<Value> {
    Json(json!({"data": [{"id": "bpc_1", "metadata": {"app": "puzzled"}}]}))
}

async fn portal_session() -> Json<Value> {
    Json(json!({"url": "https://billing.stripe.test/session"}))
}

async fn spawn_fake(fake: Fake) -> String {
    let app = Router::new()
        .route("/v1/prices", get(prices))
        .route("/v1/customers", axum::routing::post(create_customer))
        .route(
            "/v1/checkout/sessions",
            axum::routing::post(create_checkout),
        )
        .route("/v1/subscriptions", get(list_subscriptions))
        .route(
            "/v1/subscriptions/{id}",
            get(get_subscription)
                .post(update_subscription)
                .delete(delete_subscription),
        )
        .route("/v1/invoices", get(list_invoices))
        .route("/v1/invoices/{id}", get(get_invoice))
        .route("/v1/refunds", axum::routing::post(create_refund))
        .route(
            "/v1/billing_portal/configurations",
            get(portal_configurations),
        )
        .route(
            "/v1/billing_portal/sessions",
            axum::routing::post(portal_session),
        )
        .with_state(fake);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("http://{addr}")
}

/// Stripe finishing a checkout: a live subscription and its paid invoice, at
/// the catalogue's declared lookup key and amount.
fn complete_checkout(fake: &Fake, customer: &str, user: &str, plan_id: &str) -> String {
    let plan = puzzled_core::billing_access::catalogue::catalogue()
        .plan(plan_id)
        .unwrap();
    let lookup_key = plan.provider_lookup_key.as_str();
    let amount = plan.declared_amount("usd").unwrap();
    let mut fake = fake.lock().unwrap();
    fake.next += 1;
    let n = fake.next;
    let now = chrono::Utc::now().timestamp();
    let sub = format!("sub_{n}");
    // Stripe copies `subscription_data[metadata]` from this customer's checkout.
    let mut metadata = serde_json::Map::new();
    metadata.insert("user_id".into(), json!(user));
    if let Some(form) = fake
        .checkouts
        .iter()
        .rev()
        .find(|f| f.get("customer").map(String::as_str) == Some(customer))
    {
        for (key, value) in form {
            if let Some(name) = key
                .strip_prefix("subscription_data[metadata][")
                .and_then(|k| k.strip_suffix(']'))
            {
                metadata.insert(name.to_string(), json!(value));
            }
        }
    }
    fake.subscriptions.insert(
        sub.clone(),
        json!({"id": sub, "customer": customer, "status": "active",
               "current_period_end": now + 30 * 86_400, "cancel_at_period_end": false,
               "start_date": now, "metadata": metadata,
               "items": {"data": [{"price": {"lookup_key": lookup_key}}]}}),
    );
    let invoice = format!("in_{n}");
    fake.invoices.insert(
        invoice.clone(),
        json!({"id": invoice, "customer": customer, "subscription": sub, "status": "paid",
               "amount_paid": amount, "currency": "usd", "charge": format!("ch_{n}"),
               "status_transitions": {"paid_at": now}}),
    );
    sub
}

// ---- harness -------------------------------------------------------------------

pub(crate) async fn fresh_database() -> Option<PgPool> {
    let Ok(admin_url) = std::env::var("PUZZLED_TEST_DATABASE_URL") else {
        assert!(
            std::env::var("PUZZLED_REQUIRE_DB_TESTS").is_err(),
            "PUZZLED_TEST_DATABASE_URL is required here"
        );
        eprintln!("skipping billing flow: PUZZLED_TEST_DATABASE_URL is not set");
        return None;
    };
    let admin = PgPoolOptions::new()
        .max_connections(1)
        .connect(&admin_url)
        .await
        .unwrap();
    let name = format!("puzzled_billing_{}", uuid::Uuid::new_v4().simple());
    sqlx::query(sqlx::AssertSqlSafe(format!("CREATE DATABASE {name}")))
        .execute(&admin)
        .await
        .unwrap();
    let mut url = reqwest::Url::parse(&admin_url).unwrap();
    url.set_path(&format!("/{name}"));
    let pool = PgPoolOptions::new()
        .max_connections(4)
        .connect(url.as_str())
        .await
        .unwrap();
    let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../apps/puzzled/atlas/migrations");
    let mut files: Vec<_> = std::fs::read_dir(&dir)
        .unwrap()
        .filter_map(Result::ok)
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|e| e == "sql"))
        .collect();
    files.sort();
    for file in files {
        let sql = std::fs::read_to_string(&file).unwrap();
        sqlx::raw_sql(sqlx::AssertSqlSafe(sql))
            .execute(&pool)
            .await
            .unwrap_or_else(|e| panic!("{}: {e}", file.display()));
    }
    Some(pool)
}

fn token(sub: &str) -> String {
    use jsonwebtoken::{encode, EncodingKey, Header};
    let priv_pem = include_str!("../testdata/platform_jwt_test_priv.pem");
    let pub_pem = include_str!("../testdata/platform_jwt_test_pub.pem");
    crate::capabilities::identity_access::adapters::platform_jwt::install_test_decoding_key_pem(
        pub_pem,
    )
    .unwrap();
    let claims = json!({"sub": sub, "name": "Player", "email": "player@example.com",
                        "exp": chrono::Utc::now().timestamp() + 3600});
    encode(
        &Header::new(jsonwebtoken::Algorithm::RS256),
        &claims,
        &EncodingKey::from_rsa_pem(priv_pem.as_bytes()).unwrap(),
    )
    .unwrap()
}

async fn call(app: &Router, path: &str, body: Value, bearer: Option<&str>) -> (StatusCode, Value) {
    call_with_cookie(app, path, body, bearer, None).await
}

async fn call_with_cookie(
    app: &Router,
    path: &str,
    body: Value,
    bearer: Option<&str>,
    cookie: Option<&str>,
) -> (StatusCode, Value) {
    let mut request = Request::builder()
        .method(Method::POST)
        .uri(path)
        .header("content-type", "application/json");
    if let Some(cookie) = cookie {
        request = request.header("cookie", cookie);
    }
    if let Some(token) = bearer {
        request = request.header("authorization", format!("Bearer {token}"));
    }
    let response = app
        .clone()
        .oneshot(request.body(Body::from(body.to_string())).unwrap())
        .await
        .unwrap();
    let status = response.status();
    let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    (
        status,
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
    )
}

async fn webhook(app: &Router, event: Value, secret: &str) -> StatusCode {
    let body = event.to_string();
    let signature = sign_webhook(body.as_bytes(), secret, chrono::Utc::now().timestamp());
    app.clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/webhooks/stripe")
                .header("stripe-signature", signature)
                .body(Body::from(body))
                .unwrap(),
        )
        .await
        .unwrap()
        .status()
}

/// A game that is not today's free one.
fn paid_game() -> &'static str {
    let today = puzzled_core::puzzle_play::daily_time::product_day_key(chrono::Utc::now());
    let free = puzzled_core::puzzle_play::game_slugs::todays_free_game(today);
    if free == "sudoku" {
        "crossword"
    } else {
        "sudoku"
    }
}

/// A declared USD amount, so ledger and invoice fixtures cannot drift from the
/// catalogue.
fn declared(plan_id: &str) -> i64 {
    puzzled_core::billing_access::catalogue::catalogue()
        .declared_amount(plan_id, "usd")
        .unwrap()
}

async fn play(app: &Router, game: &str, token: &str) -> (StatusCode, Value) {
    call(
        app,
        "/puzzled.v1.PuzzleService/GetDaily",
        json!({"gameSlug": game}),
        Some(token),
    )
    .await
}

#[tokio::test]
async fn buy_unlock_share_cancel_refund_and_lock_again() {
    let _key = crate::capabilities::identity_access::adapters::platform_jwt::test_key_lock()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let Some(pool) = fresh_database().await else {
        return;
    };
    let fake: Fake = Arc::default();
    let base = spawn_fake(fake.clone()).await;
    let stripe = Stripe::new(
        "sk_test_flow".into(),
        WEBHOOK_SECRET.into(),
        base,
        "https://puzzled.test".into(),
    );
    let app = router(AppState::new(Some(pool.clone())).with_stripe(Some(stripe)));

    let buyer = "0b6f7d3e-1111-4a4a-9c9c-000000000001";
    let buyer_token = token(buyer);

    // Price list is Stripe's, per currency.
    let (status, plans) = call(
        &app,
        "/puzzled.v1.BillingService/ListPlans",
        json!({}),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{plans}");
    assert_eq!(plans["salesOpen"], true);
    assert_eq!(plans["plans"].as_array().unwrap().len(), 4);
    assert_eq!(plans["plans"][0]["id"], "individual_monthly");
    assert_eq!(plans["plans"][0]["prices"][1]["currency"], "gbp");

    // Before paying: today's free game plays, another game and the archive do not.
    let today = puzzled_core::puzzle_play::daily_time::product_day_key(chrono::Utc::now());
    let free = puzzled_core::puzzle_play::game_slugs::todays_free_game(today);
    let (status, _) = play(&app, free, &buyer_token).await;
    assert_eq!(status, StatusCode::OK);
    let (status, body) = play(&app, paid_game(), &buyer_token).await;
    assert_eq!(status, StatusCode::FORBIDDEN, "{body}");
    assert!(body["message"]
        .as_str()
        .unwrap_or("")
        .contains("plus_required"));
    let (status, body) = call(
        &app,
        "/puzzled.v1.PuzzleService/GetDaily",
        json!({"gameSlug": free, "puzzleDate": "2026-01-01"}),
        Some(&buyer_token),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert!(body["message"]
        .as_str()
        .unwrap_or("")
        .contains("plus_required_archive"));

    // A guest cannot start a checkout.
    let (status, _) = call(
        &app,
        "/puzzled.v1.BillingService/CreateCheckout",
        json!({"planId": "individual_monthly"}),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);

    // Sign-up records the first-touch tags from the landing cookie, once.
    let tryit = "puzzled_attr=s%3Dtryit%26m%3Dreferral%26c%3Ddaily%26r%3Dres_42%26p%3D%252Fdaily%26at%3D1790000000000";
    let record = "/puzzled.v1.PreferencesService/RecordSignupAttribution";
    let (status, body) =
        call_with_cookie(&app, record, json!({}), Some(&buyer_token), Some(tryit)).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["recorded"], true);
    let later = "puzzled_attr=s%3Dsomewhere-else";
    let (_, body) =
        call_with_cookie(&app, record, json!({}), Some(&buyer_token), Some(later)).await;
    assert!(
        !body["recorded"].as_bool().unwrap_or(false),
        "first touch wins: {body}"
    );
    let (status, _) = call_with_cookie(&app, record, json!({}), None, Some(tryit)).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    let stored: (Option<String>, Option<String>, Option<String>) =
        sqlx::query_as(r#"SELECT "utm_source", "ref", "landing_path" FROM "account_attribution""#)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(
        stored,
        (
            Some("tryit".into()),
            Some("res_42".into()),
            Some("/daily".into())
        )
    );

    // Checkout carries the account, the plan, the chosen currency and the
    // account's tags (not the later cookie on this request).
    let (status, checkout) = call_with_cookie(
        &app,
        "/puzzled.v1.BillingService/CreateCheckout",
        json!({"planId": "individual_monthly", "locale": "en-GB", "currency": "gbp"}),
        Some(&buyer_token),
        Some(later),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{checkout}");
    assert_eq!(checkout["url"], "https://checkout.stripe.test/cs_1");
    let form = fake.lock().unwrap().checkouts[0].clone();
    assert_eq!(form["line_items[0][price]"], "price_im");
    assert_eq!(form["currency"], "gbp");
    assert_eq!(form["subscription_data[metadata][user_id]"], buyer);
    assert_eq!(form["subscription_data[metadata][utm_source]"], "tryit");
    assert_eq!(form["subscription_data[metadata][ref]"], "res_42");
    assert_eq!(
        form["success_url"],
        "https://puzzled.test/en-GB/settings/subscription?checkout=success"
    );
    let customer = form["customer"].clone();

    // A forged webhook changes nothing.
    let sub = complete_checkout(&fake, &customer, buyer, "individual_monthly");
    let completed = json!({"id": "evt_1", "type": "checkout.session.completed", "created": 1,
                           "data": {"object": {"id": "cs_1", "subscription": sub}}});
    assert_eq!(
        webhook(&app, completed.clone(), "whsec_wrong").await,
        StatusCode::BAD_REQUEST
    );
    let (status, _) = play(&app, paid_game(), &buyer_token).await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    // The signed webhook is read back from Stripe and unlocks every game.
    assert_eq!(
        webhook(&app, completed.clone(), WEBHOOK_SECRET).await,
        StatusCode::OK
    );
    assert_eq!(
        webhook(&app, completed, WEBHOOK_SECRET).await,
        StatusCode::OK
    );
    let invoice_paid = json!({"id": "evt_2", "type": "invoice.paid", "created": 2,
                              "data": {"object": {"id": format!("in_{}", &sub[4..])}}});
    assert_eq!(
        webhook(&app, invoice_paid.clone(), WEBHOOK_SECRET).await,
        StatusCode::OK
    );
    assert_eq!(
        webhook(&app, invoice_paid, WEBHOOK_SECRET).await,
        StatusCode::OK
    );
    let (status, body) = play(&app, paid_game(), &buyer_token).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let (status, subscription) = call(
        &app,
        "/puzzled.v1.BillingService/GetSubscription",
        json!({}),
        Some(&buyer_token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(subscription["entitled"], true);
    assert_eq!(subscription["source"], "plus");
    assert_eq!(subscription["planId"], "individual_monthly");
    let tags: (Option<Value>,) = sqlx::query_as(
        r#"SELECT "attribution" FROM "billing_subscriptions" WHERE "stripe_subscription_id" = $1"#,
    )
    .bind(&sub)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(
        tags.0,
        Some(
            json!({"utm_source": "tryit", "utm_medium": "referral", "utm_campaign": "daily", "ref": "res_42"})
        )
    );
    assert!(
        subscription.get("refundUntilMs").is_some(),
        "{subscription}"
    );

    // A second checkout while subscribed is refused.
    let (status, _) = call(
        &app,
        "/puzzled.v1.BillingService/CreateCheckout",
        json!({"planId": "individual_yearly"}),
        Some(&buyer_token),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);

    // Erasure is refused while the subscription still renews.
    let (status, body) = call(
        &app,
        "/puzzled.v1.PreferencesService/DeleteAccountData",
        json!({"confirm": "DELETE"}),
        Some(&buyer_token),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
    assert!(body["message"]
        .as_str()
        .unwrap_or("")
        .contains("cancel_subscription_first"));

    // Cancelling inside 14 days refunds in full and ends access now.
    let (status, cancelled) = call(
        &app,
        "/puzzled.v1.BillingService/CancelSubscription",
        json!({}),
        Some(&buyer_token),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{cancelled}");
    assert_eq!(cancelled["refunded"], true);
    let (status, _) = play(&app, paid_game(), &buyer_token).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    let ledger: Vec<(String, i64)> = sqlx::query_as(
        r#"SELECT "kind", "amount_minor" FROM "billing_ledger" ORDER BY "amount_minor" DESC"#,
    )
    .fetch_all(&pool)
    .await
    .unwrap();
    assert_eq!(
        ledger,
        vec![
            ("payment".to_string(), declared("individual_monthly")),
            ("refund".to_string(), -declared("individual_monthly"))
        ]
    );

    // A second subscription has no refund window: cancel runs to period end.
    let sub2 = complete_checkout(&fake, &customer, buyer, "individual_yearly");
    let event = json!({"id": "evt_3", "type": "customer.subscription.created", "created": 3,
                       "data": {"object": {"id": sub2}}});
    assert_eq!(webhook(&app, event, WEBHOOK_SECRET).await, StatusCode::OK);
    let (_, subscription) = call(
        &app,
        "/puzzled.v1.BillingService/GetSubscription",
        json!({}),
        Some(&buyer_token),
    )
    .await;
    assert!(
        subscription.get("refundUntilMs").is_none(),
        "{subscription}"
    );
    let (status, cancelled) = call(
        &app,
        "/puzzled.v1.BillingService/CancelSubscription",
        json!({}),
        Some(&buyer_token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    // ProtoJSON omits a false field.
    assert!(
        !cancelled["refunded"].as_bool().unwrap_or(false),
        "{cancelled}"
    );
    assert!(
        cancelled["accessEndsAtMs"].as_str().is_some(),
        "{cancelled}"
    );
    let (status, _) = play(&app, paid_game(), &buyer_token).await;
    assert_eq!(
        status,
        StatusCode::OK,
        "access runs to the end of the paid period"
    );
    let (status, _) = call(
        &app,
        "/puzzled.v1.BillingService/ResumeSubscription",
        json!({}),
        Some(&buyer_token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    // Family plan: the owner shares with members up to four people.
    let owner = "0b6f7d3e-2222-4a4a-9c9c-000000000002";
    let owner_token = token(owner);
    let (status, _) = call_with_cookie(
        &app,
        "/puzzled.v1.BillingService/CreateCheckout",
        json!({"planId": "family_monthly"}),
        Some(&owner_token),
        Some("puzzled_attr=s%3Dnewsletter"),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        fake.lock().unwrap().checkouts[1]["subscription_data[metadata][utm_source]"],
        "newsletter",
        "without an account row the landing cookie is used"
    );
    let owner_customer = fake.lock().unwrap().checkouts[1]["customer"].clone();
    let family_sub = complete_checkout(&fake, &owner_customer, owner, "family_monthly");
    let event = json!({"id": "evt_4", "type": "customer.subscription.created", "created": 4,
                       "data": {"object": {"id": family_sub}}});
    assert_eq!(webhook(&app, event, WEBHOOK_SECRET).await, StatusCode::OK);
    let (_, owner_view) = call(
        &app,
        "/puzzled.v1.BillingService/GetSubscription",
        json!({}),
        Some(&owner_token),
    )
    .await;
    let code = owner_view["family"]["inviteCode"]
        .as_str()
        .unwrap()
        .to_string();
    assert_eq!(owner_view["family"]["maxMembers"], 4);

    let members: Vec<String> = (3..=6)
        .map(|n| format!("0b6f7d3e-3333-4a4a-9c9c-00000000000{n}"))
        .collect();
    for (i, member) in members.iter().enumerate() {
        let (status, body) = call(
            &app,
            "/puzzled.v1.BillingService/JoinFamily",
            json!({"inviteCode": code.to_lowercase()}),
            Some(&token(member)),
        )
        .await;
        if i < 3 {
            assert_eq!(status, StatusCode::OK, "member {i}: {body}");
        } else {
            assert_eq!(
                status,
                StatusCode::TOO_MANY_REQUESTS,
                "fifth person: {body}"
            );
        }
    }
    let member_token = token(&members[0]);
    let (status, _) = play(&app, paid_game(), &member_token).await;
    assert_eq!(status, StatusCode::OK);
    let (_, member_view) = call(
        &app,
        "/puzzled.v1.BillingService/GetSubscription",
        json!({}),
        Some(&member_token),
    )
    .await;
    assert_eq!(member_view["source"], "family");
    assert!(member_view["family"].get("inviteCode").is_none());

    let (status, _) = call(
        &app,
        "/puzzled.v1.BillingService/RemoveFamilyMember",
        json!({"userId": members[0]}),
        Some(&owner_token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let (status, _) = play(&app, paid_game(), &member_token).await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    // The Customer Portal opens on our configuration.
    let (status, portal) = call(
        &app,
        "/puzzled.v1.BillingService/CreatePortal",
        json!({"locale": "zh-HK"}),
        Some(&owner_token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(portal["url"], "https://billing.stripe.test/session");

    pool.close().await;
}

#[tokio::test]
async fn sales_closed_sells_nothing_and_locks_nothing() {
    let app = router(AppState::new(None));
    let (status, plans) = call(
        &app,
        "/puzzled.v1.BillingService/ListPlans",
        json!({}),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        plans
            .get("salesOpen")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        false
    );
    assert_eq!(plans["familyMaxMembers"], 4);
    assert_eq!(plans["cancellationDays"], 14);
    // The price list is the catalogue's declaration even while nothing can be
    // sold; sales_open is what says it cannot be bought.
    assert_eq!(
        plans["plans"].as_array().unwrap().len(),
        puzzled_core::billing_access::catalogue::catalogue()
            .plans
            .len()
    );
    let (status, body) = call(
        &app,
        "/puzzled.v1.PuzzleService/GetDaily",
        json!({"gameSlug": paid_game(), "puzzleDate": "2026-01-01"}),
        None,
    )
    .await;
    assert_ne!(status, StatusCode::FORBIDDEN, "{body}");
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/webhooks/stripe")
                .body(Body::from("{}"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
}

/// A proto int64 field as JSON: the Connect JSON mapping may carry it as a
/// number or as a string.
fn int64(value: &Value) -> i64 {
    value
        .as_i64()
        .or_else(|| value.as_str().and_then(|text| text.parse().ok()))
        .unwrap_or_else(|| panic!("not an int64: {value}"))
}

/// A price the catalogue does not declare — a dashboard edit, or a catalogue
/// edit not yet published — closes sales: the list is still the declaration,
/// checkout refuses rather than charge it, and nothing is locked because
/// nothing can be bought.
#[tokio::test]
async fn a_published_price_that_differs_from_the_catalogue_closes_sales() {
    let _key = crate::capabilities::identity_access::adapters::platform_jwt::test_key_lock()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let Some(pool) = fresh_database().await else {
        return;
    };
    let fake: Fake = Arc::new(Mutex::new(FakeStripe {
        price_drift_usd: -100,
        ..FakeStripe::default()
    }));
    let base = spawn_fake(fake.clone()).await;
    let stripe = Stripe::new(
        "sk_test_flow".into(),
        WEBHOOK_SECRET.into(),
        base,
        "https://puzzled.test".into(),
    );
    let app = router(AppState::new(Some(pool.clone())).with_stripe(Some(stripe)));

    let catalogue = puzzled_core::billing_access::catalogue::catalogue();
    let (status, plans) = call(
        &app,
        "/puzzled.v1.BillingService/ListPlans",
        json!({}),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{plans}");
    assert_eq!(plans["salesOpen"], false);
    // The list itself is still the catalogue's declaration, not Stripe's.
    assert_eq!(
        plans["plans"].as_array().unwrap().len(),
        catalogue.plans.len()
    );
    assert_eq!(plans["plans"][0]["id"], "individual_monthly");
    assert_eq!(
        int64(&plans["plans"][0]["prices"][0]["unitAmountMinor"]),
        catalogue
            .declared_amount("individual_monthly", "usd")
            .unwrap()
    );

    // Checkout refuses instead of charging the drifted price.
    let buyer = "0b6f7d3e-3333-4a4a-9c9c-000000000003";
    let buyer_token = token(buyer);
    let (status, body) = call(
        &app,
        "/puzzled.v1.BillingService/CreateCheckout",
        json!({"planId": "individual_monthly", "locale": "en-GB", "currency": "gbp"}),
        Some(&buyer_token),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
    assert!(
        body["message"]
            .as_str()
            .unwrap_or("")
            .contains("plan_not_on_sale"),
        "{body}"
    );
    assert!(fake.lock().unwrap().checkouts.is_empty());

    // Nothing can be bought, so nothing is locked: paid games still play.
    let (status, body) = play(&app, paid_game(), &buyer_token).await;
    assert_eq!(status, StatusCode::OK, "{body}");

    pool.close().await;
}
