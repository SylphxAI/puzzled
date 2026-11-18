//! The games each player chose to play free on a product day.
//!
//! Serving a board only reads the picks; the first graded write (a checked
//! guess or a submitted finish) claims one, under the player's lock, so a
//! glance at a game page never spends a pick.
use chrono::NaiveDate;
use puzzled_core::billing_access::policy::free_pick_open;
use sqlx::{PgConnection, Row};
use uuid::Uuid;

/// Today's picks across the given players (an account and the guest it is
/// about to adopt count as one set).
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Picks {
    /// This game is already one of the picks.
    pub chosen: bool,
    /// Distinct games picked.
    pub count: u32,
}

impl Picks {
    /// The game may be played free: chosen already, or a pick is left.
    #[must_use]
    pub fn open(self) -> bool {
        free_pick_open(self.chosen, self.count)
    }
}

pub async fn read<'e, E>(
    executor: E,
    players: &[Uuid],
    day: NaiveDate,
    slug: &str,
) -> Result<Picks, sqlx::Error>
where
    E: sqlx::PgExecutor<'e>,
{
    if players.is_empty() {
        return Ok(Picks::default());
    }
    let row = sqlx::query(
        "SELECT count(DISTINCT game_slug) AS count, coalesce(bool_or(game_slug = $3), false) AS chosen FROM daily_free_picks WHERE user_id = ANY($1) AND day_key = $2",
    )
    .bind(players)
    .bind(day)
    .bind(slug)
    .fetch_one(executor)
    .await?;
    Ok(Picks {
        chosen: row.try_get("chosen")?,
        count: u32::try_from(row.try_get::<i64, _>("count")?).unwrap_or(u32::MAX),
    })
}

/// Take the game as one of the player's picks; false when none is left.
///
/// The caller holds the player's lock through commit (the same lock admission,
/// adoption and erasure take), so two tabs cannot both take the last pick.
pub async fn claim(
    connection: &mut PgConnection,
    player: Uuid,
    day: NaiveDate,
    slug: &str,
) -> Result<bool, sqlx::Error> {
    let picks = read(&mut *connection, &[player], day, slug).await?;
    if picks.chosen {
        return Ok(true);
    }
    if !picks.open() {
        return Ok(false);
    }
    sqlx::query(
        "INSERT INTO daily_free_picks (user_id, day_key, game_slug) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
    )
    .bind(player)
    .bind(day)
    .bind(slug)
    .execute(connection)
    .await?;
    Ok(true)
}

/// Merge the guest's picks into the account: a set union, so neither side
/// loses a game it already opened (the union may exceed the daily limit).
/// Both player locks are held by the outer adoption transaction.
pub async fn adopt(
    connection: &mut PgConnection,
    account: Uuid,
    guest: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO daily_free_picks (user_id, day_key, game_slug, started_at) SELECT $1, day_key, game_slug, started_at FROM daily_free_picks WHERE user_id = $2 ON CONFLICT DO NOTHING",
    )
    .bind(account)
    .bind(guest)
    .execute(&mut *connection)
    .await?;
    sqlx::query("DELETE FROM daily_free_picks WHERE user_id = $1")
        .bind(guest)
        .execute(connection)
        .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::fresh_database;

    fn day() -> NaiveDate {
        NaiveDate::from_ymd_opt(2026, 11, 18).unwrap()
    }

    #[tokio::test]
    async fn three_games_are_taken_a_fourth_is_refused_and_a_repeat_stays_open() {
        let Some(pool) = fresh_database().await else {
            return;
        };
        let player = Uuid::now_v7();
        let mut connection = pool.acquire().await.unwrap();
        for slug in ["sudoku", "crossword", "word-guess"] {
            assert!(claim(&mut connection, player, day(), slug).await.unwrap());
        }
        assert!(!claim(&mut connection, player, day(), "nonogram")
            .await
            .unwrap());
        assert!(claim(&mut connection, player, day(), "sudoku")
            .await
            .unwrap());
        let picks = read(&pool, &[player], day(), "nonogram").await.unwrap();
        assert_eq!(
            picks,
            Picks {
                chosen: false,
                count: 3
            }
        );
        assert!(!picks.open());
        // A new day starts with every pick free again.
        let tomorrow = day().succ_opt().unwrap();
        assert!(claim(&mut connection, player, tomorrow, "nonogram")
            .await
            .unwrap());
    }

    #[tokio::test]
    async fn sign_in_merges_the_guest_picks_without_losing_either_side() {
        let Some(pool) = fresh_database().await else {
            return;
        };
        let (account, guest) = (Uuid::now_v7(), Uuid::now_v7());
        let mut connection = pool.acquire().await.unwrap();
        for slug in ["sudoku", "crossword"] {
            assert!(claim(&mut connection, account, day(), slug).await.unwrap());
        }
        for slug in ["crossword", "word-guess", "nonogram"] {
            assert!(claim(&mut connection, guest, day(), slug).await.unwrap());
        }
        // Before adoption the two players already count as one set.
        let both = read(&pool, &[account, guest], day(), "crowns")
            .await
            .unwrap();
        assert_eq!(both.count, 4);
        adopt(&mut connection, account, guest).await.unwrap();
        let merged = read(&pool, &[account], day(), "nonogram").await.unwrap();
        assert_eq!(
            merged,
            Picks {
                chosen: true,
                count: 4
            }
        );
        assert_eq!(
            read(&pool, &[guest], day(), "sudoku").await.unwrap().count,
            0
        );
        // Every merged game stays open; no new one is.
        assert!(claim(&mut connection, account, day(), "word-guess")
            .await
            .unwrap());
        assert!(!claim(&mut connection, account, day(), "crowns")
            .await
            .unwrap());
    }
}
