//! Leaderboard read stub — parity target for auth/read slice.
//!
//! S0 does not consult Postgres; it returns an empty leaderboard envelope.

use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LeaderboardStubBody {
    pub entries: Vec<serde_json::Value>,
    pub stub: bool,
}

/// `GET /api/leaderboard` handler.
pub async fn leaderboard_stub() -> Response {
    (
        axum::http::StatusCode::OK,
        Json(LeaderboardStubBody {
            entries: Vec::new(),
            stub: true,
        }),
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn leaderboard_is_empty_stub() {
        let body = LeaderboardStubBody { entries: Vec::new(), stub: true };
        assert!(body.entries.is_empty());
        assert!(body.stub);
    }
}
