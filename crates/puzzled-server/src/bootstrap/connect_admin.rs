//! Native Connect AdminService (ADR-170). Every method requires a verified
//! identity with an exact admin scope claim.

use std::sync::Arc;

use connectrpc::{ConnectError, ErrorCode, RequestContext, Response, ServiceRequest, ServiceResult};
use serde_json::Value;

use super::identity::require_admin;
use super::state::AppState;
use crate::capabilities::admin::adapters::admin_db;
use crate::proto::puzzled::v1::{
    AdminService, Announcement, AppSettings, AuditLogEntry, CreateAnnouncementRequest,
    CreateAnnouncementResponse, DeleteAnnouncementRequest, DeleteAnnouncementResponse, DlqActionRequest,
    DlqActionResponse, DlqEntry, GamesOverviewRequest, GamesOverviewResponse, GetAuditLogRequest,
    GetAuditLogResponse, GetSettingsRequest, GetSettingsResponse, ListAnnouncementsRequest,
    ListAnnouncementsResponse, ListAuditLogsRequest, ListAuditLogsResponse, ListDlqRequest,
    ListDlqResponse, SystemHealthRequest, SystemHealthResponse, UpdateAnnouncementRequest,
    UpdateAnnouncementResponse, UpdateSettingsRequest, UpdateSettingsResponse,
    DailyStat, GameAnalyticsRequest, GameAnalyticsResponse,
};

fn announcement_from_json(v: &Value) -> Announcement {
    Announcement {
        id: v.get("id").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
        title: v.get("title").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
        body: v.get("body").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
        r#type: v.get("type").and_then(|x| x.as_str()).unwrap_or("info").to_string(),
        active: v.get("active").and_then(|x| x.as_bool()).unwrap_or(true),
        created_at: v.get("createdAt").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
        updated_at: v.get("updatedAt").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
        ..Default::default()
    }
}

fn audit_from_json(v: &Value) -> AuditLogEntry {
    AuditLogEntry {
        id: v.get("id").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
        user_id: v.get("userId").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
        actor_id: v.get("actorId").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
        action: v.get("action").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
        entity_type: v.get("entityType").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
        entity_id: v.get("entityId").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
        metadata_json: v.get("metadataJson").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
        created_at: v.get("createdAt").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
        ip_address: v.get("ipAddress").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
        user_agent: v.get("userAgent").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
        ..Default::default()
    }
}

fn dlq_from_json(v: &Value) -> DlqEntry {
    DlqEntry {
        id: v.get("id").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
        job_type: v.get("jobType").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
        payload_json: v.get("payloadJson").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
        status: v.get("status").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
        attempts: v.get("attempts").and_then(|x| x.as_u64()).unwrap_or(0) as u32,
        error: v.get("error").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
        created_at: v.get("createdAt").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
        next_retry_at: v.get("nextRetryAt").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
        ..Default::default()
    }
}

#[derive(Clone)]
pub struct AdminConnectService {
    state: AppState,
}

impl AdminConnectService {
    pub fn new(state: AppState) -> Self {
        Self { state }
    }

    fn pool(&self) -> Result<&sqlx::PgPool, ConnectError> {
        self.state.pool.as_ref().ok_or_else(|| {
            ConnectError::new(ErrorCode::Unavailable, "database_unavailable")
        })
    }
}

#[allow(refining_impl_trait_internal, refining_impl_trait_reachable)]
impl AdminService for AdminConnectService {
    async fn list_announcements(
        &self,
        ctx: RequestContext,
        _request: ServiceRequest<'_, ListAnnouncementsRequest>,
    ) -> ServiceResult<ListAnnouncementsResponse> {
        require_admin(&ctx)?;
        let pool = self.pool()?;
        let rows = admin_db::list_announcements(pool)
            .await
            .map_err(|e| ConnectError::new(ErrorCode::Internal, e))?;
        Response::ok(ListAnnouncementsResponse {
            announcements: rows.iter().map(announcement_from_json).collect(),
            ..Default::default()
        })
    }

    async fn create_announcement(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, CreateAnnouncementRequest>,
    ) -> ServiceResult<CreateAnnouncementResponse> {
        let identity = require_admin(&ctx)?;
        let pool = self.pool()?;
        let req = request.to_owned_message();
        if req.title.trim().is_empty() || req.body.trim().is_empty() {
            return Err(ConnectError::new(
                ErrorCode::InvalidArgument,
                "title_and_body_required",
            ));
        }
        let row = admin_db::create_announcement(
            pool,
            req.title.trim(),
            req.body.trim(),
            if req.r#type.trim().is_empty() { "info" } else { req.r#type.trim() },
            req.active,
            &identity.user_id,
        )
        .await
        .map_err(|e| ConnectError::new(ErrorCode::Internal, e))?;
        Response::ok(CreateAnnouncementResponse {
            announcement: announcement_from_json(&row).into(),
            ..Default::default()
        })
    }

