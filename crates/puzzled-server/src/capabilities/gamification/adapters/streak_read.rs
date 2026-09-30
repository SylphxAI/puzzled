//! One read of a player's streak with freezes settled.

use chrono::NaiveDate;
use puzzled_core::gamification::personal_streak::{compute_personal_streak, PersonalStreak};
use sqlx::PgPool;

use super::freezes_db::{settle_player_freezes, FreezeRow};
use super::streak_sessions_db::load_accepted_ritual_days;
use crate::capabilities::puzzle_play::adapters::game_sessions_db::count_sessions;

/// A player's streak as of `today`, plus their total finished games and freeze
/// counters. Reading settles freezes first (milestones earned since the last
/// read are granted; a missed day a held freeze covers is recorded), so every
/// caller sees the same run.
pub async fn load_settled_streak(
    pool: &PgPool,
    user_id: &str,
    today: NaiveDate,
) -> Result<(PersonalStreak, u32, FreezeRow), String> {
    let days = load_accepted_ritual_days(pool, user_id).await?;
    let total = count_sessions(pool, user_id).await?;
    let (row, frozen) = settle_player_freezes(pool, user_id, today, &days).await?;
    Ok((compute_personal_streak(today, &days, &frozen), total, row))
}
