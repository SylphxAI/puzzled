//! Sylphx Auth end-user sessions through the real router, against a fake Auth.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

use axum::body::Body;
use axum::http::{HeaderMap, Method, Request, StatusCode};
use axum::routing::get;
use axum::{Json, Router};
use serde_json::{json, Value};
use tower::ServiceExt;

use crate::capabilities::identity_access::adapters::auth_session::{
    encode_identity, AuthSessions, VERIFIED_IDENTITY_HEADER,
};
use crate::capabilities::identity_access::adapters::platform_jwt::VerifiedIdentity;
use crate::{router, AppState};

const GOOD: &str = "identity_org_session_good";

async fn spawn_fake_auth(calls: Arc<AtomicUsize>) -> String {
    let app = Router::new().route(
        "/v1/sessions/current",
        get(move |headers: HeaderMap| {
            let calls = calls.clone();
            async move {
                calls.fetch_add(1, Ordering::SeqCst);
                let bearer = headers
                    .get("authorization")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("");
                let agent = headers
                    .get("user-agent")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("");
                if bearer == format!("Bearer {GOOD}") && agent == "Browser/1.0" {
                    (
                        StatusCode::OK,
                        Json(json!({"session": {"principal": {
                        "principal_id": "principal-0199aa10-7b2c-7d3e-8f00-1234567890ab",
                        "display_name": "Ada", "primary_email": "ada@example.com",
                        "state": "active"}}})),
                    )
                } else {
                    (
                        StatusCode::UNAUTHORIZED,
                        Json(json!({"error": "unauthenticated"})),
                    )
                }
            }
        }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("http://{addr}")
}

async fn subscription(app: &Router, headers: &[(&str, String)]) -> (StatusCode, Value) {
    let mut request = Request::builder()
        .method(Method::POST)
        .uri("/puzzled.v1.BillingService/GetSubscription")
        .header("content-type", "application/json");
    if !headers.iter().any(|(name, _)| *name == "user-agent") {
        request = request.header("user-agent", "Browser/1.0");
    }
    for (name, value) in headers {
        request = request.header(*name, value);
    }
    let response = app
        .clone()
        .oneshot(request.body(Body::from("{}")).unwrap())
        .await
        .unwrap();
    let status = response.status();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    (
        status,
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
    )
}

#[tokio::test]
async fn auth_sessions_sign_players_in_and_forged_headers_do_not() {
    let calls = Arc::new(AtomicUsize::new(0));
    let base = spawn_fake_auth(calls.clone()).await;
    let app = router(AppState::new(None).with_auth(AuthSessions::new(base)));

    // The web's session cookie is verified with Auth.
    let cookie = ("cookie", format!("x=1; sylphx_identity_session={GOOD}"));
    let (status, body) = subscription(&app, std::slice::from_ref(&cookie)).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    // A bearer works too, and the answer is cached (one Auth call so far).
    let (status, _) = subscription(&app, &[("authorization", format!("Bearer {GOOD}"))]).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        calls.load(Ordering::SeqCst),
        1,
        "second check is served from cache"
    );

    // A session Auth refuses is not signed in.
    let bad = (
        "cookie",
        "sylphx_identity_session=identity_org_session_revoked".to_string(),
    );
    let (status, _) = subscription(&app, &[bad]).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);

    // The same session from another User-Agent is refused (Auth binds it).
    let (status, _) = subscription(
        &app,
        &[
            ("authorization", format!("Bearer {GOOD}")),
            ("user-agent", "Other/2.0".to_string()),
        ],
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);

    // A client cannot set the internal header itself.
    let forged = encode_identity(&VerifiedIdentity {
        user_id: "0199aa10-7b2c-7d3e-8f00-1234567890ab".into(),
        display_name: None,
        email: None,
        is_admin: true,
    })
    .unwrap();
    let (status, _) = subscription(
        &app,
        &[(
            VERIFIED_IDENTITY_HEADER,
            forged.to_str().unwrap().to_string(),
        )],
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}
