//! Leaderboard read handlers — ADR-168 S1 parity with stats routes.

use axum::extract::{Query, State};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Deserialize;
use serde::Serialize;

use crate::leaderboard_db::{fetch_score_leaderboard, LeaderboardEntry, LeaderboardQuery};
use crate::AppState;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LeaderboardStubBody {
    pub entries: Vec<serde_json::Value>,
    pub stub: bool,
}

#[derive(Debug, Deserialize)]
pub struct LeaderboardParams {
    #[serde(rename = "gameSlug")]
    pub game_slug: Option<String>,
    #[serde(rename = "type")]
    pub leaderboard_type: Option<String>,
    pub period: Option<String>,
    pub limit: Option<String>,
}

/// `GET /api/leaderboard` — compatibility envelope.
///
/// When Postgres is connected, returns live score entries (`stub: false`). Without a
/// pool, preserves the S0 empty stub envelope so smoke/probes stay stable offline.
pub async fn leaderboard_stub(
    State(state): State<AppState>,
    Query(params): Query<LeaderboardParams>,
) -> Response {
    let Some(pool) = &state.pool else {
        return (
            axum::http::StatusCode::OK,
            Json(LeaderboardStubBody {
                entries: Vec::new(),
                stub: true,
            }),
        )
            .into_response();
    };

    let parsed = LeaderboardQuery::from_params(
        params.game_slug.as_deref().or(Some("sudoku")),
        params.leaderboard_type.as_deref().or(Some("score")),
        params.period.as_deref().or(Some("all")),
        params.limit.as_deref().or(Some("10")),
    );

    let Some(query) = parsed else {
        return (
            axum::http::StatusCode::OK,
            Json(serde_json::json!({
                "entries": [],
                "stub": false,
                "slice": "S1",
            })),
        )
            .into_response();
    };

    match fetch_score_leaderboard(pool, &query).await {
        Ok(entries) => (
            axum::http::StatusCode::OK,
            Json(serde_json::json!({
                "entries": entries,
                "stub": false,
                "slice": "S1",
                "gameSlug": query.game_slug,
            })),
        )
            .into_response(),
        Err(error) => {
            tracing::error!(%error, "compat /api/leaderboard read failed");
            (
                axum::http::StatusCode::OK,
                Json(serde_json::json!({
                    "entries": [],
                    "stub": false,
                    "slice": "S1",
                    "error": "leaderboard_read_failed",
                })),
            )
                .into_response()
        }
    }
}

/// `GET /api/v1/stats/leaderboard` — drop-in parity with Hono stats route.
pub async fn stats_leaderboard(
    State(state): State<AppState>,
    Query(params): Query<LeaderboardParams>,
) -> Response {
    let parsed = LeaderboardQuery::from_params(
        params.game_slug.as_deref(),
        params.leaderboard_type.as_deref(),
        params.period.as_deref(),
        params.limit.as_deref(),
    );

    let Some(query) = parsed else {
        return Json(Vec::<LeaderboardEntry>::new()).into_response();
    };

    let Some(pool) = &state.pool else {
        return Json(Vec::<LeaderboardEntry>::new()).into_response();
    };

    match fetch_score_leaderboard(pool, &query).await {
        Ok(entries) => Json(entries).into_response(),
        Err(error) => {
            tracing::error!(%error, game_slug = %query.game_slug, "leaderboard read failed");
            Json(Vec::<LeaderboardEntry>::new()).into_response()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn leaderboard_is_empty_stub() {
        let body = LeaderboardStubBody {
            entries: Vec::new(),
            stub: true,
        };
        assert!(body.entries.is_empty());
        assert!(body.stub);
    }
}
