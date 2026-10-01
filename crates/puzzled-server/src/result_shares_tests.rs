//! Shared daily results against a real database: the share is created from the
//! player's own accepted finish, an id is minted once, taps are counted, the
//! public read carries card facts only, and a guest's shares follow the guest
//! onto the account. Needs `PUZZLED_TEST_DATABASE_URL` like the other database
//! tests; CI sets it and `PUZZLED_REQUIRE_DB_TESTS=1`.

use chrono::NaiveDate;
use sqlx::PgPool;
use uuid::Uuid;

use crate::capabilities::puzzle_play::adapters::game_sessions_db::persist_validated_session;
use crate::capabilities::puzzle_play::adapters::result_shares_db::{
    adopt_guest_shares, load_shared_result, record_share, set_share_streak,
};
use crate::test_support::fresh_database;

const DAY: &str = "2026-09-28";

async fn finish(pool: &PgPool, user: &Uuid, game: &str, status: &str, attempts: u32) {
    let day = NaiveDate::parse_from_str(DAY, "%Y-%m-%d").unwrap();
    persist_validated_session(
        pool,
        &user.to_string(),
        game,
        None,
        "daily",
        status,
        Some(70),
        attempts,
        61_000,
        None,
        Some(day),
        Some(day),
        0,
    )
    .await
    .expect("finish stored");
}

async fn count(pool: &PgPool, id: Uuid) -> i32 {
    sqlx::query_scalar("SELECT share_count FROM result_shares WHERE id = $1")
        .bind(id)
        .fetch_one(pool)
        .await
        .unwrap()
}

#[tokio::test]
async fn a_share_needs_a_finish_and_is_created_once() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let user = Uuid::now_v7();
    let uid = user.to_string();

    // No finish yet: nothing to share.
    assert_eq!(
        record_share(&pool, &uid, "sudoku", DAY, false)
            .await
            .unwrap(),
        None
    );

    finish(&pool, &user, "sudoku", "won", 3).await;
    let id = record_share(&pool, &uid, "sudoku", DAY, false)
        .await
        .unwrap()
        .expect("a finish can be shared");
    assert_eq!(id.get_version_num(), 7, "ids are UUIDv7");
    assert_eq!(
        count(&pool, id).await,
        0,
        "creating a share is not a share tap"
    );

    // Same player, module and day: same id; a tap counts once.
    let again = record_share(&pool, &uid, "sudoku", DAY, true)
        .await
        .unwrap();
    assert_eq!(again, Some(id));
    assert_eq!(count(&pool, id).await, 1);
    record_share(&pool, &uid, "sudoku", DAY, true)
        .await
        .unwrap();
    assert_eq!(count(&pool, id).await, 2);

    // Another module or another player is a different share (or none).
    assert_eq!(
        record_share(&pool, &uid, "word-guess", DAY, false)
            .await
            .unwrap(),
        None
    );
    assert_eq!(
        record_share(&pool, &Uuid::now_v7().to_string(), "sudoku", DAY, false)
            .await
            .unwrap(),
        None
    );
}

#[tokio::test]
async fn the_public_read_returns_card_facts_only() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let user = Uuid::now_v7();
    finish(&pool, &user, "sudoku", "lost", 4).await;
    let id = record_share(&pool, &user.to_string(), "sudoku", DAY, false)
        .await
        .unwrap()
        .unwrap();

    let shared = load_shared_result(&pool, id).await.unwrap().unwrap();
    assert_eq!(shared.game_slug, "sudoku");
    assert_eq!(shared.day_key, DAY);
    assert_eq!(shared.status, "lost");
    assert_eq!(shared.attempts, 4);
    assert_eq!(shared.score, Some(70));
    assert_eq!(shared.time_spent_ms, Some(61_000));
    // The struct has no user id, solution or session state to leak; an unknown id reads as none.
    assert_eq!(
        load_shared_result(&pool, Uuid::now_v7()).await.unwrap(),
        None
    );
}

#[tokio::test]
async fn adopting_a_guest_keeps_the_account_share_on_a_conflict() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let (guest, account) = (Uuid::now_v7(), Uuid::now_v7());
    for user in [&guest, &account] {
        finish(&pool, user, "sudoku", "won", 3).await;
    }
    finish(&pool, &guest, "word-guess", "won", 2).await;
    let guest_sudoku = record_share(&pool, &guest.to_string(), "sudoku", DAY, false)
        .await
        .unwrap()
        .unwrap();
    let guest_words = record_share(&pool, &guest.to_string(), "word-guess", DAY, false)
        .await
        .unwrap()
        .unwrap();
    let account_sudoku = record_share(&pool, &account.to_string(), "sudoku", DAY, false)
        .await
        .unwrap()
        .unwrap();

    let mut tx = pool.begin().await.unwrap();
    assert_eq!(adopt_guest_shares(&mut tx, account, guest).await.unwrap(), 1);
    tx.commit().await.unwrap();

    let owner = |id: Uuid| {
        let pool = pool.clone();
        async move {
            sqlx::query_scalar::<_, Uuid>("SELECT user_id FROM result_shares WHERE id = $1")
                .bind(id)
                .fetch_one(&pool)
                .await
                .unwrap()
        }
    };
    assert_eq!(
        owner(guest_words).await,
        account,
        "a share with no clash moves over"
    );
    assert_eq!(
        owner(account_sudoku).await,
        account,
        "the account row is kept"
    );
    assert_eq!(
        owner(guest_sudoku).await,
        guest,
        "the clashing guest row stays with the guest"
    );
}

#[tokio::test]
async fn the_sharers_streak_is_kept_once_and_shown_on_the_card() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let user = Uuid::now_v7();
    let uid = user.to_string();
    finish(&pool, &user, "sudoku", "won", 3).await;
    let id = record_share(&pool, &uid, "sudoku", DAY, false)
        .await
        .unwrap()
        .expect("a finish can be shared");
    assert_eq!(
        load_shared_result(&pool, id).await.unwrap().unwrap().streak,
        None
    );

    set_share_streak(&pool, id, 9).await.unwrap();
    // A later tap on a longer streak does not rewrite what the card showed.
    set_share_streak(&pool, id, 12).await.unwrap();
    assert_eq!(
        load_shared_result(&pool, id).await.unwrap().unwrap().streak,
        Some(9)
    );
}
