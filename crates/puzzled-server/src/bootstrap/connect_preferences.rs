//! Native Connect PreferencesService (ADR-170). Identity from the Bearer JWT.

use std::sync::Arc;

use connectrpc::{
    ConnectError, ErrorCode, RequestContext, Response, ServiceRequest, ServiceResult,
};
use tracing::Instrument;
use uuid::Uuid;

use super::identity::require_identity;
use super::state::AppState;
use crate::capabilities::identity_access::adapters::auth_erasure::AuthErasure;
use crate::capabilities::preferences::adapters::account_deletion::{erase_player, EraseError};
use crate::capabilities::preferences::adapters::preferences_db::{
    fetch_notification_preferences, fetch_user_preferences, is_reminder_time, timezone_is_known,
    upsert_notification_preferences, upsert_user_preferences, username_taken,
};
use crate::proto::puzzled::v1::{
    CheckUsernameRequest, CheckUsernameResponse, DeleteAccountDataRequest,
    DeleteAccountDataResponse, GetNotificationPreferencesRequest,
    GetNotificationPreferencesResponse, GetProfileRequest, GetProfileResponse,
    GetWebPushConfigRequest, GetWebPushConfigResponse, NotificationPreferences, PreferencesService,
    Profile, RecordSignupAttributionRequest, RecordSignupAttributionResponse,
    SaveWebPushSubscriptionRequest, SaveWebPushSubscriptionResponse, UnsubscribeEmailRequest,
    UnsubscribeEmailResponse, UpdateEmailPreferencesRequest, UpdateEmailPreferencesResponse,
    UpdateProfileRequest, UpdateProfileResponse, UpdatePushPreferencesRequest,
    UpdatePushPreferencesResponse,
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
            username: value
                .get("username")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string(),
            bio: value
                .get("bio")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string(),
            is_public_profile: value
                .get("isPublicProfile")
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            compact_mode: value
                .get("compactMode")
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            leaderboard_visible: value
                .get("leaderboardVisible")
                .and_then(|v| v.as_bool())
                .unwrap_or(true),
            locale: value
                .get("locale")
                .and_then(|v| v.as_str())
                .unwrap_or("en-US")
                .to_string(),
            ..Default::default()
        }
    }

    fn prefs_from_json(value: &serde_json::Value) -> NotificationPreferences {
        NotificationPreferences {
            push_enabled: value
                .get("pushEnabled")
                .and_then(|v| v.as_bool())
                .unwrap_or(true),
            push_daily_reminder: value
                .get("pushDailyReminder")
                .and_then(|v| v.as_bool())
                .unwrap_or(true),
            push_streak_alert: value
                .get("pushStreakAlert")
                .and_then(|v| v.as_bool())
                .unwrap_or(true),
            push_new_games: value
                .get("pushNewGames")
                .and_then(|v| v.as_bool())
                .unwrap_or(true),
            daily_reminder_time: value
                .get("dailyReminderTime")
                .and_then(|v| v.as_str())
                .unwrap_or("09:00")
                .to_string(),
            email_enabled: value
                .get("emailEnabled")
                .and_then(|v| v.as_bool())
                .unwrap_or(true),
            email_weekly_digest: value
                .get("emailWeeklyDigest")
                .and_then(|v| v.as_bool())
                .unwrap_or(true),
            // Marketing email is opt-in: absent means no.
            email_marketing: value
                .get("emailMarketing")
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            timezone: value
                .get("timezone")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string(),
            ..Default::default()
        }
    }
}

#[allow(refining_impl_trait_internal, refining_impl_trait_reachable)]
impl PreferencesService for PreferencesConnectService {
    async fn get_web_push_config(
        &self,
        _ctx: RequestContext,
        _request: ServiceRequest<'_, GetWebPushConfigRequest>,
    ) -> ServiceResult<GetWebPushConfigResponse> {
        Response::ok(GetWebPushConfigResponse {
            public_key: std::env::var("VAPID_PUBLIC_KEY").unwrap_or_default(),
            ..Default::default()
        })
    }

