//! Who holds Puzzled Plus: Sylphx Money's answer, plus the family plans
//! Puzzled itself keeps (Money has no seat members).

use puzzled_core::billing_access::reverse_trial;
use sqlx::PgPool;

use super::adapters::billing_db;
use crate::capabilities::money::{access, Money};

/// Is `user_id` a Platform account (a UUID), not a guest-day id?
#[must_use]
pub fn is_account_id(user_id: &str) -> bool {
    uuid::Uuid::parse_str(user_id).is_ok()
}

/// Where the account's access comes from.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Entitlement {
    pub entitled: bool,
    /// Owner of the family plan that grants access, when access comes from one.
    pub family_owner: Option<String>,
    /// End of the reverse trial (epoch ms), when access comes from it.
    pub trial_ends_ms: Option<i64>,
}

/// Is the reverse trial on? Off unless `PUZZLED_REVERSE_TRIAL=on`; it is
/// switched on together with Plus sales (docs/growth.md).
#[must_use]
pub fn reverse_trial_enabled() -> bool {
    std::env::var("PUZZLED_REVERSE_TRIAL").is_ok_and(|v| v.trim().eq_ignore_ascii_case("on"))
}

/// The account's reverse trial: grant it when three days are finished and it
/// was never granted, and say when a running one ends. A failed read means no
/// trial (fail closed to the free floor).
pub async fn reverse_trial_ends_ms(
    pool: &PgPool,
    user_id: &str,
    now_ms: i64,
    enabled: bool,
) -> Option<i64> {
    if !enabled {
        return None;
    }
    let result: Result<Option<i64>, String> = async {
        let mut granted = billing_db::trial_ends_at_ms(pool, user_id).await?;
        if granted.is_none() {
            let finished = billing_db::finished_days(pool, user_id).await?;
            if reverse_trial::should_grant(true, None, finished) {
                granted = Some(
                    billing_db::grant_trial(pool, user_id, reverse_trial::ends_at(now_ms)).await?,
                );
            }
        }
        Ok(granted)
    }
    .await;
    match result {
        Ok(granted) => match reverse_trial::state_of(granted, now_ms) {
            reverse_trial::TrialState::Active { ends_at_ms } => Some(ends_at_ms),
            _ => None,
        },
        Err(error) => {
            tracing::warn!(%error, "reverse trial read failed; no trial access");
            None
        }
    }
}

/// The account's access: Money's `plus` answer, or a place in a family whose
/// owner holds the `family` feature in Money. Without Money, or when Money
/// cannot answer, no one is entitled (fail closed).
pub async fn access(
    pool: &PgPool,
    money: Option<&Money>,
    user_id: &str,
) -> Result<Entitlement, String> {
    let Some(money) = money else {
        return Ok(Entitlement::default());
    };
    if !is_account_id(user_id) {
        return Ok(Entitlement::default());
    }
    if access::is_premium(money, user_id).await {
        return Ok(Entitlement {
            entitled: true,
            family_owner: None,
            trial_ends_ms: None,
        });
    }
    if let Some(owner) = billing_db::family_owner_of(pool, user_id).await? {
        if access::family_active(money, &owner).await {
            return Ok(Entitlement {
                entitled: true,
                family_owner: Some(owner),
                trial_ends_ms: None,
            });
        }
    }
    if let Some(ends) = reverse_trial_ends_ms(
        pool,
        user_id,
        chrono::Utc::now().timestamp_millis(),
        reverse_trial_enabled(),
    )
    .await
    {
        return Ok(Entitlement {
            entitled: true,
            family_owner: None,
            trial_ends_ms: Some(ends),
        });
    }
    Ok(Entitlement::default())
}

#[cfg(test)]
mod tests {
    use super::*;

    const USER: &str = "0192a000-0000-7000-8000-000000000001";

    async fn session_on(pool: &PgPool, day: &str, status: &str) {
        sqlx::query(
            r#"INSERT INTO "game_sessions" ("user_id", "game_slug", "day_key", "is_ritual", "status")
               VALUES ($1::uuid, $2, $3, true, $4::game_status)"#,
        )
        .bind(USER)
        .bind(format!("game-{day}"))
        .bind(day)
        .bind(status)
        .execute(pool)
        .await
        .unwrap();
    }

    async fn finish_day(pool: &PgPool, day: &str) {
        session_on(pool, day, "won").await;
    }

    #[tokio::test]
    async fn only_won_or_lost_days_count_as_finished() {
        let Some(pool) = crate::test_support::fresh_database().await else {
            return;
        };
        session_on(&pool, "2026-10-01", "won").await;
        session_on(&pool, "2026-10-02", "lost").await;
        session_on(&pool, "2026-10-03", "in_progress").await;
        assert_eq!(billing_db::finished_days(&pool, USER).await.unwrap(), 2);
        // Started-only days never reach the three-day threshold.
        assert_eq!(reverse_trial_ends_ms(&pool, USER, 1, true).await, None);
    }

    #[tokio::test]
    async fn the_trial_starts_after_the_third_finished_day_once_and_ends() {
        let Some(pool) = crate::test_support::fresh_database().await else {
            return;
        };
        let now = 1_800_000_000_000_i64;
        finish_day(&pool, "2026-10-01").await;
        finish_day(&pool, "2026-10-02").await;
        // Off: never, even with enough days.
        finish_day(&pool, "2026-10-03").await;
        assert_eq!(reverse_trial_ends_ms(&pool, USER, now, false).await, None);
        // Two days are not enough: use a second account.
        assert_eq!(billing_db::finished_days(&pool, USER).await.unwrap(), 3);
        // On, three finished days: granted for seven days.
        let ends = reverse_trial_ends_ms(&pool, USER, now, true).await;
        assert_eq!(ends, Some(reverse_trial::ends_at(now)));
        // Asking again later keeps the same end (one grant per account).
        let later = now + 86_400_000;
        assert_eq!(reverse_trial_ends_ms(&pool, USER, later, true).await, ends);
        // After the end: no access, and never a second grant, however many days follow.
        let over = reverse_trial::ends_at(now) + 1;
        finish_day(&pool, "2026-10-04").await;
        assert_eq!(reverse_trial_ends_ms(&pool, USER, over, true).await, None);
        assert_eq!(
            billing_db::trial_ends_at_ms(&pool, USER).await.unwrap(),
            Some(reverse_trial::ends_at(now))
        );
    }

    #[tokio::test]
    async fn two_finished_days_grant_nothing() {
        let Some(pool) = crate::test_support::fresh_database().await else {
            return;
        };
        finish_day(&pool, "2026-10-01").await;
        finish_day(&pool, "2026-10-02").await;
        assert_eq!(reverse_trial_ends_ms(&pool, USER, 1, true).await, None);
        assert_eq!(
            billing_db::trial_ends_at_ms(&pool, USER).await.unwrap(),
            None
        );
    }
}
