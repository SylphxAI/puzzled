//! Native Connect GamificationService (ADR-170). Identity from the Bearer JWT
//! or guest day id; client-supplied user ids are never trusted.

use std::sync::Arc;

use connectrpc::{
    ConnectError, ErrorCode, RequestContext, Response, ServiceRequest, ServiceResult,
};

use super::identity::{
    require_admin, require_identity, require_admitted_identity_or_guest, admitted_request_identities,
};
use super::state::AppState;
use crate::capabilities::gamification::adapters::freezes_db::{
    load_freeze_row, upsert_freeze_data,
};
use crate::capabilities::gamification::adapters::streak_read::load_settled_streak;
use crate::capabilities::gamification::interfaces::gamification_api::{
    add_streak_freezes, require_streak_store, FreezeData, FreezeReason, StreakReadError,
};
use crate::capabilities::puzzle_play::adapters::game_sessions_db::adopt_guest_sessions;
use crate::proto::puzzled::v1::{
    AddStreakFreezesRequest, AddStreakFreezesResponse, GamificationService, GetStreakInfoRequest,
    GetStreakInfoResponse, StreakInfo, ToggleAutoFreezeRequest, ToggleAutoFreezeResponse,
    TryAutoFreezeRequest, TryAutoFreezeResponse,
};
use chrono::Utc;
use puzzled_core::gamification::personal_streak::PersonalStreak;
use puzzled_core::puzzle_play::daily_time::product_day_key;

#[derive(Clone)]
pub struct GamificationConnectService {
    state: AppState,
}

impl GamificationConnectService {
    pub fn new(state: AppState) -> Self {
        Self { state }
    }

    async fn adopt_guest_progress_if_needed(
        &self,
        ctx: &RequestContext,
    ) -> Result<(), ConnectError> {
        let Some(pool) = &self.state.pool else {
            return Ok(());
        };
        let identities = admitted_request_identities(ctx, Some(pool)).await?;
        let Some((_account_user_id, guest_user_id)) = identities.adoption_pair() else {
            return Ok(());
        };
        adopt_guest_sessions(pool, identities.platform.as_ref().ok_or_else(|| ConnectError::new(ErrorCode::NotFound, "identity_not_found"))?, guest_user_id, crate::bootstrap::identity::guest_credential_hash(ctx).ok_or_else(|| ConnectError::new(ErrorCode::NotFound, "identity_not_found"))?)
            .await
            .map_err(|error| {
                tracing::warn!(%error, "guest progress adoption failed");
                ConnectError::new(ErrorCode::NotFound, "identity_not_found")
            })?;
        Ok(())
    }

    /// The player's streak with freezes settled: milestones earned since the
    /// last read are granted and a missed day a held freeze covers is recorded,
    /// so every response (and the next) shows the same run.
    async fn load_personal_streak(
        &self,
        user_id: &str,
    ) -> Result<(PersonalStreak, u32, FreezeData), ConnectError> {
        let pool = require_streak_store(self.state.pool.as_ref()).map_err(map_streak_error)?;
        let today = product_day_key(Utc::now());
        let read = load_settled_streak(pool, user_id, today).await;
        let (streak, total, row) = match read {
            Ok(read) => read,
            Err(error) => {
                tracing::warn!(%error, "personal streak lookup failed");
                return Err(map_streak_error(StreakReadError::ReadFailed));
            }
        };
        let mut freeze = FreezeData::new(user_id);
        freeze.freezes_available = row.available;
        freeze.freezes_used = row.used;
        freeze.auto_freeze_enabled = row.auto_enabled;
        Ok((streak, total, freeze))
    }

    fn to_info(
        &self,
        freeze: &FreezeData,
        streak: PersonalStreak,
        total_played: u32,
    ) -> StreakInfo {
        StreakInfo {
            current_streak: streak.current_streak,
            max_streak: streak.max_streak,
            has_played_today: streak.has_played_today,
            total_games_played: total_played,
            freezes_available: freeze.freezes_available.max(0) as u32,
            auto_freeze_enabled: freeze.auto_freeze_enabled,
            days_until_next_freeze: streak.days_until_next_freeze,
            freeze_used_yesterday: streak.freeze_used_yesterday,
            ..Default::default()
        }
    }
}

fn map_streak_error(error: StreakReadError) -> ConnectError {
    match error {
        StreakReadError::StoreUnavailable => {
            ConnectError::new(ErrorCode::Internal, "streak_store_unavailable")
        }
        StreakReadError::ReadFailed => ConnectError::new(ErrorCode::Internal, "streak_read_failed"),
    }
}