    async fn save_web_push_subscription(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, SaveWebPushSubscriptionRequest>,
    ) -> ServiceResult<SaveWebPushSubscriptionResponse> {
        use crate::capabilities::preferences::adapters::web_push;
        let identity = require_identity(&ctx)?;
        let player = Uuid::parse_str(&identity.user_id)
            .map_err(|_| ConnectError::new(ErrorCode::Internal, "invalid_player"))?;
        let req = request.to_owned_message();
        if !web_push::valid_endpoint(&req.endpoint)
            || (!req.remove && !web_push::valid_keys(&req.p256dh, &req.auth))
            || (!req.locale.is_empty()
                && !matches!(
                    req.locale.as_str(),
                    "en-US" | "en-GB" | "zh-HK" | "zh-TW" | "zh-CN"
                ))
        {
            return Err(ConnectError::new(
                ErrorCode::InvalidArgument,
                "invalid_push_subscription",
            ));
        }
        let pool =
            self.state.pool.as_ref().ok_or_else(|| {
                ConnectError::new(ErrorCode::Unavailable, "push_store_unavailable")
            })?;
        let result = if req.remove {
            web_push::remove(pool, player, &req.endpoint).await
        } else {
            web_push::save(
                pool,
                player,
                &req.endpoint,
                &req.p256dh,
                &req.auth,
                if req.locale.is_empty() {
                    "en-US"
                } else {
                    &req.locale
                },
            )
            .await
        };
        result.map_err(|error| match error {
            sqlx::Error::RowNotFound => {
                ConnectError::new(ErrorCode::NotFound, "push_subscription_not_found")
            }
            _ => ConnectError::new(ErrorCode::Internal, "push_subscription_save_failed"),
        })?;
        Response::ok(SaveWebPushSubscriptionResponse::default())
    }

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
                    return Err(ConnectError::new(
                        ErrorCode::Internal,
                        "preferences_read_failed",
                    ));
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
                        return Err(ConnectError::new(
                            ErrorCode::Internal,
                            "username_check_failed",
                        ));
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
                return Err(ConnectError::new(
                    ErrorCode::Internal,
                    "profile_update_failed",
                ));
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
            return Err(ConnectError::new(
                ErrorCode::InvalidArgument,
                "username_required",
            ));
        }
        let available = match &self.state.pool {
            Some(pool) => match username_taken(pool, &identity.user_id, &username).await {
                Ok(taken) => !taken,
                Err(error) => {
                    tracing::warn!(%error, "username check failed");
                    return Err(ConnectError::new(
                        ErrorCode::Internal,
                        "username_check_failed",
                    ));
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
        if let Some(time) = req.daily_reminder_time.as_deref() {
            if !is_reminder_time(time) {
                return Err(ConnectError::new(
                    ErrorCode::InvalidArgument,
                    "invalid_reminder_time",
                ));
            }
        }
        if let (Some(zone), Some(pool)) = (req.timezone.as_deref(), &self.state.pool) {
            let known = timezone_is_known(pool, zone).await.map_err(|error| {
                tracing::warn!(%error, "time zone check failed");
                ConnectError::new(ErrorCode::Internal, "preferences_update_failed")
            })?;
            if !known {
                return Err(ConnectError::new(
                    ErrorCode::InvalidArgument,
                    "invalid_timezone",
                ));
            }
        }
        if let Some(pool) = &self.state.pool {
            if let Err(error) = upsert_notification_preferences(
                pool,
                &identity.user_id,
                req.push_enabled,
                req.push_daily_reminder,
                req.push_streak_alert,
                req.push_new_games,
                req.daily_reminder_time.as_deref(),
                req.timezone.as_deref(),
                None,
                None,
                None,
            )
            .await
            {
                tracing::warn!(%error, "push prefs upsert failed");
                return Err(ConnectError::new(
                    ErrorCode::Internal,
                    "preferences_update_failed",
                ));
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

    async fn unsubscribe_email(
        &self,
        _ctx: RequestContext,
        request: ServiceRequest<'_, UnsubscribeEmailRequest>,
    ) -> ServiceResult<UnsubscribeEmailResponse> {
        let verifier = self.state.unsubscribe.as_ref().ok_or_else(|| {
            ConnectError::new(ErrorCode::Unavailable, "unsubscribe_not_configured")
        })?;
        let req = request.to_owned_message();
        let user_id = verifier
            .verify(&req.token, chrono::Utc::now().timestamp_millis())
            .ok_or_else(|| {
                ConnectError::new(ErrorCode::InvalidArgument, "invalid_unsubscribe_token")
            })?;
        let pool =
            self.state.pool.as_ref().ok_or_else(|| {
                ConnectError::new(ErrorCode::Unavailable, "preferences_unavailable")
            })?;
        upsert_notification_preferences(
            pool,
            &user_id.to_string(),
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            Some(false),
        )
        .await
        .map_err(|error| {
            tracing::warn!(%error, "unsubscribe upsert failed");
            ConnectError::new(ErrorCode::Internal, "preferences_update_failed")
        })?;
        Response::ok(UnsubscribeEmailResponse::default())
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
                None,
                req.email_enabled,
                req.email_weekly_digest,
                req.email_marketing,
            )
            .await
            {
                tracing::warn!(%error, "email prefs upsert failed");
                return Err(ConnectError::new(
                    ErrorCode::Internal,
                    "preferences_update_failed",
                ));
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

    async fn delete_account_data(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, DeleteAccountDataRequest>,
    ) -> ServiceResult<DeleteAccountDataResponse> {
        let identity = require_identity(&ctx)?;
        let req = request.to_owned_message();
        if req.confirm != "DELETE" {
            return Err(ConnectError::new(
                ErrorCode::InvalidArgument,
                "confirmation_required",
            ));
        }
        let Some(pool) = &self.state.pool else {
            return Err(ConnectError::new(
                ErrorCode::Unavailable,
                "account_deletion_unavailable",
            ));
        };
        // A subscription held in Money renews too: same rule. Money that
        // cannot answer refuses erasure (retryable) rather than erasing a
        // paying account.
        if let Some(money) = &self.state.money {
            match money.has_renewing_subscription(&identity.user_id).await {
                Ok(true) => {
                    return Err(ConnectError::new(
                        ErrorCode::FailedPrecondition,
                        "cancel_subscription_first",
                    ))
                }
                Ok(false) => {}
                Err(error) => {
                    tracing::warn!(%error, "Money subscription check before erasure failed");
                    return Err(ConnectError::new(
                        ErrorCode::Unavailable,
                        "account_deletion_unavailable",
                    ));
                }
            }
        }
        // The player's rows are only half the person: the Sylphx Auth subject
        // is the sign-in they came in with, so deleting the rows alone would
        // leave a live sign-in behind a purged account (an erasure that is not
        // an erasure). `erase_player` deletes the rows and files Auth's
        // deletion inside one transaction and commits only after Auth
        // accepted. A database failure before Auth, or a definite Auth
        // refusal, rolls back and leaves the person whole and signed in to
        // retry (503). Transient database errors and ambiguous Auth answers
        // are retried in place. What still fails after Auth may have deleted
        // the sign-in keeps every row and the subject map, and is logged with
        // the subjects for `erase-player --subject` (500).
        let erasure = self.state.erasure.as_ref().ok_or_else(|| {
            tracing::error!("account erasure refused: Enable Auth is not configured");
            ConnectError::new(ErrorCode::Unavailable, "identity_credential_unconfigured")
        })?;
        let player = Uuid::parse_str(&identity.user_id).map_err(|error| {
            tracing::warn!(%error, "account erasure: identity is not a player id");
            ConnectError::new(ErrorCode::Internal, "account_deletion_failed")
        })?;
        // The erase runs in its own task, which the handler only awaits. An
        // in-app erase can take tens of seconds (Auth retries with backoff);
        // a client or gateway that gives up drops this future, and an erase
        // running inside it would be cancelled mid-transaction — rolled back
        // after Auth may have accepted, with no "run erase-player" line. The
        // task owns everything it touches (a pool handle, the Auth handle,
        // the player id), so it runs to its commit or its logged failure
        // whatever the client does. The request's span goes with it, so its
        // log lines stay attributed to the request.
        let erase =
            tokio::spawn(erase_account(pool.clone(), player, erasure.clone()).in_current_span());
        erase.await.unwrap_or_else(|error| {
            tracing::error!(%error, "account erasure task failed; run erase-player --subject");
            Err(ConnectError::new(
                ErrorCode::Internal,
                "account_deletion_failed",
            ))
        })
    }

    async fn record_signup_attribution(
        &self,
        ctx: RequestContext,
        _request: ServiceRequest<'_, RecordSignupAttributionRequest>,
    ) -> ServiceResult<RecordSignupAttributionResponse> {
        let identity = require_identity(&ctx)?;
        let tags = ctx
            .headers()
            .get_all(axum::http::header::COOKIE)
            .iter()
            .filter_map(|value| value.to_str().ok())
            .find_map(puzzled_core::attribution::from_cookie_header);
        // An advertising-only cookie (click id, no tags) writes no analytics row and
        // does not use up the account's one first-touch row.
        let (Some(tags), Some(pool)) = (
            tags.filter(puzzled_core::attribution::Attribution::has_tag),
            &self.state.pool,
        ) else {
            return Response::ok(RecordSignupAttributionResponse::default());
        };
        let recorded =
            crate::capabilities::preferences::adapters::attribution_db::record_attribution(
                pool,
                &identity.user_id,
                &tags,
            )
            .await
            .map_err(|error| {
                tracing::warn!(%error, "signup attribution failed");
                ConnectError::new(ErrorCode::Unavailable, "attribution_unavailable")
            })?;
        if recorded {
            // Tryit-referred: queue the sign-up and send it once now (3s cap);
            // a failure stays queued for the sweep.
            let queued = crate::capabilities::tryit_conversions::enqueue(
                pool,
                &identity.user_id,
                &tags,
                crate::capabilities::tryit_conversions::Event::Signup,
            )
            .await
            .unwrap_or_else(|error| {
                tracing::warn!(%error, "tryit sign-up not queued");
                false
            });
            if queued {
                crate::capabilities::tryit_conversions::report_now(
                    pool,
                    self.state.tryit.as_ref(),
                    &identity.user_id,
                )
                .await;
            }
        }
        Response::ok(RecordSignupAttributionResponse {
            recorded,
            ..Default::default()
        })
    }
}

pub fn preferences_connect_service(state: AppState) -> Arc<PreferencesConnectService> {
    Arc::new(PreferencesConnectService::new(state))
}

/// Erase one account and its sign-in, and log the outcome. Owns its inputs so
/// it can run in a task that outlives the request.
async fn erase_account(
    pool: sqlx::PgPool,
    player: Uuid,
    erasure: AuthErasure,
) -> ServiceResult<DeleteAccountDataResponse> {
    match erase_player(&pool, player, Some(&erasure), None).await {
        Ok(erased) => {
            for (subject, request_id) in &erased.filed {
                tracing::info!(
                    subject,
                    privacy_request_id = %request_id,
                    "sylphx auth account deletion requested"
                );
            }
            for subject in &erased.absent {
                tracing::info!(subject, "sylphx auth holds no account to delete");
            }
            tracing::info!(
                rows_deleted = erased.rows_deleted,
                attempts = erased.attempts,
                "account data erased"
            );
            Response::ok(DeleteAccountDataResponse {
                rows_deleted: erased.rows_deleted,
                ..Default::default()
            })
        }
        Err(EraseError::SignInRefused(error)) => {
            tracing::error!(%error, "sylphx auth account deletion refused; nothing erased");
            Err(ConnectError::new(
                ErrorCode::Unavailable,
                "identity_account_deletion_failed",
            ))
        }
        // Rolled back before Auth was asked: the account and its sign-in
        // are whole, and the person can repeat the request.
        Err(error) if !error.sign_in_may_be_deleted() => {
            tracing::warn!(%error, "account deletion failed; nothing erased");
            Err(ConnectError::new(
                ErrorCode::Unavailable,
                "account_deletion_unavailable",
            ))
        }
        // Auth may have deleted the sign-in but the rows were not
        // committed: the person may not be able to sign in to retry. The
        // subject map is intact; the operator finishes it by subject.
        Err(error) => {
            tracing::error!(
                %error,
                subjects = ?error.subjects(),
                "account erasure incomplete: sign-in may be deleted, rows remain; run erase-player --subject"
            );
            Err(ConnectError::new(
                ErrorCode::Internal,
                "account_deletion_failed",
            ))
        }
    }
}
