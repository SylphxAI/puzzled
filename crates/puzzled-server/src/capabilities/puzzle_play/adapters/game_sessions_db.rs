//! SQL adapter for puzzle-play game session persistence.
//!
//! Ritual completion (`ritual.completed` equivalent) is stored on the same
//! authoritative `game_sessions` row written after server validation — no dual
//! instrumentation path.

use sqlx::PgPool;

use puzzled_core::identity_policy::guest_day_id::user_id_to_storage_uuid;
use puzzled_core::puzzle_play::game_flows::{GameMode, SaveResultPlan};
use puzzled_core::puzzle_play::ritual_completion::{
    build_ritual_completed, qualifies_as_ritual, RitualQualifyInput, DRC_RECOMPUTE_SQL,
};

/// Parse Platform `sub` or logical `guest_<uuid>` into the uuid column value.
fn parse_user_id(user_id: &str) -> Result<uuid::Uuid, String> {
    user_id_to_storage_uuid(user_id).ok_or_else(|| format!("invalid user id: {user_id}"))
}

#[derive(Debug, Clone)]
pub struct PersistGameSessionInput<'a> {
    pub user_id: &'a str,
    pub score: Option<i32>,
    pub plan: &'a SaveResultPlan,
}

/// Insert a completed/abandoned game session row. Returns session id.
pub async fn persist_game_session(
    pool: &PgPool,
    input: PersistGameSessionInput<'_>,
) -> Result<String, String> {
    let uid = parse_user_id(input.user_id)?;
    // DB enum game_status: in_progress|won|lost|abandoned
    let status = input.plan.status.as_str();
    // DB enum game_mode: daily|archive (practice maps to daily for storage)
    let mode = match input.plan.mode {
        GameMode::Archive => "archive",
        GameMode::Daily | GameMode::Practice => "daily",
    };
    let row: (uuid::Uuid,) = sqlx::query_as(
        r#"
        INSERT INTO game_sessions (
            user_id, game_slug, difficulty, mode, status, score, attempts, time_spent_ms, completed_at
        ) VALUES (
            $1, $2,
            $3::puzzle_difficulty,
            $4::game_mode,
            $5::game_status,
            $6, $7, $8,
            now()
        )
        RETURNING id
        "#,
    )
    .bind(uid)
    .bind(&input.plan.game_slug)
    .bind(input.plan.difficulty.as_deref())
    .bind(mode)
    .bind(status)
    .bind(input.score)
    .bind(input.plan.attempts as i32)
    .bind(input.plan.time_spent_ms as i32)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("game_sessions insert failed: {e}"))?;
    Ok(row.0.to_string())
}

// Completion existence probes. Postgres types bare `SELECT 1` as INT4; decoding
// that as Rust `i64` (INT8) fails with session_lookup_failed (live dogfood on
// tip 626f40a). Use EXISTS → bool (preferred) or `1::bigint` if a scalar int is
// required. These SQL strings are the regression oracle for that mismatch.
const HAS_COMPLETED_BY_PID_AND_DATE_SQL: &str = r#"
SELECT EXISTS (
  SELECT 1 FROM game_sessions
  WHERE user_id = $1
    AND status IN ('won','lost')
    AND (
      puzzle_id = $2
      OR (game_slug = $3 AND puzzle_date = $4)
    )
)
"#;

const HAS_COMPLETED_BY_PID_SQL: &str = r#"
SELECT EXISTS (
  SELECT 1 FROM game_sessions
  WHERE user_id = $1 AND puzzle_id = $2 AND status IN ('won','lost')
)
"#;

const HAS_COMPLETED_BY_DATE_SQL: &str = r#"
SELECT EXISTS (
  SELECT 1 FROM game_sessions
  WHERE user_id = $1 AND game_slug = $2 AND puzzle_date = $3
    AND status IN ('won','lost')
)
"#;

const HAS_RITUAL_COMPLETION_SQL: &str = r#"
SELECT EXISTS (
  SELECT 1 FROM game_sessions
  WHERE user_id = $1
    AND game_slug = $2
    AND day_key = $3
    AND is_ritual = true
    AND status IN ('won','lost')
)
"#;

const COMPLETED_SESSION_BY_PID_AND_DATE_SQL: &str = r#"
SELECT status::text, score, attempts, completed_at
FROM game_sessions
WHERE user_id = $1
  AND status IN ('won','lost')
  AND (
    puzzle_id = $2
    OR (game_slug = $3 AND puzzle_date = $4)
  )
ORDER BY completed_at DESC NULLS LAST, id DESC
LIMIT 1
"#;

const COMPLETED_SESSION_BY_PID_SQL: &str = r#"
SELECT status::text, score, attempts, completed_at
FROM game_sessions
WHERE user_id = $1
  AND puzzle_id = $2
  AND status IN ('won','lost')
