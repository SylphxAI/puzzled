//! Puzzled product API shell (ADR-169).
//!
//! Imperative shell: HTTP interfaces, SQL/JWT adapters, composition root.
//! Domain decisions live in `puzzled-core`.

pub mod bootstrap;
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