    async fn update_announcement(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, UpdateAnnouncementRequest>,
    ) -> ServiceResult<UpdateAnnouncementResponse> {
        require_admin(&ctx)?;
        let pool = self.pool()?;
        let req = request.to_owned_message();
        let row = admin_db::update_announcement(
            pool,
            req.id.trim(),
            req.title.as_deref(),
            req.body.as_deref(),
            req.r#type.as_deref(),
            req.active,
        )
        .await
        .map_err(|e| ConnectError::new(ErrorCode::Internal, e))?;
        Response::ok(UpdateAnnouncementResponse {
            announcement: announcement_from_json(&row).into(),
            ..Default::default()
        })
    }

    async fn delete_announcement(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, DeleteAnnouncementRequest>,
    ) -> ServiceResult<DeleteAnnouncementResponse> {
        require_admin(&ctx)?;
        let pool = self.pool()?;
        let req = request.to_owned_message();
        let deleted = admin_db::delete_announcement(pool, req.id.trim())
            .await
            .map_err(|e| ConnectError::new(ErrorCode::Internal, e))?;
        Response::ok(DeleteAnnouncementResponse {
            deleted,
            ..Default::default()
        })
    }

    async fn get_settings(
        &self,
        ctx: RequestContext,
        _request: ServiceRequest<'_, GetSettingsRequest>,
    ) -> ServiceResult<GetSettingsResponse> {
        require_admin(&ctx)?;
        let pool = self.pool()?;
        let rows = admin_db::list_settings(pool)
            .await
            .map_err(|e| ConnectError::new(ErrorCode::Internal, e))?;
        let settings = rows
            .iter()
            .map(|v| AppSettings {
                key: v.get("key").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
                value_json: v.get("value").map(|x| x.to_string()).unwrap_or_default(),
                ..Default::default()
            })
            .collect();
        Response::ok(GetSettingsResponse {
            settings,
            ..Default::default()
        })
    }

    async fn update_settings(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, UpdateSettingsRequest>,
    ) -> ServiceResult<UpdateSettingsResponse> {
        let identity = require_admin(&ctx)?;
        let pool = self.pool()?;
        let req = request.to_owned_message();
        let value: Value = serde_json::from_str(&req.value_json).map_err(|_| {
            ConnectError::new(ErrorCode::InvalidArgument, "invalid_value_json")
        })?;
        let row = admin_db::upsert_setting(pool, req.key.trim(), &value, &identity.user_id)
            .await
            .map_err(|e| ConnectError::new(ErrorCode::Internal, e))?;
        Response::ok(UpdateSettingsResponse {
            setting: Some(AppSettings {
                key: row.get("key").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
                value_json: row.get("value").map(|x| x.to_string()).unwrap_or_default(),
                ..Default::default()
            })
            .into(),
            ..Default::default()
        })
    }

    async fn list_audit_logs(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, ListAuditLogsRequest>,
    ) -> ServiceResult<ListAuditLogsResponse> {
        require_admin(&ctx)?;
        let pool = self.pool()?;
        let req = request.to_owned_message();
        let limit = req.limit.clamp(1, 200);
        let (rows, total) = admin_db::list_audit_logs(
            pool,
            limit,
            req.offset,
            (!req.action.is_empty()).then_some(req.action.as_str()),
        )
        .await
        .map_err(|e| ConnectError::new(ErrorCode::Internal, e))?;
        Response::ok(ListAuditLogsResponse {
            entries: rows.iter().map(audit_from_json).collect(),
            total,
            ..Default::default()
        })
    }

    async fn get_audit_log(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, GetAuditLogRequest>,
    ) -> ServiceResult<GetAuditLogResponse> {
        require_admin(&ctx)?;
        let pool = self.pool()?;
        let req = request.to_owned_message();
        let row = admin_db::get_audit_log(pool, req.id.trim())
            .await
            .map_err(|e| ConnectError::new(ErrorCode::Internal, e))?;
        Response::ok(GetAuditLogResponse {
            entry: audit_from_json(&row).into(),
            ..Default::default()
        })
    }

    async fn list_dlq(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, ListDlqRequest>,
    ) -> ServiceResult<ListDlqResponse> {
        require_admin(&ctx)?;
        let pool = self.pool()?;
        let req = request.to_owned_message();
        let limit = req.limit.clamp(1, 200);
        let (rows, total, stats) = admin_db::list_dlq(pool, limit, req.offset)
            .await
            .map_err(|e| ConnectError::new(ErrorCode::Internal, e))?;
        Response::ok(ListDlqResponse {
            entries: rows.iter().map(dlq_from_json).collect(),
            total,
            pending: stats.get("pending").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
            retrying: stats.get("retrying").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
            resolved: stats.get("resolved").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
            failed: stats.get("failed").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
            by_workflow: stats
                .get("byWorkflow")
                .and_then(|v| v.as_object())
                .map(|m| {
                    m.iter()
                        .map(|(k, v)| {
                            (k.clone(), v.as_u64().unwrap_or(0) as u32)
                        })
                        .collect()
                })
                .unwrap_or_default(),
            ..Default::default()
        })
    }

