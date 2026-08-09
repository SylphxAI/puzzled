//! Native Connect PreferencesService (ADR-170). Identity from the Bearer JWT.

use std::sync::Arc;

use connectrpc::{ConnectError, ErrorCode, RequestContext, Response, ServiceRequest, ServiceResult};

use super::identity::require_identity;
use super::state::AppState;
use crate::capabilities::preferences::adapters::preferences_db::{
    fetch_notification_preferences, fetch_user_preferences, upsert_notification_preferences,
    upsert_user_preferences, username_taken,
};
use crate::proto::puzzled::v1::{
    CheckUsernameRequest, CheckUsernameResponse, GetNotificationPreferencesRequest,
    GetNotificationPreferencesResponse, GetProfileRequest, GetProfileResponse, PreferencesService,
    Profile, UpdateEmailPreferencesRequest, UpdateEmailPreferencesResponse,
    UpdateProfileRequest, UpdateProfileResponse, UpdatePushPreferencesRequest,
    UpdatePushPreferencesResponse, NotificationPreferences,
};

#[derive(Clone)]
pub struct PreferencesConnectService {
    state: AppState,
}

impl PreferencesConnectService {
    pub fn new(state: AppState) -> Self {
        Self { state }
    }

    fn profile_from_json(value: &serde_json::Value) -> Profile {
        Profile {
            username: value.get("username").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
            bio: value.get("bio").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
            is_public_profile: value.get("isPublicProfile").and_then(|v| v.as_bool()).unwrap_or(false),
            compact_mode: value.get("compactMode").and_then(|v| v.as_bool()).unwrap_or(false),
            leaderboard_visible: value.get("leaderboardVisible").and_then(|v| v.as_bool()).unwrap_or(true),
            locale: value.get("locale").and_then(|v| v.as_str()).unwrap_or("en-US").to_string(),
            ..Default::default()
        }
    }

    fn prefs_from_json(value: &serde_json::Value) -> NotificationPreferences {
        NotificationPreferences {
            push_enabled: value.get("pushEnabled").and_then(|v| v.as_bool()).unwrap_or(true),
            push_daily_reminder: value.get("pushDailyReminder").and_then(|v| v.as_bool()).unwrap_or(true),
            push_streak_alert: value.get("pushStreakAlert").and_then(|v| v.as_bool()).unwrap_or(true),
            push_new_games: value.get("pushNewGames").and_then(|v| v.as_bool()).unwrap_or(true),
            daily_reminder_time: value.get("dailyReminderTime").and_then(|v| v.as_str()).unwrap_or("09:00").to_string(),
            email_enabled: value.get("emailEnabled").and_then(|v| v.as_bool()).unwrap_or(true),
            email_weekly_digest: value.get("emailWeeklyDigest").and_then(|v| v.as_bool()).unwrap_or(true),
            email_marketing: value.get("emailMarketing").and_then(|v| v.as_bool()).unwrap_or(true),
            ..Default::default()
        }
    }
}

#[allow(refining_impl_trait_internal, refining_impl_trait_reachable)]
impl PreferencesService for PreferencesConnectService {
    async fn get_profile(
        &self,
        ctx: RequestContext,
        _request: ServiceRequest<'_, GetProfileRequest>,
    ) -> ServiceResult<GetProfileResponse> {
        let identity = require_identity(&ctx)?;
        let profile = match &self.state.pool {
            Some(pool) => match fetch_user_preferences(pool, &identity.user_id).await {
                Ok(Some(value)) => Self::profile_from_json(&value),
                Ok(None) => Profile::default(),
                Err(error) => {
                    tracing::warn!(%error, "get_profile read failed");
                    return Err(ConnectError::new(ErrorCode::Internal, "preferences_read_failed"));
                }
            },
            None => Profile::default(),
        };
        Response::ok(GetProfileResponse {
            profile: profile.into(),
            ..Default::default()
        })
    }

    async fn update_profile(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, UpdateProfileRequest>,
    ) -> ServiceResult<UpdateProfileResponse> {
        let identity = require_identity(&ctx)?;
        let req = request.to_owned_message();
        if let Some(pool) = &self.state.pool {
            if let Some(username) = req.username.as_deref() {
                let username = username.trim();
                if username.is_empty() {
                    return Err(ConnectError::new(
                        ErrorCode::InvalidArgument,
                        "username_required",
                    ));
                }
                match username_taken(pool, &identity.user_id, username).await {
                    Ok(true) => {
                        return Err(ConnectError::new(
                            ErrorCode::AlreadyExists,
                            "username_taken",
                        ));
                    }
                    Ok(false) => {}
                    Err(error) => {
                        tracing::warn!(%error, "username check failed");
                        return Err(ConnectError::new(ErrorCode::Internal, "username_check_failed"));
                    }
                }
            }
            if let Err(error) = upsert_user_preferences(
                pool,
                &identity.user_id,
                req.username.as_deref(),
                req.bio.as_deref(),
                req.is_public_profile,
                req.compact_mode,
                req.leaderboard_visible,
            )
            .await
            {
                tracing::warn!(%error, "profile upsert failed");
                return Err(ConnectError::new(ErrorCode::Internal, "profile_update_failed"));
            }
        }
        let profile = match &self.state.pool {
            Some(pool) => match fetch_user_preferences(pool, &identity.user_id).await {
                Ok(Some(value)) => Self::profile_from_json(&value),
                _ => Profile::default(),
            },
            None => Profile::default(),
        };
        Response::ok(UpdateProfileResponse {
            profile: profile.into(),
            ..Default::default()
        })
    }

