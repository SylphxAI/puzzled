//! Shared daily results (`result_shares`).
//!
//! A share is created from the player's own accepted ritual finish in
//! `game_sessions`; the client never sends result facts. The row keeps only
//! what a result card shows (never a solution or a grid), and its id is what
//! the share link carries as `ref`.

use sqlx::{PgPool, Row};
use uuid::Uuid;

use puzzled_core::identity_policy::guest_day_id::user_id_to_storage_uuid;

/// What the public landing page may show about a shared result.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SharedResult {
    pub game_slug: String,
    pub day_key: String,
    pub difficulty: Option<String>,
    pub status: String,
    pub attempts: i32,
    pub score: Option<i32>,
    pub time_spent_ms: Option<i32>,
}

/// One row per (player, module, product day). A repeat tap reuses the row and
/// counts one more share, so `share_count` is the number of share taps.
const UPSERT_SHARE_SQL: &str = r#"
INSERT INTO result_shares
    (user_id, game_slug, day_key, difficulty, status, attempts, score, time_spent_ms)
SELECT user_id, game_slug, day_key, difficulty::text, status::text, attempts, score, time_spent_ms
FROM game_sessions
WHERE user_id = $1
  AND game_slug = $2
  AND day_key = $3
  AND is_ritual = true
  AND status IN ('won','lost')
ORDER BY completed_at DESC NULLS LAST
LIMIT 1
ON CONFLICT (user_id, game_slug, day_key) DO UPDATE
SET share_count = result_shares.share_count + 1,
    last_shared_at = now()
RETURNING id
"#;

/// Record a share of the player's finish for `game_slug` on `day_key` and
/// return the share id; None when the player has no accepted finish for it.
pub async fn record_share(
    pool: &PgPool,
    user_id: &str,
    game_slug: &str,
    day_key: &str,
) -> Result<Option<Uuid>, String> {
    let uid =
        user_id_to_storage_uuid(user_id).ok_or_else(|| format!("invalid user id: {user_id}"))?;
    sqlx::query_scalar::<_, Uuid>(UPSERT_SHARE_SQL)
        .bind(uid)
        .bind(game_slug)
        .bind(day_key)
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("result share write failed: {e}"))
}

/// The shared result behind a link; None for an unknown id.
pub async fn load_shared_result(pool: &PgPool, id: Uuid) -> Result<Option<SharedResult>, String> {
    let row = sqlx::query(
        r#"SELECT game_slug, day_key, difficulty, status, attempts, score, time_spent_ms
           FROM result_shares WHERE id = $1"#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("result share read failed: {e}"))?;
    let Some(row) = row else {
        return Ok(None);
    };
    let read = |e: sqlx::Error| format!("result share row invalid: {e}");
    Ok(Some(SharedResult {
        game_slug: row.try_get("game_slug").map_err(read)?,
        day_key: row.try_get("day_key").map_err(read)?,
        difficulty: row.try_get("difficulty").map_err(read)?,
        status: row.try_get("status").map_err(read)?,
        attempts: row.try_get("attempts").map_err(read)?,
        score: row.try_get("score").map_err(read)?,
        time_spent_ms: row.try_get("time_spent_ms").map_err(read)?,
    }))
}

/// Move a guest's shares onto the account when the guest signs in, keeping any
/// share the account already has for the same module and day.
pub async fn adopt_guest_shares(pool: &PgPool, account: Uuid, guest: Uuid) -> Result<u64, String> {
    sqlx::query(
        r#"UPDATE result_shares g SET user_id = $2
           WHERE g.user_id = $1
             AND NOT EXISTS (
               SELECT 1 FROM result_shares a
               WHERE a.user_id = $2 AND a.game_slug = g.game_slug AND a.day_key = g.day_key)"#,
    )
    .bind(guest)
    .bind(account)
    .execute(pool)
    .await
    .map(|r| r.rows_affected())
    .map_err(|e| format!("guest share adoption failed: {e}"))
}
