//! The public overview stays fresh and matches the ritual contract on migrated
//! scratch Postgres. No production data or credentials are involved.
use crate::capabilities::stats::adapters::sessions_stats_db::today_overview;
use crate::test_support::fresh_database;
use puzzled_core::puzzle_play::ritual_completion::{
    compute_today_overview, RitualOverviewRow, DRC_RECOMPUTE_SQL,
};
use sqlx::{postgres::PgPoolOptions, PgPool};
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};
use uuid::Uuid;

async fn finish(
    pool: &PgPool,
    user: Uuid,
    day: &str,
    game: &str,
    ritual: bool,
    class: &str,
    status: &str,
) {
    sqlx::query("INSERT INTO game_sessions (user_id,game_slug,day_key,is_ritual,module_class,status) VALUES ($1,$2,$3,$4,$5,$6::game_status)")
        .bind(user).bind(game).bind(day).bind(ritual).bind(class).bind(status)
        .execute(pool).await.unwrap();
}

#[tokio::test]
async fn today_overview_is_one_acquisition_and_matches_fresh_day_oracles() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let acquisitions = Arc::new(AtomicUsize::new(0));
    let counter = acquisitions.clone();
    let measured = PgPoolOptions::new()
        .max_connections(1)
        .before_acquire(move |_, _| {
            counter.fetch_add(1, Ordering::SeqCst);
            Box::pin(async { Ok(true) })
        })
        .connect_with((*pool.connect_options()).clone())
        .await
        .unwrap();
    // Warm the one connection, so before_acquire observes every tested read.
    drop(measured.acquire().await.unwrap());
    acquisitions.store(0, Ordering::SeqCst);
    let day = "2026-11-02";
    let empty = today_overview(&measured, day).await.unwrap();
    assert_eq!(empty.player_count, 0);
    assert!(empty.completions.is_empty());
    assert_eq!(acquisitions.load(Ordering::SeqCst), 1);

    let a = Uuid::now_v7();
    let b = Uuid::now_v7();
    let other = Uuid::now_v7();
    let mut qualifying = Vec::new();
    for (user, game, status) in [
        (a, "sudoku", "won"),
        (a, "word-guess", "lost"),
        (b, "sudoku", "lost"),
    ] {
        finish(&pool, user, day, game, true, "puzzle_ritual", status).await;
        qualifying.push(RitualOverviewRow {
            user_id: user.to_string(),
            day_key: day.into(),
            game_module_id: game.into(),
            module_class: puzzled_core::puzzle_play::game_slugs::ModuleClass::PuzzleRitual,
            is_ritual: true,
        });
    }
    // Adjacent product days, non-ritual, entertainment and nonterminal rows
    // must not enter either count. A player's two games count once globally.
    for (row_day, game, ritual, class, status) in [
        ("2026-11-01", "sudoku", true, "puzzle_ritual", "won"),
        ("2026-11-03", "sudoku", true, "puzzle_ritual", "won"),
        (day, "practice", false, "puzzle_ritual", "won"),
        (day, "archive", false, "puzzle_ritual", "lost"),
        (day, "oracle", true, "entertainment_oracle", "won"),
        (day, "started", true, "puzzle_ritual", "in_progress"),
        (day, "abandoned", true, "puzzle_ritual", "abandoned"),
    ] {
        finish(&pool, other, row_day, game, ritual, class, status).await;
    }
    acquisitions.store(0, Ordering::SeqCst);
    let actual = today_overview(&measured, day).await.unwrap();
    assert_eq!(acquisitions.load(Ordering::SeqCst), 1);
    assert_eq!(actual, compute_today_overview(day, &qualifying));
    assert_eq!(actual.player_count, 2);
    assert_eq!(
        actual.completions,
        [("sudoku".into(), 2), ("word-guess".into(), 1)]
    );
    let oracle: i64 = sqlx::query_scalar(DRC_RECOMPUTE_SQL)
        .bind(day)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(actual.player_count, oracle as u64);

    // A newly committed finish must appear on the very next read, not after
    // a TTL; the following Hong Kong product day must not reuse today's data.
    finish(&pool, other, day, "sudoku", true, "puzzle_ritual", "won").await;
    let fresh = today_overview(&measured, day).await.unwrap();
    assert_eq!(fresh.player_count, 3);
    assert_eq!(fresh.completions[0], ("sudoku".into(), 3));
    let next = today_overview(&measured, "2026-11-03").await.unwrap();
    assert_eq!(next.player_count, 1);
    assert_eq!(next.completions, [("sudoku".into(), 1)]);
    let absent = today_overview(&measured, "2026-11-04").await.unwrap();
    assert_eq!(absent.player_count, 0);
    assert!(absent.completions.is_empty());

    // Database failure is an error, never a plausible but fabricated zero.
    measured.close().await;
    assert!(today_overview(&measured, day).await.is_err());
}
