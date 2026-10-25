//! Puzzled Plus SQL: family plans. Timestamps are stored as UTC `timestamp`.

use chrono::NaiveDateTime;
use sqlx::{PgPool, Row};
use uuid::Uuid;

fn uid(user_id: &str) -> Result<Uuid, String> {
    Uuid::parse_str(user_id).map_err(|e| format!("invalid user id: {e}"))
}

fn ms(at: NaiveDateTime) -> i64 {
    at.and_utc().timestamp_millis()
}

// ---- Family plans ----------------------------------------------------------

/// The owner of the family the account belongs to, as a member.
pub async fn family_owner_of(pool: &PgPool, member: &str) -> Result<Option<String>, String> {
    sqlx::query_scalar::<_, Uuid>(
        r#"SELECT "owner_user_id" FROM "family_members" WHERE "member_user_id" = $1"#,
    )
    .bind(uid(member)?)
    .fetch_optional(pool)
    .await
    .map(|found| found.map(|id| id.to_string()))
    .map_err(|e| format!("family read failed: {e}"))
}

pub async fn family_invite_code(pool: &PgPool, owner: &str) -> Result<Option<String>, String> {
    sqlx::query_scalar::<_, String>(
        r#"SELECT "invite_code" FROM "family_groups" WHERE "owner_user_id" = $1"#,
    )
    .bind(uid(owner)?)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("family read failed: {e}"))
}

pub async fn family_owner_by_code(pool: &PgPool, code: &str) -> Result<Option<String>, String> {
    sqlx::query_scalar::<_, Uuid>(
        r#"SELECT "owner_user_id" FROM "family_groups" WHERE "invite_code" = $1"#,
    )
    .bind(code)
    .fetch_optional(pool)
    .await
    .map(|found| found.map(|id| id.to_string()))
    .map_err(|e| format!("family read failed: {e}"))
}

/// Create the owner's family group, or replace its invite code.
pub async fn set_family_invite_code(pool: &PgPool, owner: &str, code: &str) -> Result<(), String> {
    sqlx::query(
        r#"INSERT INTO "family_groups" ("owner_user_id", "invite_code") VALUES ($1, $2)
           ON CONFLICT ("owner_user_id") DO UPDATE SET "invite_code" = EXCLUDED."invite_code""#,
    )
    .bind(uid(owner)?)
    .bind(code)
    .execute(pool)
    .await
    .map_err(|e| format!("family write failed: {e}"))?;
    Ok(())
}

/// Members (not the owner) with display names, oldest first.
pub async fn family_members(
    pool: &PgPool,
    owner: &str,
) -> Result<Vec<(String, Option<String>, i64)>, String> {
    let rows = sqlx::query(
        r#"SELECT m."member_user_id", d."display_name", m."joined_at"
           FROM "family_members" m
           LEFT JOIN "user_display_cache" d ON d."user_id" = m."member_user_id"
           WHERE m."owner_user_id" = $1 ORDER BY m."joined_at" ASC"#,
    )
    .bind(uid(owner)?)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("family read failed: {e}"))?;
    rows.iter()
        .map(|row| {
            Ok((
                row.try_get::<Uuid, _>("member_user_id")?.to_string(),
                row.try_get::<Option<String>, _>("display_name")?,
                ms(row.try_get("joined_at")?),
            ))
        })
        .collect::<Result<_, sqlx::Error>>()
        .map_err(|e| format!("family decode failed: {e}"))
}

pub async fn display_name(pool: &PgPool, user_id: &str) -> Result<Option<String>, String> {
    sqlx::query_scalar::<_, Option<String>>(
        r#"SELECT "display_name" FROM "user_display_cache" WHERE "user_id" = $1"#,
    )
    .bind(uid(user_id)?)
    .fetch_optional(pool)
    .await
    .map(Option::flatten)
    .map_err(|e| format!("display name read failed: {e}"))
}

/// Why a join was refused.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum JoinRefused {
    Full,
    AlreadyInFamily,
}

