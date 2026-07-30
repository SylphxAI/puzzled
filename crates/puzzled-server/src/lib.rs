//! Puzzled product API shell (ADR-169).
//!
//! Imperative shell: HTTP interfaces, SQL/JWT adapters, composition root.
//! Domain decisions live in `puzzled-core`.

pub mod bootstrap;

/// Generated Connect/Protobuf types (buffa + connectrpc-build).
pub mod proto {
    connectrpc::include_generated!();
}

pub mod capabilities;
pub mod shared;

pub use bootstrap::{http_port, request_shutdown, router, shutdown_signal, AppState};
pub use shared::db_config;

// Compatibility re-exports used by binary and integration surfaces.
pub use capabilities::identity_access::contract::{
    resolve_verified_identity, verify_platform_jwt, VerifiedIdentity,
};

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::{to_bytes, Body};
    use axum::http::{Method, Request, StatusCode};
    use axum::response::Response;
    use tower::ServiceExt;

    fn build_request(method: Method, uri: &str, body: Body) -> Request<Body> {
        let method_name = method.as_str().to_owned();
        match Request::builder().method(method).uri(uri).body(body) {
            Ok(request) => request,
            Err(error) => panic!("build request {method_name} {uri}: {error}"),
        }
    }

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

    async fn body_json(response: Response) -> serde_json::Value {
        let body = match to_bytes(response.into_body(), usize::MAX).await {
            Ok(body) => body,
            Err(error) => panic!("read body: {error}"),
        };
        match serde_json::from_slice(&body) {
            Ok(json) => json,
            Err(error) => panic!("parse json: {error}"),
        }
    }

    #[tokio::test]
    async fn healthz_returns_ok_json() {
        let app = router(AppState::new(None));
        let response = match app
            .oneshot(build_request(Method::GET, "/healthz", Body::empty()))
            .await
        {
            Ok(response) => response,
            Err(error) => panic!("healthz request: {error}"),
        };
        assert_eq!(response.status(), StatusCode::OK);
        let json = body_json(response).await;
        assert_eq!(json["status"], "ok");
    }

    #[tokio::test]
    async fn connect_health_returns_serving_ok() {
        let app = router(AppState::new(None));
        let response = match app
            .oneshot(build_connect_request(
                "/puzzled.v1.HealthService/Health",
                Body::from("{}"),
            ))
            .await
        {
            Ok(response) => response,
            Err(error) => panic!("connect health: {error}"),
        };
        assert_eq!(response.status(), StatusCode::OK);
        let json = body_json(response).await;
        // Proto3 JSON enum: name string (buffa) — numeric wire value is 1 (SERVING_STATUS_OK).
        assert!(
            json["status"] == "SERVING_STATUS_OK" || json["status"] == 1,
            "unexpected status: {}",
            json["status"]
        );
        assert_eq!(json["message"], "ok");
    }

    #[tokio::test]
    async fn connect_get_leaderboard_requires_game_slug() {
        let app = router(AppState::new(None));
        let response = match app
            .oneshot(build_connect_request(
                "/puzzled.v1.StatsService/GetLeaderboard",
                Body::from("{}"),
            ))
            .await
        {
            Ok(response) => response,
            Err(error) => panic!("connect GetLeaderboard: {error}"),
        };
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn connect_get_leaderboard_empty_without_db() {
        let app = router(AppState::new(None));
        let response = match app
            .oneshot(build_connect_request(
                "/puzzled.v1.StatsService/GetLeaderboard",
                Body::from(r#"{"gameSlug":"sudoku","type":"LEADERBOARD_TYPE_SCORE","period":"LEADERBOARD_PERIOD_ALL","limit":10}"#),
            ))
            .await
        {
            Ok(response) => response,
            Err(error) => panic!("connect GetLeaderboard: {error}"),
        };
        assert_eq!(response.status(), StatusCode::OK);
        let json = body_json(response).await;
        // ProtoJSON omits empty repeated fields; treat missing as empty.
        assert!(
            json.get("entries").map_or(true, |v| v
                .as_array()
                .is_some_and(|entries| entries.is_empty())),
            "unexpected entries: {:?}",
            json.get("entries")
        );
    }

    #[tokio::test]
    async fn connect_get_puzzle_densifies_sudoku_grid() {
        let app = router(AppState::new(None));
        let response = match app
            .oneshot(build_connect_request(
                "/puzzled.v1.PuzzleService/GetPuzzle",
                Body::from(r#"{"gameSlug":"sudoku","seed":"42","difficulty":"easy"}"#),
            ))
            .await
        {
            Ok(response) => response,
            Err(error) => panic!("connect GetPuzzle: {error}"),
        };
        assert_eq!(response.status(), StatusCode::OK);
        let json = body_json(response).await;
        assert_eq!(json["gameSlug"], "sudoku");
        assert_eq!(json["slice"], "S2-puzzle-connect");
        let puzzle_data = json["puzzleDataJson"]
            .as_str()
            .expect("puzzleDataJson densified");
        assert!(puzzle_data.contains("grid"), "expected densified grid JSON");
        let solution = json["solutionJson"].as_str().expect("solutionJson densified");
        assert!(solution.contains("grid"), "expected densified solution JSON");
    }

    #[tokio::test]
    async fn connect_get_daily_requires_game_slug() {
        let app = router(AppState::new(None));
        let response = match app
            .oneshot(build_connect_request(
                "/puzzled.v1.PuzzleService/GetDaily",
                Body::from("{}"),
            ))
            .await
        {
            Ok(response) => response,
            Err(error) => panic!("connect GetDaily: {error}"),
        };
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn connect_get_daily_densifies_envelope() {
        let app = router(AppState::new(None));
        let response = match app
            .oneshot(build_connect_request(
                "/puzzled.v1.PuzzleService/GetDaily",
                Body::from(r#"{"gameSlug":"sudoku","difficulty":"medium"}"#),
            ))
            .await
        {
            Ok(response) => response,
            Err(error) => panic!("connect GetDaily: {error}"),
        };
        assert_eq!(response.status(), StatusCode::OK);
        let json = body_json(response).await;
        assert_eq!(json["gameSlug"], "sudoku");
        assert_eq!(json["slice"], "S2-daily-connect");
        assert_eq!(json["mode"], "daily");
        assert_eq!(json["canPlay"], true);
        assert!(json["puzzleNumber"].as_u64().unwrap_or(0) > 0);
        assert!(!json["puzzleDate"].as_str().unwrap_or("").is_empty());
        // Sudoku daily densifies puzzle_data from seed generator (not pure residual).
        // ProtoJSON omits false defaults — missing/null means stub=false.
        assert!(
            json.get("stub").map_or(true, |v| v == false || v.is_null()),
            "unexpected stub: {:?}",
            json.get("stub")
        );
        let pd = json["puzzleDataJson"].as_str().unwrap_or("");
        assert!(pd.contains("grid"), "expected densified daily puzzle_data");
    }

    #[tokio::test]
    async fn connect_submit_guess_invalid_without_grid() {
        let app = router(AppState::new(None));
        let response = match app
            .oneshot(build_connect_request(
                "/puzzled.v1.PuzzleService/SubmitGuess",
                Body::from(
                    r#"{"gameSlug":"sudoku","seed":"1","difficulty":"easy","status":"won","attempts":1,"timeSpentMs":"1000","submissionJson":"{}"}"#,
                ),
            ))
            .await
        {
            Ok(response) => response,
            Err(error) => panic!("connect SubmitGuess: {error}"),
        };
        assert_eq!(response.status(), StatusCode::OK);
        let json = body_json(response).await;
        // ProtoJSON may omit valid=false; treat missing as false.
        assert!(
            json.get("valid").map_or(true, |v| v == false || v.is_null()),
            "unexpected valid: {:?}",
            json.get("valid")
        );
        assert_eq!(json["slice"], "S2-puzzle-solution-connect");
        assert!(json["error"].as_str().is_some());
    }

    #[tokio::test]
    async fn readyz_fails_closed_without_database() {
        let app = router(AppState::new(None));
        let response = match app
            .oneshot(build_request(Method::GET, "/readyz", Body::empty()))
            .await
        {
            Ok(response) => response,
            Err(error) => panic!("readyz request: {error}"),
        };
        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        let json = body_json(response).await;
        assert_eq!(json["status"], "not_ready");
        assert_eq!(json["dependencies"][0]["ok"], false);
        assert_eq!(json["dependencies"][0]["required"], true);
    }

    #[tokio::test]
    async fn domain_stub_returns_contract() {
        let app = router(AppState::new(None));
        let response = match app
            .oneshot(build_request(
                Method::GET,
                "/api/leaderboard",
                Body::empty(),
            ))
            .await
        {
            Ok(response) => response,
            Err(error) => panic!("stub request: {error}"),
        };
        assert_eq!(response.status(), StatusCode::OK);
        let json = body_json(response).await;
        assert!(json["entries"]
            .as_array()
            .is_some_and(|entries| entries.is_empty()));
        assert_eq!(json["stub"], true);
    }

    #[tokio::test]
    async fn auth_session_get_returns_unauthenticated_without_credentials() {
        let app = router(AppState::new(None));
        let response = match app
            .oneshot(build_request(
                Method::GET,
                "/api/v1/auth/session",
                Body::empty(),
            ))
            .await
        {
            Ok(response) => response,
            Err(error) => panic!("auth session request: {error}"),
        };
        assert_eq!(response.status(), StatusCode::OK);
        let json = body_json(response).await;
        assert_eq!(json["authenticated"], false);
        assert_eq!(json["session"], serde_json::Value::Null);
        assert_eq!(json["slice"], "auth-sessions");
    }

    #[tokio::test]
    async fn games_index_lists_registered_slugs() {
        let app = router(AppState::new(None));
        let response = match app
            .oneshot(build_request(Method::GET, "/api/v1/games", Body::empty()))
            .await
        {
            Ok(response) => response,
            Err(error) => panic!("games index request: {error}"),
        };
        assert_eq!(response.status(), StatusCode::OK);
        let json = body_json(response).await;
        assert_eq!(json["slice"], "api-v1-hono-monolith");
        let games = json["games"].as_array().expect("games array");
        assert!(games.len() >= 10);
        assert!(games.iter().any(|g| g["slug"] == "sudoku"));
    }

    #[tokio::test]
    async fn stats_leaderboard_invalid_query_returns_empty_array() {
        let app = router(AppState::new(None));
        let response = match app
            .oneshot(build_request(
                Method::GET,
                "/api/v1/stats/leaderboard",
                Body::empty(),
            ))
            .await
        {
            Ok(response) => response,
            Err(error) => panic!("leaderboard request: {error}"),
        };
        assert_eq!(response.status(), StatusCode::OK);
        let json = body_json(response).await;
        assert!(json.as_array().is_some_and(|entries| entries.is_empty()));
    }

    #[tokio::test]
    async fn stats_leaderboard_streak_returns_empty_array_without_db() {
        let app = router(AppState::new(None));
        let response = match app
            .oneshot(build_request(
                Method::GET,
                "/api/v1/stats/leaderboard?gameSlug=sudoku&type=streak",
                Body::empty(),
            ))
            .await
        {
            Ok(response) => response,
            Err(error) => panic!("leaderboard request: {error}"),
        };
        assert_eq!(response.status(), StatusCode::OK);
        let json = body_json(response).await;
        assert!(json.as_array().is_some_and(|entries| entries.is_empty()));
    }
}
