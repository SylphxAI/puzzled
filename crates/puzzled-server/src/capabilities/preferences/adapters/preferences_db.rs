//! SQL adapters for durable user preference writes.

use sqlx::PgPool;

#[allow(clippy::too_many_arguments)]
pub async fn upsert_user_preferences(
    pool: &PgPool,
    user_id: &str,
    username: Option<&str>,
    bio: Option<&str>,
    is_public_profile: Option<bool>,
    compact_mode: Option<bool>,
    leaderboard_visible: Option<bool>,
) -> Result<(), String> {
    let uid = uuid::Uuid::parse_str(user_id).map_err(|e| format!("invalid user id: {e}"))?;
    sqlx::query(
        r#"
        INSERT INTO user_preferences (
            user_id, username, bio, is_public_profile, compact_mode, leaderboard_visible, updated_at
        ) VALUES ($1, $2, $3, COALESCE($4, false), COALESCE($5, false), COALESCE($6, true), now())
        ON CONFLICT (user_id) DO UPDATE SET
            username = COALESCE($2, user_preferences.username),
            bio = COALESCE($3, user_preferences.bio),
            is_public_profile = COALESCE($4, user_preferences.is_public_profile),
            compact_mode = COALESCE($5, user_preferences.compact_mode),
            leaderboard_visible = COALESCE($6, user_preferences.leaderboard_visible),
            updated_at = now()
        "#,
    )
    .bind(uid)
    .bind(username)
    .bind(bio)
    .bind(is_public_profile)
    .bind(compact_mode)
    .bind(leaderboard_visible)
    .execute(pool)
    .await
    .map_err(|e| format!("prefs upsert failed: {e}"))?;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub async fn upsert_notification_preferences(
    pool: &PgPool,
    user_id: &str,
    push_enabled: Option<bool>,
    push_daily_reminder: Option<bool>,
    push_streak_alert: Option<bool>,
    push_new_games: Option<bool>,
    daily_reminder_time: Option<&str>,
    email_enabled: Option<bool>,
    email_weekly_digest: Option<bool>,
    email_marketing: Option<bool>,
) -> Result<(), String> {
    let uid = uuid::Uuid::parse_str(user_id).map_err(|e| format!("invalid user id: {e}"))?;
    sqlx::query(
        r#"
        INSERT INTO notification_preferences (
            user_id, push_enabled, push_daily_reminder, push_streak_alert, push_new_games,
            daily_reminder_time, email_enabled, email_weekly_digest, email_marketing, updated_at
        ) VALUES (
            $1,
            COALESCE($2, true), COALESCE($3, true), COALESCE($4, true), COALESCE($5, true),
            COALESCE($6, '09:00'), COALESCE($7, true), COALESCE($8, true), COALESCE($9, true),
            now()
        )
        ON CONFLICT (user_id) DO UPDATE SET
            push_enabled = COALESCE($2, notification_preferences.push_enabled),
            push_daily_reminder = COALESCE($3, notification_preferences.push_daily_reminder),
            push_streak_alert = COALESCE($4, notification_preferences.push_streak_alert),
            push_new_games = COALESCE($5, notification_preferences.push_new_games),
            daily_reminder_time = COALESCE($6, notification_preferences.daily_reminder_time),
            email_enabled = COALESCE($7, notification_preferences.email_enabled),
            email_weekly_digest = COALESCE($8, notification_preferences.email_weekly_digest),
            email_marketing = COALESCE($9, notification_preferences.email_marketing),
            updated_at = now()
        "#,
    )
    .bind(uid)
    .bind(push_enabled)
    .bind(push_daily_reminder)
    .bind(push_streak_alert)
    .bind(push_new_games)
    .bind(daily_reminder_time)
    .bind(email_enabled)
    .bind(email_weekly_digest)
    .bind(email_marketing)
    .execute(pool)
    .await
    .map_err(|e| format!("notification prefs upsert failed: {e}"))?;
    Ok(())
}

/// Load a user's app-scoped profile/preferences row (if any).
pub async fn fetch_user_preferences(
    pool: &PgPool,
    user_id: &str,
) -> Result<Option<serde_json::Value>, String> {
    let uid = uuid::Uuid::parse_str(user_id).map_err(|e| format!("invalid user id: {e}"))?;
    type PrefRow = (
        Option<String>,
        Option<String>,
        bool,
        bool,
        bool,
        Option<String>,
    );
    let row: Option<PrefRow> = sqlx::query_as(
        r#"
        SELECT username, bio, is_public_profile, compact_mode, leaderboard_visible, locale
        FROM user_preferences
        WHERE user_id = $1
        "#,
    )
    .bind(uid)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("prefs read failed: {e}"))?;
    Ok(row.map(
        |(username, bio, is_public_profile, compact_mode, leaderboard_visible, locale)| {
            serde_json::json!({
                "username": username,
                "bio": bio,
                "isPublicProfile": is_public_profile,
                "compactMode": compact_mode,
                "leaderboardVisible": leaderboard_visible,
                "locale": locale,
            })
        },
    ))
}

/// Load a user's notification preferences (defaults when absent).
pub async fn fetch_notification_preferences(
    pool: &PgPool,
    user_id: &str,
) -> Result<serde_json::Value, String> {
    let uid = uuid::Uuid::parse_str(user_id).map_err(|e| format!("invalid user id: {e}"))?;
    type NotifRow = (bool, bool, bool, bool, String, bool, bool, bool);
    let row: Option<NotifRow> = sqlx::query_as(
        r#"
        SELECT push_enabled, push_daily_reminder, push_streak_alert, push_new_games,
               daily_reminder_time, email_enabled, email_weekly_digest, email_marketing
        FROM notification_preferences
        WHERE user_id = $1
        "#,
    )
    .bind(uid)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("notification prefs read failed: {e}"))?;
    let (
        push_enabled,
        push_daily_reminder,
        push_streak_alert,
        push_new_games,
        daily_reminder_time,
        email_enabled,
        email_weekly_digest,
        email_marketing,
    ) = row.unwrap_or((
        true,
        true,
        true,
        true,
        "09:00".to_string(),
        true,
        true,
        true,
    ));
    Ok(serde_json::json!({
        "pushEnabled": push_enabled,
        "pushDailyReminder": push_daily_reminder,
        "pushStreakAlert": push_streak_alert,
        "pushNewGames": push_new_games,
        "dailyReminderTime": daily_reminder_time,
        "emailEnabled": email_enabled,
        "emailWeeklyDigest": email_weekly_digest,
        "emailMarketing": email_marketing,
    }))
}

/// True when the username is taken by another user.
pub async fn username_taken(pool: &PgPool, user_id: &str, username: &str) -> Result<bool, String> {
    let uid = uuid::Uuid::parse_str(user_id).map_err(|e| format!("invalid user id: {e}"))?;
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT user_id::text FROM user_preferences WHERE username = $1 AND user_id <> $2 LIMIT 1",
    )
    .bind(username)
    .bind(uid)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("username check failed: {e}"))?;
    Ok(row.is_some())
}