ORDER BY completed_at DESC NULLS LAST, id DESC
LIMIT 1
"#;

const COMPLETED_SESSION_BY_DATE_SQL: &str = r#"
SELECT status::text, score, attempts, completed_at
FROM game_sessions
WHERE user_id = $1
  AND game_slug = $2
  AND puzzle_date = $3
  AND status IN ('won','lost')
ORDER BY completed_at DESC NULLS LAST, id DESC
LIMIT 1
"#;

const ADOPT_GUEST_COLLISION_DELETE_SQL: &str = r#"
DELETE FROM game_sessions AS guest
WHERE guest.user_id = $1
  AND (
    (
      guest.puzzle_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM game_sessions AS account
        WHERE account.user_id = $2
          AND account.puzzle_id = guest.puzzle_id
      )
    )
    OR (
      guest.is_ritual = true
      AND guest.day_key IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM game_sessions AS account
        WHERE account.user_id = $2
          AND account.is_ritual = true
          AND account.game_slug = guest.game_slug
          AND account.day_key = guest.day_key
      )
    )
  )
"#;

const ADOPT_GUEST_REASSIGN_SQL: &str = r#"
UPDATE game_sessions
SET user_id = $2
WHERE user_id = $1
"#;

/// True when the user has a completed session for the given puzzle and/or date.
///
/// Lookup is **OR** of:
/// - `puzzle_id` when the served puzzle has a stable store id
/// - `(game_slug, puzzle_date)` for date-keyed dailies (including deterministic
///   sudoku with no `daily_puzzles` row / null `puzzle_id` on the session)
///
/// Free daily one-finish-per-module requires the date arm even when
/// `puzzle_id` is unresolved — otherwise a second SubmitGuess inserts another
/// `game_sessions` row (dogfood: dual wins same user/day with null puzzle_id).
pub async fn has_completed_session(
    pool: &PgPool,
    user_id: &str,
    game_slug: &str,
    puzzle_date: Option<chrono::NaiveDate>,
    puzzle_id: Option<&str>,
) -> Result<bool, String> {
    let uid = parse_user_id(user_id)?;
    let pid = match puzzle_id {
        Some(p) => Some(uuid::Uuid::parse_str(p).map_err(|e| format!("invalid puzzle id: {e}"))?),
        None => None,
    };
    let date = match puzzle_date {
        Some(d) => Some(d.and_hms_opt(0, 0, 0).ok_or("invalid date")?),
        None => None,
    };
    let exists: bool = match (pid, date) {
        (Some(pid), Some(date)) => sqlx::query_scalar::<_, bool>(HAS_COMPLETED_BY_PID_AND_DATE_SQL)
            .bind(uid)
            .bind(pid)
            .bind(game_slug)
            .bind(date)
            .fetch_one(pool)
            .await
            .map_err(|e| format!("game_sessions query failed: {e}"))?,
        (Some(pid), None) => sqlx::query_scalar::<_, bool>(HAS_COMPLETED_BY_PID_SQL)
            .bind(uid)
            .bind(pid)
            .fetch_one(pool)
            .await
            .map_err(|e| format!("game_sessions query failed: {e}"))?,
        (None, Some(date)) => sqlx::query_scalar::<_, bool>(HAS_COMPLETED_BY_DATE_SQL)
            .bind(uid)
            .bind(game_slug)
            .bind(date)
            .fetch_one(pool)
            .await
            .map_err(|e| format!("game_sessions query failed: {e}"))?,
        (None, None) => false,
    };
    Ok(exists)
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CompletedSession {
    pub status: String,
    pub score: Option<i32>,
    pub attempts: i32,
    pub completed_at: Option<chrono::NaiveDateTime>,
}

/// Load the accepted result for a served daily puzzle.
///
/// This is deliberately the same identity/date-or-puzzle lookup as
/// [`has_completed_session`]. The result card must reflect the Rust-accepted
/// `game_sessions` row; it must never be inferred from the completion boolean
/// or filled with client/current-time defaults.
pub async fn load_completed_session(
    pool: &PgPool,
    user_id: &str,
    game_slug: &str,
    puzzle_date: Option<chrono::NaiveDate>,
    puzzle_id: Option<&str>,
) -> Result<Option<CompletedSession>, String> {
    let uid = parse_user_id(user_id)?;
    let pid = match puzzle_id {
        Some(p) => Some(uuid::Uuid::parse_str(p).map_err(|e| format!("invalid puzzle id: {e}"))?),
        None => None,
    };
    let date = match puzzle_date {
        Some(d) => Some(d.and_hms_opt(0, 0, 0).ok_or("invalid date")?),
        None => None,
    };

    let row: Option<(String, Option<i32>, i32, Option<chrono::NaiveDateTime>)> = match (pid, date) {
        (Some(pid), Some(date)) => sqlx::query_as(COMPLETED_SESSION_BY_PID_AND_DATE_SQL)
            .bind(uid)
            .bind(pid)
            .bind(game_slug)
            .bind(date)
            .fetch_optional(pool)
            .await
            .map_err(|e| format!("completed session query failed: {e}"))?,
        (Some(pid), None) => sqlx::query_as(COMPLETED_SESSION_BY_PID_SQL)
            .bind(uid)
            .bind(pid)
            .fetch_optional(pool)
            .await
            .map_err(|e| format!("completed session query failed: {e}"))?,
        (None, Some(date)) => sqlx::query_as(COMPLETED_SESSION_BY_DATE_SQL)
            .bind(uid)
            .bind(game_slug)
            .bind(date)
            .fetch_optional(pool)
            .await
            .map_err(|e| format!("completed session query failed: {e}"))?,
        (None, None) => None,
    };

    Ok(
        row.map(|(status, score, attempts, completed_at)| CompletedSession {
            status,
            score,
            attempts,
            completed_at,
        }),
    )
}

/// Move accepted guest rows onto the Platform account without duplicating a
/// finish for the same puzzle or ritual (user, module, product day).
///
/// Colliding guest rows are dropped so the account keeps its existing
/// canonical result. Remaining guest rows are reassigned to the account.
pub async fn adopt_guest_sessions(
    pool: &PgPool,
    account_user_id: &str,
    guest_user_id: &str,
) -> Result<u64, String> {
    let account = parse_user_id(account_user_id)?;
    let guest = parse_user_id(guest_user_id)?;
    if account == guest {
        return Ok(0);
    }

    sqlx::query(ADOPT_GUEST_COLLISION_DELETE_SQL)
        .bind(guest)
        .bind(account)
        .execute(pool)
        .await
        .map_err(|e| format!("guest collision delete failed: {e}"))?;

    let updated = sqlx::query(ADOPT_GUEST_REASSIGN_SQL)
        .bind(guest)
        .bind(account)
        .execute(pool)
        .await
        .map_err(|e| format!("guest reassign failed: {e}"))?;

    Ok(updated.rows_affected())
}

/// True when the user already has a ritual finish for this module on `day_key`.
///
/// Complements [`has_completed_session`] for the free-daily path when sessions
/// may have been written with null `puzzle_id` (deterministic generator).
pub async fn has_ritual_completion(
    pool: &PgPool,
    user_id: &str,
    game_slug: &str,
    day_key: chrono::NaiveDate,
) -> Result<bool, String> {
    let uid = parse_user_id(user_id)?;
    let day = day_key.format("%Y-%m-%d").to_string();
    let exists: bool = sqlx::query_scalar::<_, bool>(HAS_RITUAL_COMPLETION_SQL)
        .bind(uid)
        .bind(game_slug)
        .bind(day)
        .fetch_one(pool)
        .await
        .map_err(|e| format!("game_sessions ritual query failed: {e}"))?;
    Ok(exists)
}

/// Persist a server-validated result (authoritative path from Connect submit).
///
/// When the finish qualifies as a ritual, also writes `day_key`, `module_class`,
/// `is_ritual`, and `finish_kind` on the same row (sole instrumentation path).
#[allow(clippy::too_many_arguments)]
pub async fn persist_validated_session(
    pool: &PgPool,
    user_id: &str,
    game_slug: &str,
    difficulty: Option<&str>,
    mode: &str,
    status: &str,
    score: Option<i32>,
    attempts: u32,
    time_spent_ms: u64,
    puzzle_id: Option<&str>,
    puzzle_date: Option<chrono::NaiveDate>,
    day_key: Option<chrono::NaiveDate>,
    at_ms: i64,
) -> Result<String, String> {
    let uid = parse_user_id(user_id)?;
    let pid = match puzzle_id {
        Some(p) => Some(uuid::Uuid::parse_str(p).map_err(|e| format!("invalid puzzle id: {e}"))?),
        None => None,
    };
    let date = match puzzle_date {
        Some(d) => Some(d.and_hms_opt(0, 0, 0).ok_or("invalid date")?),
        None => None,
    };

    let ritual = if qualifies_as_ritual(RitualQualifyInput {
        game_module_id: game_slug,
        mode,
        status,
        is_dry_run: false,
    }) {
        let dk = day_key.ok_or("day_key required for ritual completion")?;
        build_ritual_completed(
            user_id,
            game_slug,
            dk,
            status,
            puzzle_id.map(str::to_string),
            at_ms,
        )
    } else {
        None
    };

    let (day_key_str, module_class, is_ritual, finish_kind) = match &ritual {
        Some(r) => (
            Some(r.day_key.as_str()),
            Some(r.module_class.as_str()),
            true,
            Some(r.finish_kind.as_str()),
        ),
        None => (None, None, false, None),
    };

    let row: Result<Option<(uuid::Uuid,)>, sqlx::Error> = sqlx::query_as(
        r#"
        INSERT INTO game_sessions (
            user_id, game_slug, puzzle_id, puzzle_date, difficulty, mode, status,
            score, attempts, time_spent_ms, completed_at,
            day_key, module_class, is_ritual, finish_kind
        ) VALUES (
            $1, $2, $3, $4,
            $5::puzzle_difficulty,
            $6::game_mode,
            $7::game_status,
            $8, $9, $10,
            now(),
            $11, $12, $13, $14
        )
        ON CONFLICT (user_id, puzzle_id) DO NOTHING
        RETURNING id
        "#,
    )
    .bind(uid)
    .bind(game_slug)
    .bind(pid)
    .bind(date)
    .bind(difficulty)
    .bind(mode)
    .bind(status)
    .bind(score)
    .bind(attempts as i32)
    .bind(time_spent_ms as i32)
    .bind(day_key_str)
    .bind(module_class)
    .bind(is_ritual)
    .bind(finish_kind)
    .fetch_optional(pool)
    .await;

    match row {
        Ok(Some((id,))) => Ok(id.to_string()),
        // (user_id, puzzle_id) unique hit — idempotent no-op.
        Ok(None) => Err("already_played".to_string()),
        Err(e) => {
            // Ritual partial unique (user_id, game_slug, day_key) — race after
            // pre-check, or second finish with null puzzle_id.
            if is_unique_violation(&e) {
                return Err("already_played".to_string());
            }
            Err(format!("game_sessions insert failed: {e}"))
        }
    }
}

fn is_unique_violation(err: &sqlx::Error) -> bool {
    match err {
        sqlx::Error::Database(db) => {
            // Postgres unique_violation
            db.code().as_deref() == Some("23505")
        }
        _ => false,
    }
}

/// Count a user's completed sessions (any game).
pub async fn count_sessions(pool: &PgPool, user_id: &str) -> Result<u32, String> {
    let uid = parse_user_id(user_id)?;
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM game_sessions WHERE user_id = $1 AND status IN ('won','lost')",
    )
    .bind(uid)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("session count failed: {e}"))?;
    Ok(row.0.max(0) as u32)
}

