//! Writer postconditions for the Puzzled shell: Connect router, not source walk.

use axum::body::{to_bytes, Body};
use axum::http::{Method, Request, StatusCode};
use puzzled_server::{router, AppState};
use tower::ServiceExt;

fn build_connect_request(uri: &str, body: Body) -> Request<Body> {
    match Request::builder()
        .method(Method::POST)
        .uri(uri)
        .header(axum::http::header::CONTENT_TYPE, "application/json")
        .body(body)
    {
        Ok(request) => request,
        Err(error) => panic!("build connect request {uri}: {error}"),
    }
}

#[tokio::test]
async fn connect_health_and_jobs_are_mounted() {
    let app = router(AppState::new(None));
    let health = match app
        .clone()
        .oneshot(build_connect_request(
            "/puzzled.v1.HealthService/Health",
            Body::from("{}"),
        ))
        .await
    {
        Ok(response) => response,
        Err(error) => panic!("connect health: {error}"),
    };
    assert_eq!(health.status(), StatusCode::OK);

    let jobs = match app
        .oneshot(build_connect_request(
            "/puzzled.v1.JobsService/RunRetentionJob",
            Body::from(r#"{"name":"daily-reminder"}"#),
        ))
        .await
    {
        Ok(response) => response,
        Err(error) => panic!("connect jobs: {error}"),
    };
    assert_ne!(jobs.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn identity_gate_uses_published_contract() {
    let app = router(AppState::new(None));
    let response = match app
        .oneshot(build_connect_request(
            "/puzzled.v1.GamificationService/GetStreakInfo",
            Body::from("{}"),
        ))
        .await
    {
        Ok(response) => response,
        Err(error) => panic!("connect GetStreakInfo: {error}"),
    };
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    let body = match to_bytes(response.into_body(), usize::MAX).await {
        Ok(body) => body,
        Err(error) => panic!("read body: {error}"),
    };
    let json: serde_json::Value = match serde_json::from_slice(&body) {
        Ok(json) => json,
        Err(error) => panic!("parse json: {error}"),
    };
    assert_eq!(json["code"], "unauthenticated");
    assert_eq!(json["message"], "identity_required_for_submit");
}