    async fn check_username(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, CheckUsernameRequest>,
    ) -> ServiceResult<CheckUsernameResponse> {
        let identity = require_identity(&ctx)?;
        let req = request.to_owned_message();
        let username = req.username.trim().to_string();
        if username.is_empty() {
            return Err(ConnectError::new(ErrorCode::InvalidArgument, "username_required"));
        }
        let available = match &self.state.pool {
            Some(pool) => match username_taken(pool, &identity.user_id, &username).await {
                Ok(taken) => !taken,
                Err(error) => {
                    tracing::warn!(%error, "username check failed");
                    return Err(ConnectError::new(ErrorCode::Internal, "username_check_failed"));
                }
            },
            None => true,
        };
        Response::ok(CheckUsernameResponse {
            available,
            ..Default::default()
        })
    }

    async fn get_notification_preferences(
        &self,
        ctx: RequestContext,
        _request: ServiceRequest<'_, GetNotificationPreferencesRequest>,
    ) -> ServiceResult<GetNotificationPreferencesResponse> {
        let identity = require_identity(&ctx)?;
        let prefs = match &self.state.pool {
            Some(pool) => match fetch_notification_preferences(pool, &identity.user_id).await {
                Ok(value) => Self::prefs_from_json(&value),
                Err(error) => {
                    tracing::warn!(%error, "notification prefs read failed");
                    return Err(ConnectError::new(
                        ErrorCode::Internal,
                        "preferences_read_failed",
                    ));
                }
            },
            None => NotificationPreferences::default(),
        };
        Response::ok(GetNotificationPreferencesResponse {
            preferences: prefs.into(),
            ..Default::default()
        })
    }

    async fn update_push_preferences(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, UpdatePushPreferencesRequest>,
    ) -> ServiceResult<UpdatePushPreferencesResponse> {
        let identity = require_identity(&ctx)?;
        let req = request.to_owned_message();
        if let Some(pool) = &self.state.pool {
            if let Err(error) = upsert_notification_preferences(
                pool,
                &identity.user_id,
                req.push_enabled,
                req.push_daily_reminder,
                req.push_streak_alert,
                req.push_new_games,
                req.daily_reminder_time.as_deref(),
                None,
                None,
                None,
            )
            .await
            {
                tracing::warn!(%error, "push prefs upsert failed");
                return Err(ConnectError::new(ErrorCode::Internal, "preferences_update_failed"));
            }
        }
        let prefs = match &self.state.pool {
            Some(pool) => match fetch_notification_preferences(pool, &identity.user_id).await {
                Ok(value) => Self::prefs_from_json(&value),
                _ => NotificationPreferences::default(),
            },
            None => NotificationPreferences::default(),
        };
        Response::ok(UpdatePushPreferencesResponse {
            preferences: prefs.into(),
            ..Default::default()
        })
    }

    async fn update_email_preferences(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, UpdateEmailPreferencesRequest>,
    ) -> ServiceResult<UpdateEmailPreferencesResponse> {
        let identity = require_identity(&ctx)?;
        let req = request.to_owned_message();
        if let Some(pool) = &self.state.pool {
            if let Err(error) = upsert_notification_preferences(
                pool,
                &identity.user_id,
                None,
                None,
                None,
                None,
                None,
                req.email_enabled,
                req.email_weekly_digest,
                req.email_marketing,
            )
            .await
            {
                tracing::warn!(%error, "email prefs upsert failed");
                return Err(ConnectError::new(ErrorCode::Internal, "preferences_update_failed"));
            }
        }
        let prefs = match &self.state.pool {
            Some(pool) => match fetch_notification_preferences(pool, &identity.user_id).await {
                Ok(value) => Self::prefs_from_json(&value),
                _ => NotificationPreferences::default(),
            },
            None => NotificationPreferences::default(),
        };
        Response::ok(UpdateEmailPreferencesResponse {
            preferences: prefs.into(),
            ..Default::default()
        })
    }
}

pub fn preferences_connect_service(state: AppState) -> Arc<PreferencesConnectService> {
    Arc::new(PreferencesConnectService::new(state))
}