/// Recompute daily puzzle completers for a product day_key from `game_sessions` (live oracle).
pub async fn recompute_drc(pool: &PgPool, day_key: &str) -> Result<u64, String> {
    let row: (i64,) = sqlx::query_as(DRC_RECOMPUTE_SQL)
        .bind(day_key)
        .fetch_one(pool)
        .await
        .map_err(|e| format!("drc recompute failed: {e}"))?;
    Ok(row.0.max(0) as u64)
}

#[cfg(test)]
mod tests {
    use super::*;
    use puzzled_core::puzzle_play::ritual_completion::{
        submit_must_guard_already_played, FinishKind,
    };

    #[test]
    fn ritual_fields_derived_for_daily_won() {
        let day = chrono::NaiveDate::from_ymd_opt(2026, 8, 12).expect("d");
        assert!(qualifies_as_ritual(RitualQualifyInput {
            game_module_id: "sudoku",
            mode: "daily",
            status: "won",
            is_dry_run: false,
        }));
        let ev =
            build_ritual_completed("u1", "sudoku", day, "won", Some("p1".into()), 0).expect("ev");
        assert_eq!(ev.finish_kind, FinishKind::Success);
        assert_eq!(ev.day_key, "2026-08-12");
        assert!(ev.is_ritual);
    }

    /// Shell policy: pre-check + unique index cover null puzzle_id double-finish.
    #[test]
    fn dogfood_double_finish_requires_date_or_ritual_guard() {
        // Historical bug: only called has_completed_session when pid was Some.
        assert!(submit_must_guard_already_played(true, None, true));
        assert!(is_unique_violation_code("23505"));
        assert!(!is_unique_violation_code("42P01"));
    }

    /// Live tip b3abfd8/#76: guest SubmitGuess past identity gate then
    /// `session_lookup_failed` because `guest_<uuid>` was parsed as a UUID.
    #[test]
    fn guest_logical_user_id_maps_to_storage_uuid() {
        let uid = parse_user_id("guest_a1b2c3d4-e5f6-7890-abcd-ef1234567890").expect("guest");
        assert_eq!(uid.to_string(), "a1b2c3d4-e5f6-7890-abcd-ef1234567890");
        let platform = parse_user_id("f715210b-9df3-4945-b5bd-94fc4609bc30").expect("platform");
        assert_eq!(platform.to_string(), "f715210b-9df3-4945-b5bd-94fc4609bc30");
        assert!(parse_user_id("not-a-uuid").is_err());
    }

    fn is_unique_violation_code(code: &str) -> bool {
        code == "23505"
    }
}
