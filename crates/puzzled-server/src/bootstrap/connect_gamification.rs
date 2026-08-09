//! Native Connect GamificationService (ADR-170). Identity from the Bearer JWT;
//! client-supplied user ids are never trusted.

use std::sync::Arc;

use connectrpc::{
    ConnectError, ErrorCode, RequestContext, Response, ServiceRequest, ServiceResult,
};

use super::identity::{require_admin, require_identity};
use super::state::AppState;
use crate::capabilities::gamification::adapters::freezes_db::{
    load_freezes_available, upsert_freeze_data,
};
use crate::capabilities::gamification::interfaces::gamification_api::{
    add_streak_freezes, try_auto_freeze, FreezeData, FreezeReason,
};
use crate::capabilities::puzzle_play::adapters::game_sessions_db::has_completed_session;
use crate::proto::puzzled::v1::{
    AddStreakFreezesRequest, AddStreakFreezesResponse, GamificationService, GetStreakInfoRequest,
    GetStreakInfoResponse, StreakInfo, ToggleAutoFreezeRequest, ToggleAutoFreezeResponse,
    TryAutoFreezeRequest, TryAutoFreezeResponse,
};
use chrono::Utc;
use puzzled_core::puzzle_play::daily_time::get_today_utc;

#[derive(Clone)]
pub struct GamificationConnectService {
    state: AppState,
}

impl GamificationConnectService {
    pub fn new(state: AppState) -> Self {
        Self { state }
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

    fn to_info(
        &self,
        freeze: &FreezeData,
        has_played_today: bool,
        total_played: u32,
    ) -> StreakInfo {
        StreakInfo {
            current_streak: 0,
            max_streak: 0,
            has_played_today,
            total_games_played: total_played,
            freezes_available: freeze.freezes_available.max(0) as u32,
            auto_freeze_enabled: freeze.auto_freeze_enabled,
            ..Default::default()
        }
    }
}

#[allow(refining_impl_trait_internal, refining_impl_trait_reachable)]
impl GamificationService for GamificationConnectService {
    async fn get_streak_info(
        &self,
        ctx: RequestContext,
        _request: ServiceRequest<'_, GetStreakInfoRequest>,
    ) -> ServiceResult<GetStreakInfoResponse> {
        let identity = require_identity(&ctx)?;
        let today = get_today_utc(Utc::now());
        let (played_today, total) = match &self.state.pool {
            Some(pool) => {
                let played = match has_completed_session(
                    pool,
                    &identity.user_id,
                    "word-guess",
                    Some(today),
                    None,
                )
                .await
                {
                    Ok(v) => v,
                    Err(error) => {
                        tracing::warn!(%error, "streak played-today lookup failed");
                        false
                    }
                };
                let total = match crate::capabilities::puzzle_play::adapters::game_sessions_db::count_sessions(
                    pool,
                    &identity.user_id,
                )
                .await
                {
                    Ok(v) => v,
                    Err(error) => {
                        tracing::warn!(%error, "streak total lookup failed");
                        0
                    }
                };
                (played, total)
            }
            None => (false, 0),
        };
        let freeze = self.load_freeze(&identity.user_id).await;
        Response::ok(GetStreakInfoResponse {
            info: self.to_info(&freeze, played_today, total).into(),
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
        Response::ok(ToggleAutoFreezeResponse {
            info: self.to_info(&freeze, false, 0).into(),
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
        Response::ok(TryAutoFreezeResponse {
            used_freeze: used,
            info: self.to_info(&freeze, false, 0).into(),
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
        Response::ok(AddStreakFreezesResponse {
            info: self.to_info(&freeze, false, 0).into(),
            ..Default::default()
        })
    }
}

pub fn gamification_connect_service(state: AppState) -> Arc<GamificationConnectService> {
    Arc::new(GamificationConnectService::new(state))
}
