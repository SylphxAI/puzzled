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

    fn mint_test_token(sub: &str) -> String {
        use jsonwebtoken::{encode, EncodingKey, Header as JwtHeader};
        let priv_pem = include_str!("../testdata/platform_jwt_test_priv.pem");
        let pub_pem = include_str!("../testdata/platform_jwt_test_pub.pem");
        // Serialize against platform_jwt tests that install/clear the key.
        let _g = crate::capabilities::identity_access::adapters::platform_jwt::test_key_lock()
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        crate::capabilities::identity_access::adapters::platform_jwt::install_test_decoding_key_pem(
            pub_pem,
        )
        .expect("install test key");
        #[derive(serde::Serialize)]
        struct MintClaims {
            sub: String,
            name: String,
            exp: i64,
        }
        let claims = MintClaims {
            sub: sub.to_string(),
            name: "Test User".to_string(),
            exp: chrono::Utc::now().timestamp() + 3600,
        };
        let key = EncodingKey::from_rsa_pem(priv_pem.as_bytes()).expect("enc key");
        encode(
            &JwtHeader::new(jsonwebtoken::Algorithm::RS256),
            &claims,
            &key,
        )
        .expect("mint")
    }

    fn build_connect_request_with_auth(uri: &str, body: Body, token: &str) -> Request<Body> {
        match Request::builder()
            .method(Method::POST)
            .uri(uri)
            .header(axum::http::header::CONTENT_TYPE, "application/json")
            .header(axum::http::header::AUTHORIZATION, format!("Bearer {token}"))
            .body(body)
        {
            Ok(request) => request,
            Err(error) => panic!("build connect request {uri}: {error}"),
        }
    }

    fn today_free_slug() -> String {
        let today = puzzled_core::puzzle_play::daily_time::product_day_key(chrono::Utc::now());
        puzzled_core::puzzle_play::game_slugs::todays_free_game(today).to_string()
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
    async fn connect_get_daily_denies_non_rotation_game_without_premium() {
        // Platform billing is unreachable in tests -> non-premium; only the
        // free-rotation game is playable (fail-closed gate).
        let app = router(AppState::new(None));
        let token = mint_test_token("user_free_01");
        let response = match app
            .oneshot(build_connect_request_with_auth(
                "/puzzled.v1.PuzzleService/GetDaily",
                Body::from(r#"{"gameSlug":"arithmo","difficulty":"medium"}"#),
                &token,
            ))
            .await
        {
            Ok(response) => response,
            Err(error) => panic!("connect GetDaily premium gate: {error}"),
        };
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
    }

    #[tokio::test]
    async fn connect_get_daily_denies_archive_without_premium() {
        let app = router(AppState::new(None));
        let token = mint_test_token("user_free_02");
        let free_slug = today_free_slug();
        let body = format!(r#"{{"gameSlug":"{free_slug}","puzzleDate":"2020-01-01"}}"#);
        let response = match app
            .oneshot(build_connect_request_with_auth(
                "/puzzled.v1.PuzzleService/GetDaily",
                Body::from(body),
                &token,
            ))
            .await
        {
            Ok(response) => response,
            Err(error) => panic!("connect GetDaily archive gate: {error}"),
        };
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
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
        assert!(
            json.get("solutionJson").is_none(),
            "solutions must never leave the server"
        );
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
        // Day-agnostic: use today's free-rotation game (guests may play it).
        let free_slug = today_free_slug();
        let app = router(AppState::new(None));
        let body = format!(r#"{{"gameSlug":"{free_slug}","difficulty":"medium"}}"#);
        let response = match app
            .oneshot(build_connect_request(
                "/puzzled.v1.PuzzleService/GetDaily",
                Body::from(body),
            ))
            .await
        {
            Ok(response) => response,
            Err(error) => panic!("connect GetDaily: {error}"),
        };
        assert_eq!(response.status(), StatusCode::OK);
        let json = body_json(response).await;
        assert_eq!(json["gameSlug"], free_slug);
        assert_eq!(json["slice"], "S2-daily-connect");
        assert_eq!(json["mode"], "daily");
        assert_eq!(json["canPlay"], true);
        assert!(json["puzzleNumber"].as_u64().unwrap_or(0) > 0);
        assert!(!json["puzzleDate"].as_str().unwrap_or("").is_empty());
        // Without a DB, only sudoku has on-server generation; other games are
        // served from the content store and report stub=true until populated.
        if free_slug == "sudoku" {
            assert!(
                json.get("stub").map_or(true, |v| v == false || v.is_null()),
                "unexpected stub: {:?}",
                json.get("stub")
            );
        }
    }

    #[tokio::test]
    async fn connect_submit_guess_requires_identity() {
        let app = router(AppState::new(None));
        let response = match app
            .oneshot(build_connect_request(
                "/puzzled.v1.PuzzleService/SubmitGuess",
                Body::from(
                    r#"{"gameSlug":"sudoku","difficulty":"easy","status":"won","attempts":1,"timeSpentMs":"1000","submissionJson":"{}"}"#,
                ),
            ))
            .await
        {
            Ok(response) => response,
            Err(error) => panic!("connect SubmitGuess: {error}"),
        };
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn connect_submit_guess_validates_against_served_puzzle() {
        let app = router(AppState::new(None));
        let token = mint_test_token("user_test_01");
        let free_slug = today_free_slug();
        // When sudoku is not today's free game the premium gate returns 403
        // before validation; when it is, the empty submission must be invalid.
        let body = format!(
            r#"{{"gameSlug":"{free_slug}","difficulty":"easy","status":"won","attempts":1,"timeSpentMs":"1000","submissionJson":"{{}}"}}"#
        );
        let response = match app
            .oneshot(build_connect_request_with_auth(
                "/puzzled.v1.PuzzleService/SubmitGuess",
                Body::from(body),
                &token,
            ))
            .await
        {
            Ok(response) => response,
            Err(error) => panic!("connect SubmitGuess: {error}"),
        };
        if free_slug == "sudoku" {
            assert_eq!(response.status(), StatusCode::OK);
            let json = body_json(response).await;
            assert!(
                json.get("valid")
                    .map_or(true, |v| v == false || v.is_null()),
                "expected invalid verdict, got: {:?}",
                json.get("valid")
            );
            assert_eq!(json["slice"], "S2-puzzle-solution-connect");
        } else {
            // Free today, but no content store in tests -> unserved puzzle.
            assert_eq!(response.status(), StatusCode::NOT_FOUND);
        }
    }

    #[tokio::test]
    async fn connect_submit_guess_rejects_unserved_puzzle() {
        // Free-rotation game passes the premium gate. Without a content DB:
        // - sudoku may still densify via deterministic server generation
        // - other modules must fail closed (404 unserved) — no accept-any.
        let app = router(AppState::new(None));
        let token = mint_test_token("user_test_02");
        let free_slug = today_free_slug();
        let body = format!(
            r#"{{"gameSlug":"{free_slug}","status":"won","attempts":3,"timeSpentMs":"1200","submissionJson":"{{\"guesses\":[\"HELLO\"]}}"}}"#
        );
        let response = match app
            .oneshot(build_connect_request_with_auth(
                "/puzzled.v1.PuzzleService/SubmitGuess",
                Body::from(body),
                &token,
            ))
            .await
        {
            Ok(response) => response,
            Err(error) => panic!("connect SubmitGuess non-sudoku: {error}"),
        };
        if free_slug == "sudoku" {
            assert_eq!(response.status(), StatusCode::OK);
            let json = body_json(response).await;
            assert!(
                json.get("valid")
                    .map_or(true, |v| v == false || v.is_null()),
                "expected invalid verdict for unsound sudoku submit, got: {:?}",
                json.get("valid")
            );
        } else {
            assert_eq!(response.status(), StatusCode::NOT_FOUND);
        }
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

    #[test]
    fn product_day_key_ssot_and_drc_oracle_recipe() {
        use puzzled_core::puzzle_play::daily_time::{
            product_day_key, product_day_key_string, DAY_KEY_TIMEZONE,
        };
        use puzzled_core::puzzle_play::game_slugs::ModuleClass;
        use puzzled_core::puzzle_play::ritual_completion::{
            compute_drc, qualifies_as_ritual, RitualCompletionRow, RitualQualifyInput,
            DRC_RECOMPUTE_SQL,
        };

        assert_eq!(DAY_KEY_TIMEZONE, "Asia/Hong_Kong");
        let now = chrono::Utc::now();
        let key = product_day_key_string(now);
        assert_eq!(key.len(), 10);
        assert_eq!(product_day_key(now).format("%Y-%m-%d").to_string(), key);
        assert!(qualifies_as_ritual(RitualQualifyInput {
            game_module_id: "sudoku",
            mode: "daily",
            status: "won",
            is_dry_run: false,
        }));
        assert!(!qualifies_as_ritual(RitualQualifyInput {
            game_module_id: "sudoku",
            mode: "archive",
            status: "won",
            is_dry_run: false,
        }));
        let rows = [RitualCompletionRow {
            user_id: "u1".into(),
            day_key: key.clone(),
            module_class: ModuleClass::PuzzleRitual,
            is_ritual: true,
        }];
        assert_eq!(compute_drc(&key, &rows), 1);
        assert!(DRC_RECOMPUTE_SQL.contains("is_ritual"));
    }

    /// Dogfood residual (live tip ff366b48): re-SubmitGuess without stored
    /// puzzle_id returned 200 valid:true and inserted a second game_sessions
    /// row. Guard must run for daily content day even when pid is None.
    #[test]
    fn submit_already_played_guard_not_gated_on_puzzle_id() {
        use puzzled_core::puzzle_play::ritual_completion::{
            ritual_already_finished, submit_must_guard_already_played, RitualCompletionRow,
        };
        use puzzled_core::puzzle_play::game_slugs::ModuleClass;

        assert!(
            submit_must_guard_already_played(true, None, true),
            "store + content day known => guard even without puzzle_id"
        );
        let prior = [RitualCompletionRow {
            user_id: "f715210b-9df3-4945-b5bd-94fc4609bc30".into(),
            day_key: "2026-08-12".into(),
            module_class: ModuleClass::PuzzleRitual,
            is_ritual: true,
        }];
        assert!(ritual_already_finished(
            &prior,
            "f715210b-9df3-4945-b5bd-94fc4609bc30",
            "2026-08-12",
            "sudoku",
        ));
    }
}
