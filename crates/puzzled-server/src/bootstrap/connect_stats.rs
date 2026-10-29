//! Native Connect StatsService — technology-stack-profile (buffa + connectrpc).
//! GetLeaderboard densifies via product_db when pool present; honest empty residual otherwise.

use std::sync::Arc;

use buffa::EnumValue;
use chrono::Utc;
use connectrpc::{
    ConnectError, ErrorCode, RequestContext, Response, ServiceRequest, ServiceResult,
};

use super::state::AppState;
use crate::capabilities::leaderboard::adapters::leaderboard_db::{
    fetch_score_leaderboard, LeaderboardPeriod as DbPeriod, LeaderboardQuery,
    LeaderboardType as DbType,
};
use crate::capabilities::stats::adapters::sessions_stats_db::{
    today_overview, today_percentile, user_history_on_connection, user_stats_on_connection,
};
use crate::proto::puzzled::v1::{
    GetHistoryRequest, GetHistoryResponse, GetLeaderboardRequest, GetLeaderboardResponse,
    GetTodayOverviewRequest, GetTodayOverviewResponse, GetTodayPercentileRequest,
    GetTodayPercentileResponse, GetUserStatsRequest, GetUserStatsResponse, LeaderboardEntry,
    LeaderboardPeriod, LeaderboardType, SessionEntry, StatsService, UserGameStats,
};
use puzzled_core::puzzle_play::daily_time::product_day_key_string;
use puzzled_core::puzzle_play::game_slugs::is_valid_game_slug;

#[derive(Clone)]
pub struct StatsConnectService {
    state: AppState,
}

impl StatsConnectService {
    pub fn new(state: AppState) -> Self {
        Self { state }
    }

    async fn adopt_guest_progress_if_needed(
        &self,
        ctx: &RequestContext,
    ) -> Result<crate::bootstrap::identity::RequestAccess, ConnectError> {
        crate::bootstrap::identity::admitted_request_identities(
            ctx,
            self.state.pool.as_ref(),
            false,
        )
        .await
    }
}

fn map_type(value: EnumValue<LeaderboardType>) -> DbType {
    match value.as_known() {
        Some(LeaderboardType::Streak) => DbType::Streak,
        Some(LeaderboardType::Score) | Some(LeaderboardType::Unspecified) | None => DbType::Score,
    }
}

fn map_period(value: EnumValue<LeaderboardPeriod>) -> DbPeriod {
    match value.as_known() {
        Some(LeaderboardPeriod::Today) => DbPeriod::Today,
        Some(LeaderboardPeriod::Week) => DbPeriod::Week,
        Some(LeaderboardPeriod::All) | Some(LeaderboardPeriod::Unspecified) | None => DbPeriod::All,
    }
}

fn clamp_limit(limit: i32) -> i32 {
    if (1..=100).contains(&limit) {
        limit
    } else if limit <= 0 {
        10
    } else {
        100
    }
}

fn to_proto_entry(
    entry: puzzled_core::leaderboard::enrich::LeaderboardEntry,
    viewer_id: Option<&str>,
) -> LeaderboardEntry {
    LeaderboardEntry {
        rank: entry.rank,
        // Wire compatibility: this field now identifies only this response entry.
        // Never derive it from a player id, including by hashing.
        user_id: uuid::Uuid::now_v7().to_string(),
        user_name: entry.user_name,
        // Avatar URLs can contain stable account identifiers. Public rows use initials.
        user_image: None,
        is_viewer: viewer_id.is_some_and(|id| id == entry.user_id.to_string()),
        value: entry.value,
        ..Default::default()
    }
}

// Viewer markers are private response data; public intermediaries must not store them.
fn leaderboard_response(entries: Vec<LeaderboardEntry>) -> ServiceResult<GetLeaderboardResponse> {
    Ok(Response::new(GetLeaderboardResponse {
        entries,
        ..Default::default()
    })
    .with_header("cache-control", "private, no-store, max-age=0")
    .with_header("cdn-cache-control", "no-store"))
}