/// Add a member if the family has room; one transaction so two joins cannot
/// both take the last place.
pub async fn join_family(
    pool: &PgPool,
    owner: &str,
    member: &str,
    max_members: u32,
) -> Result<Result<(), JoinRefused>, String> {
    let owner_id = uid(owner)?;
    let member_id = uid(member)?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| format!("family join begin failed: {e}"))?;
    // Serialise joins per family on the group row.
    sqlx::query(r#"SELECT 1 FROM "family_groups" WHERE "owner_user_id" = $1 FOR UPDATE"#)
        .bind(owner_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("family lock failed: {e}"))?;
    let existing = sqlx::query_scalar::<_, Uuid>(
        r#"SELECT "owner_user_id" FROM "family_members" WHERE "member_user_id" = $1"#,
    )
    .bind(member_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| format!("family read failed: {e}"))?;
    if let Some(current) = existing {
        return Ok(if current == owner_id {
            Ok(())
        } else {
            Err(JoinRefused::AlreadyInFamily)
        });
    }
    let count = sqlx::query_scalar::<_, i64>(
        r#"SELECT count(*) FROM "family_members" WHERE "owner_user_id" = $1"#,
    )
    .bind(owner_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| format!("family count failed: {e}"))?;
    // The owner takes one of the places.
    if count + 1 >= i64::from(max_members) {
        return Ok(Err(JoinRefused::Full));
    }
    sqlx::query(
        r#"INSERT INTO "family_members" ("member_user_id", "owner_user_id") VALUES ($1, $2)"#,
    )
    .bind(member_id)
    .bind(owner_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("family join failed: {e}"))?;
    tx.commit()
        .await
        .map_err(|e| format!("family join commit failed: {e}"))?;
    Ok(Ok(()))
}

/// Remove `member` from `owner`'s family (or from any family when `owner` is None).
pub async fn remove_family_member(
    pool: &PgPool,
    owner: Option<&str>,
    member: &str,
) -> Result<bool, String> {
    let result = match owner {
        Some(owner) => sqlx::query(
            r#"DELETE FROM "family_members" WHERE "member_user_id" = $1 AND "owner_user_id" = $2"#,
        )
        .bind(uid(member)?)
        .bind(uid(owner)?),
        None => sqlx::query(r#"DELETE FROM "family_members" WHERE "member_user_id" = $1"#)
            .bind(uid(member)?),
    }
    .execute(pool)
    .await
    .map_err(|e| format!("family remove failed: {e}"))?;
    Ok(result.rows_affected() > 0)
}

// ---- Reverse trial ---------------------------------------------------------

/// When the account's one trial ends, if one was ever granted.
pub async fn trial_ends_at_ms(pool: &PgPool, user_id: &str) -> Result<Option<i64>, String> {
    sqlx::query_scalar::<_, NaiveDateTime>(
        r#"SELECT "ends_at" FROM "plus_trials" WHERE "user_id" = $1"#,
    )
    .bind(uid(user_id)?)
    .fetch_optional(pool)
    .await
    .map(|found| found.map(ms))
    .map_err(|e| format!("trial read failed: {e}"))
}

/// Distinct product days the account has finished: a qualifying ritual finish
/// that ended won or lost (the same rule as daily puzzle completers). A day
/// that was only started does not count.
pub async fn finished_days(pool: &PgPool, user_id: &str) -> Result<i64, String> {
    sqlx::query_scalar::<_, i64>(
        r#"SELECT count(DISTINCT "day_key") FROM "game_sessions"
           WHERE "user_id" = $1 AND "is_ritual" AND "day_key" IS NOT NULL
             AND "status" IN ('won', 'lost')"#,
    )
    .bind(uid(user_id)?)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("finished days read failed: {e}"))
}

/// Grant the trial ending at `ends_at_ms`. One row per account: a second call
/// changes nothing. Returns the stored end.
pub async fn grant_trial(pool: &PgPool, user_id: &str, ends_at_ms: i64) -> Result<i64, String> {
    let ends = chrono::DateTime::from_timestamp_millis(ends_at_ms)
        .ok_or("trial end out of range")?
        .naive_utc();
    sqlx::query(
        r#"INSERT INTO "plus_trials" ("user_id", "ends_at") VALUES ($1, $2)
           ON CONFLICT ("user_id") DO NOTHING"#,
    )
    .bind(uid(user_id)?)
    .bind(ends)
    .execute(pool)
    .await
    .map_err(|e| format!("trial write failed: {e}"))?;
    trial_ends_at_ms(pool, user_id)
        .await?
        .ok_or_else(|| "trial row missing after grant".to_string())
}
