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

async fn connect_json(app: axum::Router, uri: &str, body: &str) -> (StatusCode, serde_json::Value) {
    let response = match app
        .oneshot(build_connect_request(uri, Body::from(body.to_string())))
        .await
    {
        Ok(response) => response,
        Err(error) => panic!("connect {uri}: {error}"),
    };
    let status = response.status();
    let bytes = match to_bytes(response.into_body(), usize::MAX).await {
        Ok(bytes) => bytes,
        Err(error) => panic!("read body: {error}"),
    };
    let json = serde_json::from_slice(&bytes).unwrap_or(serde_json::Value::Null);
    (status, json)
}

/// Puzzled sells no paid tier and there is no Sylphx commerce service: the
/// leaderboard and every game answer from puzzled's own API, and nothing in
/// the shell dials a commerce origin even when one is configured.
#[tokio::test]
async fn leaderboard_and_every_game_answer_without_commerce() {
    let commerce = match std::net::TcpListener::bind("127.0.0.1:0") {
        Ok(listener) => listener,
        Err(error) => panic!("bind commerce trap: {error}"),
    };
    if let Err(error) = commerce.set_nonblocking(true) {
        panic!("nonblocking commerce trap: {error}");
    }
    let origin = match commerce.local_addr() {
        Ok(addr) => format!("http://{addr}"),
        Err(error) => panic!("commerce trap addr: {error}"),
    };
    std::env::set_var("COMMERCE_API_ORIGIN", &origin);
    std::env::set_var("COMMERCE_API_KEY", "commerce_key_trap");

    let app = router(AppState::new(None));

    let (status, _) = connect_json(
        app.clone(),
        "/puzzled.v1.StatsService/GetLeaderboard",
        r#"{"gameSlug":"sudoku","type":"LEADERBOARD_TYPE_SCORE","period":"LEADERBOARD_PERIOD_ALL","limit":10}"#,
    )
    .await;
    assert_eq!(
        status,
        StatusCode::OK,
        "leaderboard must answer without commerce"
    );

    let today = puzzled_core::puzzle_play::daily_time::product_day_key(chrono::Utc::now());
    let yesterday = today - chrono::Duration::days(1);
    for slug in puzzled_core::puzzle_play::game_slugs::FREE_GAME_ROTATION {
        let (status, json) = connect_json(
            app.clone(),
            "/puzzled.v1.PuzzleService/GetDaily",
            &format!(r#"{{"gameSlug":"{slug}"}}"#),
        )
        .await;
        assert_eq!(status, StatusCode::OK, "{slug} today must be free: {json}");
        assert_eq!(json["canPlay"], true, "{slug} today must be playable");

        let (status, json) = connect_json(
            app.clone(),
            "/puzzled.v1.PuzzleService/GetDaily",
            &format!(r#"{{"gameSlug":"{slug}","puzzleDate":"{yesterday}"}}"#),
        )
        .await;
        assert_eq!(
            status,
            StatusCode::OK,
            "{slug} archive must be free: {json}"
        );
    }

    match commerce.accept() {
        Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {}
        Ok((_, peer)) => panic!("the shell dialled the commerce origin from {peer}"),
        Err(error) => panic!("commerce trap accept: {error}"),
    }
}
