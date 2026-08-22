//! Native Connect GamificationService (ADR-170). Identity from the Bearer JWT
//! or guest day id; client-supplied user ids are never trusted.

use std::sync::Arc;

use connectrpc::{
    ConnectError, ErrorCode, RequestContext, Response, ServiceRequest, ServiceResult,
};

use super::identity::{
    require_admin, require_identity, require_identity_or_guest, resolve_request_identities,
};
use super::state::AppState;
use crate::capabilities::gamification::adapters::freezes_db::{
    load_freezes_available, upsert_freeze_data,
};
use crate::capabilities::gamification::adapters::streak_sessions_db::load_accepted_ritual_days;
use crate::capabilities::gamification::interfaces::gamification_api::{
    add_streak_freezes, project_personal_streak, require_streak_store, try_auto_freeze, FreezeData,
    FreezeReason, StreakReadError,
};
use crate::capabilities::puzzle_play::adapters::game_sessions_db::{
    adopt_guest_sessions, count_sessions,
};
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
        let identities = resolve_request_identities(ctx);
        let Some((account_user_id, guest_user_id)) = identities.adoption_pair() else {
            return Ok(());
        };
        adopt_guest_sessions(pool, account_user_id, guest_user_id)
            .await
            .map_err(|error| {
                tracing::warn!(%error, "guest progress adoption failed");
                ConnectError::new(ErrorCode::Internal, "guest_progress_adopt_failed")
            })?;
        Ok(())
    }

    async fn load_freeze(&self, user_id: &str) -> FreezeData {
        let mut data = FreezeData::new(user_id);
        if let Some(pool) = &self.state.pool {
            match load_freezes_available(pool, user_id).await {
                Ok(available) => data.freezes_available = available,
                Err(error) => tracing::warn!(%error, "freeze load failed"),
            }
        }
        data
    }

    async fn load_personal_streak(
        &self,
        user_id: &str,
    ) -> Result<(PersonalStreak, u32), ConnectError> {
        let pool = require_streak_store(self.state.pool.as_ref()).map_err(map_streak_error)?;
        let today = product_day_key(Utc::now());
        let days = load_accepted_ritual_days(pool, user_id).await;
        let total = count_sessions(pool, user_id).await;
        let read = match (days, total) {
            (Ok(days), Ok(total)) => Ok((days, total)),
            (Err(error), _) => {
                tracing::warn!(%error, "personal streak days lookup failed");
                Err(error)
            }
            (_, Err(error)) => {
                tracing::warn!(%error, "streak total lookup failed");
                Err(error)
            }
        };
        project_personal_streak(today, read).map_err(map_streak_error)
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
        let identity = require_identity_or_guest(&ctx)?;
        let (streak, total) = self.load_personal_streak(&identity.user_id).await?;
        let freeze = self.load_freeze(&identity.user_id).await;
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
        let mut freeze = self.load_freeze(&identity.user_id).await;
        freeze.auto_freeze_enabled = req.enabled;
        if let Some(pool) = &self.state.pool {
            if let Err(error) = upsert_freeze_data(
                pool,
                &freeze.user_id,
                freeze.freezes_available,
                freeze.freezes_used,
                freeze.auto_freeze_enabled,
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
        let (streak, total) = self.load_personal_streak(&identity.user_id).await?;
        Response::ok(ToggleAutoFreezeResponse {
            info: self.to_info(&freeze, streak, total).into(),
            ..Default::default()
        })
    }

    async fn try_auto_freeze(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, TryAutoFreezeRequest>,
    ) -> ServiceResult<TryAutoFreezeResponse> {
        let identity = require_identity(&ctx)?;
        let req = request.to_owned_message();
        let mut freeze = self.load_freeze(&identity.user_id).await;
        let (used, updated) = try_auto_freeze(freeze.clone(), req.is_premium);
        freeze = updated;
        if used {
            if let Some(pool) = &self.state.pool {
                if let Err(error) = upsert_freeze_data(
                    pool,
                    &freeze.user_id,
                    freeze.freezes_available,
                    freeze.freezes_used,
                    freeze.auto_freeze_enabled,
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
        }
        let (streak, total) = self.load_personal_streak(&identity.user_id).await?;
        Response::ok(TryAutoFreezeResponse {
            used_freeze: used,
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
        let mut freeze = self.load_freeze(&req.user_id).await;
        let (updated, _) = add_streak_freezes(freeze.clone(), req.count as i32, &req.reason)
            .map_err(|e| ConnectError::new(ErrorCode::InvalidArgument, format!("{e:?}")))?;
        freeze = updated;
        if let Some(pool) = &self.state.pool {
            if let Err(error) = upsert_freeze_data(
                pool,
                &freeze.user_id,
                freeze.freezes_available,
                freeze.freezes_used,
                freeze.auto_freeze_enabled,
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
        let (streak, total) = self.load_personal_streak(&req.user_id).await?;
        Response::ok(AddStreakFreezesResponse {
            info: self.to_info(&freeze, streak, total).into(),
            ..Default::default()
        })
    }
}

pub fn gamification_connect_service(state: AppState) -> Arc<GamificationConnectService> {
    Arc::new(GamificationConnectService::new(state))
}