    async fn retry_dlq(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, DlqActionRequest>,
    ) -> ServiceResult<DlqActionResponse> {
        require_admin(&ctx)?;
        let pool = self.pool()?;
        let req = request.to_owned_message();
        let ok = admin_db::dlq_retry(pool, req.id.trim())
            .await
            .map_err(|e| ConnectError::new(ErrorCode::Internal, e))?;
        Response::ok(DlqActionResponse {
            ok,
            ..Default::default()
        })
    }

    async fn resolve_dlq(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, DlqActionRequest>,
    ) -> ServiceResult<DlqActionResponse> {
        require_admin(&ctx)?;
        let pool = self.pool()?;
        let req = request.to_owned_message();
        let ok = admin_db::dlq_resolve(pool, req.id.trim())
            .await
            .map_err(|e| ConnectError::new(ErrorCode::Internal, e))?;
        Response::ok(DlqActionResponse {
            ok,
            ..Default::default()
        })
    }

    async fn mark_dlq_failed(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, DlqActionRequest>,
    ) -> ServiceResult<DlqActionResponse> {
        require_admin(&ctx)?;
        let pool = self.pool()?;
        let req = request.to_owned_message();
        let ok = admin_db::dlq_mark_failed(pool, req.id.trim())
            .await
            .map_err(|e| ConnectError::new(ErrorCode::Internal, e))?;
        Response::ok(DlqActionResponse {
            ok,
            ..Default::default()
        })
    }

    async fn games_overview(
        &self,
        ctx: RequestContext,
        _request: ServiceRequest<'_, GamesOverviewRequest>,
    ) -> ServiceResult<GamesOverviewResponse> {
        require_admin(&ctx)?;
        let pool = self.pool()?;
        let rows = admin_db::games_overview(pool)
            .await
            .map_err(|e| ConnectError::new(ErrorCode::Internal, e))?;
        let games = rows
            .iter()
            .map(|v| crate::proto::puzzled::v1::GamesOverviewEntry {
                slug: v.get("slug").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
                name: v.get("slug").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
                today_played: v.get("todayPlayed").and_then(|x| x.as_u64()).unwrap_or(0) as u32,
                today_wins: v.get("todayWins").and_then(|x| x.as_u64()).unwrap_or(0) as u32,
                all_time_played: v.get("allTimePlayed").and_then(|x| x.as_u64()).unwrap_or(0) as u32,
                all_time_wins: v.get("allTimeWins").and_then(|x| x.as_u64()).unwrap_or(0) as u32,
                ..Default::default()
            })
            .collect();
        Response::ok(GamesOverviewResponse {
            games,
            ..Default::default()
        })
    }

    async fn get_game_analytics(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, GameAnalyticsRequest>,
    ) -> ServiceResult<GameAnalyticsResponse> {
        require_admin(&ctx)?;
        let pool = self.pool()?;
        let req = request.to_owned_message();
        let rows = admin_db::game_analytics(pool, req.game_slug.trim(), req.days)
            .await
            .map_err(|e| ConnectError::new(ErrorCode::Internal, e))?;
        let daily_stats: Vec<DailyStat> = rows
            .iter()
            .map(|v| DailyStat {
                date: v.get("date").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
                games_played: v.get("gamesPlayed").and_then(|x| x.as_u64()).unwrap_or(0) as u32,
                wins: v.get("wins").and_then(|x| x.as_u64()).unwrap_or(0) as u32,
                avg_attempts: v.get("avgAttempts").and_then(|x| x.as_f64()).unwrap_or(0.0),
                ..Default::default()
            })
            .collect();
        Response::ok(GameAnalyticsResponse {
            daily_stats,
            ..Default::default()
        })
    }

    async fn system_health(
        &self,
        ctx: RequestContext,
        _request: ServiceRequest<'_, SystemHealthRequest>,
    ) -> ServiceResult<SystemHealthResponse> {
        require_admin(&ctx)?;
        let (database_ok, database_error) = match &self.state.pool {
            Some(pool) => match sqlx::query("SELECT 1").fetch_one(pool).await {
                Ok(_) => (true, String::new()),
                Err(error) => (false, error.to_string()),
            },
            None => (false, "no database pool".to_string()),
        };
        Response::ok(SystemHealthResponse {
            database_ok,
            database_error,
            uptime: format!("{}s", self.state.uptime_secs()),
            ..Default::default()
        })
    }
}

pub fn admin_connect_service(state: AppState) -> Arc<AdminConnectService> {
    Arc::new(AdminConnectService::new(state))
}
