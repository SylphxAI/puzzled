//! Capability `announcements`: the public read of notices an admin wrote.
//!
//! The copy lives in the `announcements` row (AdminService writes it); this
//! module only decides which rows a player may see right now.

use chrono::NaiveDateTime;
use sqlx::PgPool;
use uuid::Uuid;

/// The most notices one page shows; the banner stacks, it never becomes a feed.
pub const MAX_ACTIVE: i64 = 3;

pub struct ActiveAnnouncement {
    pub id: Uuid,
    pub title: String,
    pub body: String,
    pub kind: String,
    pub dismissible: bool,
}

/// Rows that are switched on, inside their start/end window at `now` (UTC wall
/// clock, as the columns store it) and aimed at everyone. Rows aimed at a
/// subset (premium only) are not public, so they never leave here.
pub async fn list_active(
    pool: &PgPool,
    now: NaiveDateTime,
) -> Result<Vec<ActiveAnnouncement>, sqlx::Error> {
    let rows: Vec<(Uuid, String, String, String, bool)> = sqlx::query_as(
        r#"
        SELECT id, title, content, type::text, dismissible
        FROM announcements
        WHERE is_active
          AND target_all_users
          AND NOT target_premium_only
          AND (starts_at IS NULL OR starts_at <= $1)
          AND (ends_at IS NULL OR ends_at > $1)
        ORDER BY created_at DESC, id
        LIMIT $2
        "#,
    )
    .bind(now)
    .bind(MAX_ACTIVE)
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(|(id, title, body, kind, dismissible)| ActiveAnnouncement {
            id,
            title,
            body,
            kind,
            dismissible,
        })
        .collect())
}