#[allow(refining_impl_trait_internal, refining_impl_trait_reachable)]
impl StatsService for StatsConnectService {
    async fn get_leaderboard(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, GetLeaderboardRequest>,
    ) -> ServiceResult<GetLeaderboardResponse> {
        let req = request.to_owned_message();
        let game_slug = req.game_slug.trim();
        if game_slug.is_empty() {
            return Err(ConnectError::new(
                ErrorCode::InvalidArgument,
                "game_slug_required",
            ));
        }

        let query = LeaderboardQuery {
            game_slug: game_slug.to_string(),
            leaderboard_type: map_type(req.r#type),
            period: map_period(req.period),
            limit: clamp_limit(req.limit),
        };

        if let Some(pool) = &self.state.pool {
            match fetch_score_leaderboard(pool, &query).await {
                Ok(entries) => {
                    let access = crate::bootstrap::identity::admitted_request_identities(
                        &ctx,
                        self.state.pool.as_ref(),
                        false,
                    )
                    .await?;
                    let viewer_id = access.primary().map(|identity| identity.user_id.as_str());
                    let entries = entries
                        .into_iter()
                        .map(|entry| to_proto_entry(entry, viewer_id))
                        .collect();
                    access.commit().await?;
                    return leaderboard_response(entries);
                }
                Err(error) => {
                    tracing::warn!(
                        %error,
                        game_slug = %query.game_slug,
                        "connect GetLeaderboard product_db failed"
                    );
                }
            }
        }

        // No pool or read failure: honest residual empty board (do not invent scores).
        leaderboard_response(Vec::new())
    }

    async fn get_today_percentile(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, GetTodayPercentileRequest>,
    ) -> ServiceResult<GetTodayPercentileResponse> {
        let req = request.to_owned_message();
        let slug = req.game_slug.trim();
        let day_key = product_day_key_string(Utc::now());
        let mut result = GetTodayPercentileResponse {
            game_slug: slug.into(),
            day_key: day_key.clone(),
            ..Default::default()
        };
        if slug.is_empty() || !is_valid_game_slug(slug) {
            result.dispatch = "invalid_or_empty".into();
        } else if !req.day_key.is_empty() && req.day_key != day_key {
            result.dispatch = "different_day".into();
        } else if self.state.pool.is_none() {
            result.stub = true;
            result.dispatch = "unavailable_data".into();
        } else {
            // This uses the same admitted cookie/account and adoption transaction
            // as accepted play. Supplied scores, status, and fixture counts are
            // legacy wire fields only and can never establish a finish.
            let mut access = self.adopt_guest_progress_if_needed(&ctx).await?;
            let uid = access.primary().map(|identity| identity.user_id.clone());
            let read = match access.connection() {
                Some(connection) => {
                    today_percentile(connection, &day_key, slug, uid.as_deref()).await
                }
                None => {
                    let pool = self.state.pool.as_ref().ok_or_else(|| {
                        ConnectError::new(ErrorCode::Internal, "stats_pool_missing")
                    })?;
                    let mut connection = pool.acquire().await.map_err(|_| {
                        ConnectError::new(ErrorCode::Unavailable, "stats_unavailable")
                    })?;
                    today_percentile(&mut connection, &day_key, slug, None).await
                }
            };
            match read {
                Ok(read) => {
                    result.percentile = read.percentile;
                    result.total_players = read.total;
                    result.stub = read.dispatch == "unavailable_data";
                    result.dispatch = read.dispatch.into();
                }
                Err(error) => {
                    tracing::warn!(%error, game_slug = slug, "today percentile read failed");
                    result.stub = true;
                    result.dispatch = "unavailable_data".into();
                }
            }
            access.commit().await?;
        }
        Ok(Response::new(result)
            .with_header("cache-control", "private, no-store, max-age=0")
            .with_header("cdn-cache-control", "no-store"))
    }
    async fn get_today_overview(
        &self,
        _ctx: RequestContext,
        _request: ServiceRequest<'_, GetTodayOverviewRequest>,
    ) -> ServiceResult<GetTodayOverviewResponse> {
        let day_key = product_day_key_string(Utc::now());
        let (player_count, completions) = match &self.state.pool {
            Some(pool) => today_overview(pool, &day_key).await.map_err(|e| {
                tracing::warn!(%e, "today overview failed");
                ConnectError::new(ErrorCode::Internal, "today_overview_failed")
            })?,
            None => (0, Vec::new()),
        };
        let completions_proto = completions
            .iter()
            .map(|c| crate::proto::puzzled::v1::GameCompletionCount {
                game_slug: c
                    .get("gameSlug")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                count: c.get("count").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                ..Default::default()
            })
            .collect();
        Response::ok(GetTodayOverviewResponse {
            player_count,
            completions: completions_proto,
            ..Default::default()
        })
    }

    async fn get_user_stats(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, GetUserStatsRequest>,
    ) -> ServiceResult<GetUserStatsResponse> {
        let mut access = self.adopt_guest_progress_if_needed(&ctx).await?;
        let identity = access.primary().cloned().ok_or_else(|| {
            ConnectError::new(ErrorCode::Unauthenticated, "identity_required_for_submit")
        })?;
        let req = request.to_owned_message();
        let (games, total_played, total_won) = match access.connection() {
            Some(connection) => user_stats_on_connection(connection, &identity.user_id)
                .await
                .map_err(|e| {
                    tracing::warn!(%e, "user stats read failed");
                    ConnectError::new(ErrorCode::Internal, "user_stats_read_failed")
                })?,
            None => (Vec::new(), 0, 0),
        };
        let games_proto: Vec<UserGameStats> = games
            .iter()
            .map(|g| UserGameStats {
                game_slug: g
                    .get("gameSlug")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                games_played: g.get("gamesPlayed").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                games_won: g.get("gamesWon").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                best_score: g.get("bestScore").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                ..Default::default()
            })
            .collect();
        let _ = req;
        access.commit().await?;
        Response::ok(GetUserStatsResponse {
            games: games_proto,
            total_played,
            total_won,
            ..Default::default()
        })
    }

    async fn get_history(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, GetHistoryRequest>,
    ) -> ServiceResult<GetHistoryResponse> {
        let mut access = self.adopt_guest_progress_if_needed(&ctx).await?;
        let identity = access.primary().cloned().ok_or_else(|| {
            ConnectError::new(ErrorCode::Unauthenticated, "identity_required_for_submit")
        })?;
        let req = request.to_owned_message();
        let slug = (!req.game_slug.trim().is_empty()).then(|| req.game_slug.trim().to_string());
        let rows = match access.connection() {
            Some(connection) => user_history_on_connection(
                connection,
                &identity.user_id,
                slug.as_deref(),
                req.limit,
            )
            .await
            .map_err(|e| {
                tracing::warn!(%e, "history read failed");
                ConnectError::new(ErrorCode::Internal, "history_read_failed")
            })?,
            None => Vec::new(),
        };
        let sessions: Vec<SessionEntry> = rows
            .iter()
            .map(|r| SessionEntry {
                game_slug: r
                    .get("gameSlug")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                puzzle_id: r
                    .get("puzzleId")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                puzzle_date: r
                    .get("puzzleDate")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                status: r
                    .get("status")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                score: r.get("score").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                attempts: r.get("attempts").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                time_spent_ms: r.get("timeSpentMs").and_then(|v| v.as_u64()).unwrap_or(0),
                mode: r
                    .get("mode")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                ..Default::default()
            })
            .collect();
        access.commit().await?;
        Response::ok(GetHistoryResponse {
            sessions,
            ..Default::default()
        })
    }
}

pub fn stats_connect_service(state: AppState) -> Arc<StatsConnectService> {
    Arc::new(StatsConnectService::new(state))
}

#[cfg(test)]
mod public_disclosure_tests {
    use super::*;

    #[test]
    fn public_entries_do_not_disclose_or_reuse_player_identifiers() {
        let id = uuid::Uuid::from_u128(1);
        let row = puzzled_core::leaderboard::enrich::LeaderboardEntry {
            rank: 2,
            user_id: id,
            user_name: Some("Player".into()),
            user_image: Some(format!("https://avatars.invalid/{id}")),
            value: 700,
        };
        let a = to_proto_entry(row.clone(), Some(&id.to_string()));
        let b = to_proto_entry(row, None);
        assert_ne!(a.user_id, id.to_string());
        assert_ne!(a.user_id, b.user_id);
        assert!(a.user_image.is_none());
        assert!(a.is_viewer);
        assert!(!b.is_viewer);
        assert_eq!(
            (a.rank, a.value, a.user_name.as_deref()),
            (2, 700, Some("Player"))
        );
        let response = leaderboard_response(vec![a]).unwrap();
        assert_eq!(
            response.headers["cache-control"],
            "private, no-store, max-age=0"
        );
        assert_eq!(response.headers["cdn-cache-control"], "no-store");
    }
}