#[allow(refining_impl_trait_internal, refining_impl_trait_reachable)]
impl GamificationService for GamificationConnectService {
    async fn get_streak_info(
        &self,
        ctx: RequestContext,
        _request: ServiceRequest<'_, GetStreakInfoRequest>,
    ) -> ServiceResult<GetStreakInfoResponse> {
        self.adopt_guest_progress_if_needed(&ctx).await?;
        let identity = require_admitted_identity_or_guest(&ctx, self.state.pool.as_ref()).await?;
        let (streak, total, freeze) = self.load_personal_streak(&identity.user_id).await?;
        Response::ok(GetStreakInfoResponse {
            info: self.to_info(&freeze, streak, total).into(),
            ..Default::default()
        })
    }

    async fn toggle_auto_freeze(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, ToggleAutoFreezeRequest>,
    ) -> ServiceResult<ToggleAutoFreezeResponse> {
        let identity = require_identity(&ctx)?;
        let req = request.to_owned_message();
        if let Some(pool) = &self.state.pool {
            let row = load_freeze_row(pool, &identity.user_id)
                .await
                .map_err(|error| {
                    tracing::warn!(%error, "freeze load failed");
                    ConnectError::new(ErrorCode::Internal, "freeze_update_failed")
                })?;
            upsert_freeze_data(
                pool,
                &identity.user_id,
                row.available,
                row.used,
                req.enabled,
            )
            .await
            .map_err(|error| {
                tracing::warn!(%error, "freeze upsert failed");
                ConnectError::new(ErrorCode::Internal, "freeze_update_failed")
            })?;
        }
        let (streak, total, freeze) = self.load_personal_streak(&identity.user_id).await?;
        Response::ok(ToggleAutoFreezeResponse {
            info: self.to_info(&freeze, streak, total).into(),
            ..Default::default()
        })
    }

    /// Freezes are applied automatically when the streak is read, so this
    /// settles and reports whether a freeze covered yesterday. `is_premium`
    /// no longer matters: freezes are earned by play.
    async fn try_auto_freeze(
        &self,
        ctx: RequestContext,
        _request: ServiceRequest<'_, TryAutoFreezeRequest>,
    ) -> ServiceResult<TryAutoFreezeResponse> {
        let identity = require_identity(&ctx)?;
        let (streak, total, freeze) = self.load_personal_streak(&identity.user_id).await?;
        Response::ok(TryAutoFreezeResponse {
            used_freeze: streak.freeze_used_yesterday,
            info: self.to_info(&freeze, streak, total).into(),
            ..Default::default()
        })
    }

    async fn add_streak_freezes(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, AddStreakFreezesRequest>,
    ) -> ServiceResult<AddStreakFreezesResponse> {
        require_admin(&ctx)?;
        let req = request.to_owned_message();
        FreezeReason::parse(&req.reason).ok_or_else(|| {
            ConnectError::new(ErrorCode::InvalidArgument, "invalid_freeze_reason")
        })?;
        let mut freeze = FreezeData::new(&req.user_id);
        if let Some(pool) = &self.state.pool {
            let row = load_freeze_row(pool, &req.user_id).await.map_err(|error| {
                tracing::warn!(%error, "freeze load failed");
                ConnectError::new(ErrorCode::Internal, "freeze_update_failed")
            })?;
            freeze.freezes_available = row.available;
            freeze.freezes_used = row.used;
            freeze.auto_freeze_enabled = row.auto_enabled;
        }
        let (updated, _) = add_streak_freezes(freeze.clone(), req.count as i32, &req.reason)
            .map_err(|e| ConnectError::new(ErrorCode::InvalidArgument, format!("{e:?}")))?;
        if let Some(pool) = &self.state.pool {
            if let Err(error) = upsert_freeze_data(
                pool,
                &updated.user_id,
                updated.freezes_available,
                updated.freezes_used,
                updated.auto_freeze_enabled,
            )
            .await
            {
                tracing::warn!(%error, "freeze upsert failed");
                return Err(ConnectError::new(
                    ErrorCode::Internal,
                    "freeze_update_failed",
                ));
            }
        }
        let (streak, total, freeze) = self.load_personal_streak(&req.user_id).await?;
        Response::ok(AddStreakFreezesResponse {
            info: self.to_info(&freeze, streak, total).into(),
            ..Default::default()
        })
    }
}

pub fn gamification_connect_service(state: AppState) -> Arc<GamificationConnectService> {
    Arc::new(GamificationConnectService::new(state))
}
