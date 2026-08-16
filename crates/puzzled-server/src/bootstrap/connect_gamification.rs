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
    add_streak_freezes, build_streak_info, try_auto_freeze, FreezeData, FreezeReason,
};
use crate::capabilities::puzzle_play::adapters::game_sessions_db::{
    count_sessions, load_ritual_days,
};
use crate::proto::puzzled::v1::{
    AddStreakFreezesRequest, AddStreakFreezesResponse, GamificationService, GetStreakInfoRequest,
    GetStreakInfoResponse, StreakInfo, ToggleAutoFreezeRequest, ToggleAutoFreezeResponse,
    TryAutoFreezeRequest, TryAutoFreezeResponse,
};
use chrono::{NaiveDate, Utc};
use puzzled_core::gamification::streak::{summarize_streak, StreakSummary};
use puzzled_core::puzzle_play::daily_time::product_day_key;

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

    async fn load_streak(&self, user_id: &str, today: NaiveDate) -> (StreakSummary, u32) {
        let Some(pool) = &self.state.pool else {
            return (StreakSummary::default(), 0);
        };

        let days = match load_ritual_days(pool, user_id).await {
            Ok(days) => days,
            Err(error) => {
                tracing::warn!(%error, "streak ritual-day lookup failed");
                Vec::new()
            }
        };
        let total = match count_sessions(pool, user_id).await {
            Ok(total) => total,
            Err(error) => {
                tracing::warn!(%error, "streak total lookup failed");
                0
            }
        };

        (summarize_streak(today, &days), total)
    }

    async fn current_info(&self, user_id: &str, freeze: &FreezeData) -> StreakInfo {
        let today = product_day_key(Utc::now());
        let (summary, total) = self.load_streak(user_id, today).await;
        let view = build_streak_info(
            i32::try_from(summary.current_streak).unwrap_or(i32::MAX),
            i32::try_from(summary.max_streak).unwrap_or(i32::MAX),
            summary.has_played_today,
            i32::try_from(total).unwrap_or(i32::MAX),
            freeze,
        );
        StreakInfo {
            current_streak: u32::try_from(view.current_streak).unwrap_or_default(),
            max_streak: u32::try_from(view.max_streak).unwrap_or_default(),
            has_played_today: view.has_played_today,
            total_games_played: u32::try_from(view.total_games_played).unwrap_or_default(),
            freezes_available: u32::try_from(view.freezes_available).unwrap_or_default(),
            auto_freeze_enabled: view.auto_freeze_enabled,
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
        let freeze = self.load_freeze(&identity.user_id).await;
        Response::ok(GetStreakInfoResponse {
            info: self.current_info(&identity.user_id, &freeze).await.into(),
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
        let info = self.current_info(&identity.user_id, &freeze).await;
        Response::ok(ToggleAutoFreezeResponse {
            info: info.into(),
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
        let info = self.current_info(&identity.user_id, &freeze).await;
        Response::ok(TryAutoFreezeResponse {
            used_freeze: used,
            info: info.into(),
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
        let info = self.current_info(&req.user_id, &freeze).await;
        Response::ok(AddStreakFreezesResponse {
            info: info.into(),
            ..Default::default()
        })
    }
}

pub fn gamification_connect_service(state: AppState) -> Arc<GamificationConnectService> {
    Arc::new(GamificationConnectService::new(state))
}
