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
    /// The sharer's streak on the day of a same-day share.
    pub streak: Option<i32>,
}

/// One row per (player, module, product day), created from the player's
/// accepted ritual finish with an id minted by the api (UUIDv7). A repeat call
/// returns the same row: the no-op update only makes `RETURNING` yield it.
const ENSURE_SHARE_SQL: &str = r#"
INSERT INTO result_shares
    (id, user_id, game_slug, day_key, difficulty, status, attempts, score, time_spent_ms)
SELECT $4, user_id, game_slug, day_key, difficulty::text, status::text, attempts, score,
       time_spent_ms
FROM game_sessions
WHERE user_id = $1
  AND game_slug = $2
  AND day_key = $3
  AND is_ritual = true
  AND status IN ('won','lost')
ORDER BY completed_at DESC NULLS LAST
LIMIT 1
ON CONFLICT (user_id, game_slug, day_key) DO UPDATE
SET user_id = result_shares.user_id
RETURNING id
"#;

/// The share for the player's finish of `game_slug` on `day_key`, created on
/// first call; None when the player has no accepted finish for it. With `tap`
/// the share is also counted once (`share_count` is the number of share taps).
pub async fn record_share(
    pool: &PgPool,
    user_id: &str,
    game_slug: &str,
    day_key: &str,
    tap: bool,
) -> Result<Option<Uuid>, String> {
    let uid =
        user_id_to_storage_uuid(user_id).ok_or_else(|| format!("invalid user id: {user_id}"))?;
    let id = sqlx::query_scalar::<_, Uuid>(ENSURE_SHARE_SQL)
        .bind(uid)
        .bind(game_slug)
        .bind(day_key)
        .bind(Uuid::now_v7())
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("result share write failed: {e}"))?;
    if let (true, Some(id)) = (tap, id) {
        sqlx::query(
            r#"UPDATE result_shares
               SET share_count = share_count + 1, last_shared_at = now() WHERE id = $1"#,
        )
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| format!("result share count failed: {e}"))?;
    }
    Ok(id)
}

/// Keep the sharer's streak on their share of today, once: it is what the
/// shared card shows, and a later share tap must not rewrite it.
pub async fn set_share_streak(pool: &PgPool, id: Uuid, streak: i32) -> Result<(), String> {
    sqlx::query("UPDATE result_shares SET streak = $2 WHERE id = $1 AND streak IS NULL")
        .bind(id)
        .bind(streak)
        .execute(pool)
        .await
        .map_err(|e| format!("result share streak write failed: {e}"))?;
    Ok(())
}

/// The shared result behind a link; None for an unknown id.
pub async fn load_shared_result(pool: &PgPool, id: Uuid) -> Result<Option<SharedResult>, String> {
    let row = sqlx::query(
        r#"SELECT game_slug, day_key, difficulty, status, attempts, score, time_spent_ms, streak
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
        streak: row.try_get("streak").map_err(read)?,
    }))
}

/// Move a guest's shares onto the account when the guest signs in, keeping any
/// share the account already has for the same module and day.
pub async fn adopt_guest_shares(connection: &mut sqlx::PgConnection, account: Uuid, guest: Uuid) -> Result<u64, String> {
    sqlx::query(
        r#"UPDATE result_shares g SET user_id = $2, adopted_from_guest = $1
           WHERE g.user_id = $1
             AND NOT EXISTS (
               SELECT 1 FROM result_shares a
               WHERE a.user_id = $2 AND a.game_slug = g.game_slug AND a.day_key = g.day_key)"#,
    )
    .bind(guest)
    .bind(account)
    .execute(connection)
    .await
    .map(|r| r.rows_affected())
    .map_err(|e| format!("guest share adoption failed: {e}"))
}
