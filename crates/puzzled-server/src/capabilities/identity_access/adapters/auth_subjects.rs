//! The Sylphx Auth subject to player map.
//!
//! A player is Puzzled's own entity, keyed by a `uuid`. The Auth subject that
//! signs them in is another system's id: stored in `auth_subjects.subject` as
//! the exact text Auth published and never decoded (owner
//! `standards/identifiers.md`). Auth moves its subjects from `principal-<uuid>`
//! to the TypeID `usr_<26>` on 2026-10-04 (cloud#10008); both forms name the
//! same player through this table.
//!
//! How a subject finds its player, in order:
//! 1. its own row;
//! 2. the legacy subject Auth reports during its migration window
//!    (cloud#10026): that subject's row, else the old-form mapping below;
//! 3. the old form itself: before this table existed a player's id was the
//!    uuid inside `principal-<uuid>`, so that mapping is kept for players who
//!    have not signed in since; the new TypeID form is never read this way;
//! 4. otherwise a new player, with a fresh UUIDv7.
//!
//! Players whose subject changes while they are away are linked from the
//! platform's id map export with [`LINK_FROM_ID_MAP`].

use sqlx::PgPool;
use uuid::Uuid;

/// The player a Sylphx Auth subject signs in as, linking it on first use.
pub async fn player_for(
    pool: &PgPool,
    subject: &str,
    legacy_subject: Option<&str>,
) -> Result<Uuid, sqlx::Error> {
    if let Some(player) = lookup(pool, subject).await? {
        return Ok(player);
    }
    let known = match legacy_subject.filter(|legacy| *legacy != subject) {
        Some(legacy) => match lookup(pool, legacy).await? {
            Some(player) => Some(player),
            None => legacy_player_id(legacy),
        },
        None => None,
    };
    let player = known
        .or_else(|| legacy_player_id(subject))
        .unwrap_or_else(Uuid::now_v7);
    // A concurrent first request may link the subject first; its row wins.
    let inserted: Option<Uuid> = sqlx::query_scalar(
        "INSERT INTO auth_subjects (subject, user_id) VALUES ($1, $2)
         ON CONFLICT (subject) DO NOTHING RETURNING user_id",
    )
    .bind(subject)
    .bind(player)
    .fetch_optional(pool)
    .await?;
    match inserted {
        Some(player) => Ok(player),
        None => lookup(pool, subject).await?.ok_or(sqlx::Error::RowNotFound),
    }
}

/// Every subject recorded for one player — the new form, the legacy form, or
/// both during Auth's migration (cloud#10026) — so an erasure can name each
/// one to Auth. A player with no row has never signed in through this table
/// and was derived from the old form, which is then the only handle Auth
/// knows.
pub async fn subjects_naming_player(
    pool: &PgPool,
    player: Uuid,
) -> Result<Vec<String>, sqlx::Error> {
    let subjects: Vec<String> =
        sqlx::query_scalar("SELECT subject FROM auth_subjects WHERE user_id = $1 ORDER BY subject")
            .bind(player)
            .fetch_all(pool)
            .await?;
    if subjects.is_empty() {
        return Ok(vec![format!("principal-{player}")]);
    }
    Ok(subjects)
}

/// Every player an Auth user id names, in any subject form: each row whose
/// subject is the id, plus the player derived from an old-form id that never
/// got a row. Used by the platform's erasure fan-out; it never creates a row.
pub async fn players_for_subject(pool: &PgPool, subject: &str) -> Result<Vec<Uuid>, sqlx::Error> {
    let mut players: Vec<Uuid> =
        sqlx::query_scalar("SELECT DISTINCT user_id FROM auth_subjects WHERE subject = $1")
            .bind(subject)
            .fetch_all(pool)
            .await?;
    if let Some(derived) = legacy_player_id(subject) {
        if !players.contains(&derived) {
            players.push(derived);
        }
    }
    Ok(players)
}

async fn lookup(pool: &PgPool, subject: &str) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT user_id FROM auth_subjects WHERE subject = $1")
        .bind(subject)
        .fetch_optional(pool)
        .await
}

/// The player id Puzzled derived from an old-form subject (`principal-<uuid>`,
/// or a bare uuid) before this map existed. Kept only so those players keep
/// their data; removed after Auth's day 15 (2026-10-18), once every such player
/// has a row. Any other form, the TypeID included, is `None`.
#[must_use]
pub fn legacy_player_id(subject: &str) -> Option<Uuid> {
    let raw = subject.strip_prefix("principal-").unwrap_or(subject);
    Uuid::parse_str(raw).ok()
}

/// Links new-form subjects from the platform's id map export (family
/// `auth.principal`, cloud#10008 §4.4), loaded into a temporary table
/// `id_map_import (old_text text, new_text text)`. Run it once, in one
/// transaction, right after Auth's cut and again before its day 15. A
/// subject that already has a row keeps it; list those whose player differs
/// from the old subject's with [`SPLIT_PLAYERS_AFTER_LINK`].
pub const LINK_FROM_ID_MAP: &str = "
INSERT INTO auth_subjects (subject, user_id)
SELECT m.new_text, p.user_id
FROM id_map_import m
CROSS JOIN LATERAL (
  SELECT COALESCE(
    (SELECT s.user_id FROM auth_subjects s WHERE s.subject = m.old_text),
    CASE WHEN m.old_text ~ '^principal-[0-9a-fA-F-]{36}$'
         THEN substring(m.old_text FROM 11)::uuid END
  ) AS user_id
) p
WHERE p.user_id IS NOT NULL
ON CONFLICT (subject) DO NOTHING";

/// Subjects whose new form was first seen without its legacy subject and so
/// became a separate player: resolved by hand (move the data, then the row).
pub const SPLIT_PLAYERS_AFTER_LINK: &str = "
SELECT m.old_text, m.new_text, o.user_id AS old_player, n.user_id AS new_player
FROM id_map_import m
JOIN auth_subjects n ON n.subject = m.new_text
LEFT JOIN auth_subjects o ON o.subject = m.old_text
WHERE n.user_id IS DISTINCT FROM COALESCE(o.user_id,
  CASE WHEN m.old_text ~ '^principal-[0-9a-fA-F-]{36}$'
       THEN substring(m.old_text FROM 11)::uuid END)";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_the_old_form_maps_without_a_row() {
        assert_eq!(
            legacy_player_id("principal-0199aa10-7b2c-7d3e-8f00-1234567890ab"),
            Some(Uuid::parse_str("0199aa10-7b2c-7d3e-8f00-1234567890ab").unwrap())
        );
        assert_eq!(legacy_player_id("principal-not-a-uuid"), None);
        assert_eq!(legacy_player_id("usr_01kmp4wyhhfgxsyrjvh8e0tkkf"), None);
    }
}
