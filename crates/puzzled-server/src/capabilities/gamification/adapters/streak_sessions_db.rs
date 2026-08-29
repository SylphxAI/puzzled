//! Read accepted ritual product days for personal streak.

use puzzled_core::gamification::personal_streak::{parse_accepted_day_keys, InvalidDayKey};
use puzzled_core::identity_policy::guest_day_id::user_id_to_storage_uuid;
use sqlx::PgPool;

fn parse_user_id(user_id: &str) -> Result<uuid::Uuid, String> {
    user_id_to_storage_uuid(user_id).ok_or_else(|| format!("invalid user id: {user_id}"))
}

/// Distinct accepted ritual product days across catalog modules.
///
/// Qualification matches the ritual write path: `is_ritual`, puzzle-ritual
/// class, and terminal `won`/`lost`. The query is not slug-gated, so sudoku
/// (or any later catalog module) counts the same as word-guess.
pub(crate) const ACCEPTED_RITUAL_DAYS_SQL: &str = r#"
SELECT DISTINCT day_key
FROM game_sessions
WHERE user_id = $1
  AND is_ritual = true
  AND module_class = 'puzzle_ritual'
  AND status IN ('won', 'lost')
  AND day_key IS NOT NULL
  AND day_key <> ''
"#;

/// Load distinct accepted ritual product days for one player.
pub async fn load_accepted_ritual_days(
    pool: &PgPool,
    user_id: &str,
) -> Result<Vec<chrono::NaiveDate>, String> {
    let uid = parse_user_id(user_id)?;
    let rows: Vec<(String,)> = sqlx::query_as(ACCEPTED_RITUAL_DAYS_SQL)
        .bind(uid)
        .fetch_all(pool)
        .await
        .map_err(|e| format!("accepted ritual days query failed: {e}"))?;
    parse_accepted_day_keys(rows.into_iter().map(|(day_key,)| day_key))
        .map_err(|InvalidDayKey(raw)| format!("invalid ritual day_key payload: {raw}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn guest_logical_user_id_maps_to_storage_uuid() {
        let uid = parse_user_id("guest_a1b2c3d4-e5f6-7890-abcd-ef1234567890").expect("guest");
        assert_eq!(uid.to_string(), "a1b2c3d4-e5f6-7890-abcd-ef1234567890");
        assert!(parse_user_id("not-a-uuid").is_err());
    }
}
