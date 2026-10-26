//! Aggregate acceptance against migrated Postgres; no production rows.
use crate::{capabilities::metrics, test_support::fresh_database};
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

fn time(raw: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(raw)
        .unwrap()
        .with_timezone(&Utc)
}
async fn finish(
    pool: &PgPool,
    user: Uuid,
    day: &str,
    game: &str,
    ritual: bool,
    class: &str,
    status: &str,
) {
    sqlx::query("INSERT INTO game_sessions (user_id,game_slug,day_key,is_ritual,module_class,status,completed_at) VALUES ($1,$2,$3,$4,$5,$6::game_status,$7::text::timestamp)")
        .bind(user).bind(game).bind(day).bind(ritual).bind(class).bind(status).bind(format!("{day} 04:00:00")).execute(pool).await.unwrap();
}

#[tokio::test]
async fn rollup_matches_the_oracles_and_keeps_closed_cohort_and_landing_semantics() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let a = Uuid::now_v7();
    let b = Uuid::now_v7();
    let visitor = Uuid::now_v7();
    for day in [
        "2026-10-18",
        "2026-10-20",
        "2026-10-21",
        "2026-10-23",
        "2026-10-25",
    ] {
        finish(&pool, a, day, "sudoku", true, "puzzle_ritual", "won").await;
    }
    finish(
        &pool,
        b,
        "2026-10-18",
        "sudoku",
        true,
        "puzzle_ritual",
        "won",
    )
    .await;
    // Multiple games count once; terminal loss counts, archive/practice/nonterminal/oracle do not.
    finish(
        &pool,
        a,
        "2026-10-25",
        "word-guess",
        true,
        "puzzle_ritual",
        "lost",
    )
    .await;
    for (game, ritual, class, status) in [
        ("practice", false, "puzzle_ritual", "won"),
        ("archive", false, "puzzle_ritual", "won"),
        ("oracle", true, "entertainment_oracle", "won"),
        ("started", true, "puzzle_ritual", "in_progress"),
    ] {
        finish(&pool, b, "2026-10-25", game, ritual, class, status).await;
    }
    finish(
        &pool,
        visitor,
        "2026-10-25",
        "sudoku",
        true,
        "puzzle_ritual",
        "won",
    )
    .await;
    sqlx::query("INSERT INTO auth_subjects (subject,user_id) VALUES ('test-account',$1)")
        .bind(a)
        .execute(&pool)
        .await
        .unwrap();
    let share = Uuid::now_v7();
    sqlx::query("INSERT INTO result_shares (id,user_id,game_slug,day_key,status,attempts) VALUES ($1,$2,'sudoku','2026-10-25','won',1)").bind(share).bind(a).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO share_landings (user_id,share_id,day_key,landed_at) VALUES ($1,$3,'2026-10-25','2026-10-25T03:00:00Z'), ($2,$3,'2026-10-25','2026-10-25T05:00:00Z')")
        .bind(visitor).bind(a).bind(share).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO funnel_events (id,event,occurred_at) VALUES ($1,'share_landing','2026-10-24T16:00:00Z'),($2,'share_landing','2026-10-25T15:59:59Z'),($3,'share_landing','2026-10-25T16:00:00Z')").bind(Uuid::now_v7()).bind(Uuid::now_v7()).bind(Uuid::now_v7()).execute(&pool).await.unwrap();
    let now = time("2026-10-25T16:17:00Z"); // HK day 26, day 25 closed.
    assert_eq!(metrics::rollup(&pool, now).await.unwrap(), 35);
    let reports = metrics::reports(&pool).await.unwrap();
    let today = &reports[0].0;
    assert_eq!(today.day_key, "2026-10-26");
    assert!(!today.complete);
    let d = &reports[1].0;
    assert!(d.complete);
    assert_eq!(
        (
            d.daily_puzzle_completers,
            d.signed_in_completers,
            d.daily_entertainment_completers
        ),
        (2, 1, 1)
    );
    assert_eq!((d.weekly_ritualists, d.d7_cohort, d.d7_returned), (1, 2, 1));
    assert_eq!((d.share_landings, d.share_landing_completers), (2, 1));
    use puzzled_core::puzzle_play::ritual_completion::{DRC_RECOMPUTE_SQL, HRC_RECOMPUTE_SQL};
    let drc: i64 = sqlx::query_scalar(DRC_RECOMPUTE_SQL)
        .bind("2026-10-25")
        .fetch_one(&pool)
        .await
        .unwrap();
    let hrc: i64 = sqlx::query_scalar(HRC_RECOMPUTE_SQL)
        .bind("2026-10-25")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!((d.daily_puzzle_completers, d.weekly_ritualists), (drc, hrc));
    let encoded = serde_json::to_string(d).unwrap();
    assert!(!encoded.contains(&a.to_string()) && !encoded.contains(&visitor.to_string()));
    metrics::rollup(&pool, now).await.unwrap();
    assert_eq!(metrics::reports(&pool).await.unwrap().len(), 35);
    // At HK 00:02 the previous day has not yet had its late-event allowance.
    metrics::rollup(&pool, time("2026-10-25T16:02:00Z"))
        .await
        .unwrap();
    assert!(!metrics::reports(&pool).await.unwrap()[1].0.complete);
}

#[tokio::test]
async fn landings_are_deduplicated_foreign_only_adopted_and_not_finishes() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let owner = Uuid::now_v7();
    let guest = Uuid::now_v7();
    let account = Uuid::now_v7();
    let share = Uuid::now_v7();
    sqlx::query("INSERT INTO result_shares (id,user_id,game_slug,day_key,status,attempts) VALUES ($1,$2,'sudoku','2026-10-25','won',1)").bind(share).bind(owner).execute(&pool).await.unwrap();
    let mut tx = pool.begin().await.unwrap();
    assert!(!metrics::landing_on(&mut tx, owner, share).await.unwrap());
    assert!(!metrics::landing_on(&mut tx, guest, Uuid::now_v7())
        .await
        .unwrap());
    assert!(metrics::landing_on(&mut tx, guest, share).await.unwrap());
    assert!(!metrics::landing_on(&mut tx, guest, share).await.unwrap());
    metrics::adopt(&mut tx, account, guest).await.unwrap();
    assert!(!metrics::landing_on(&mut tx, account, share).await.unwrap());
    tx.commit().await.unwrap();
    let users: Vec<Uuid> = sqlx::query_scalar("SELECT user_id FROM share_landings")
        .fetch_all(&pool)
        .await
        .unwrap();
    assert_eq!(users, vec![account]);
    let sessions: i64 = sqlx::query_scalar("SELECT count(*) FROM game_sessions")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(sessions, 0);
    // The same erasure inventory used by account deletion removes these receipts.
    let mut tx = pool.begin().await.unwrap();
    for (table, _, sql) in
        crate::capabilities::preferences::adapters::account_deletion::USER_KEYED_COLUMNS
    {
        if *table == "share_landings" || *table == "metric_audiences" {
            sqlx::query(*sql)
                .bind(account)
                .execute(&mut *tx)
                .await
                .unwrap();
        }
    }
    tx.commit().await.unwrap();
    let left: i64 = sqlx::query_scalar("SELECT count(*) FROM share_landings")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(left, 0);
}

#[tokio::test]
async fn alerts_are_durable_emitted_once_per_day_and_rollup_retries_do_not_duplicate_them() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    sqlx::query("INSERT INTO metric_counters (day_key,event,count) VALUES ('2026-10-25','share',20), ('2026-10-25','free_finish_failed',5)").execute(&pool).await.unwrap();
    let now = time("2026-10-25T16:17:00Z");
    metrics::rollup(&pool, now).await.unwrap();
    metrics::rollup(&pool, now).await.unwrap();
    let alerts: Vec<(String, bool)> = sqlx::query_as(
        "SELECT signal, emitted_at IS NOT NULL FROM metric_alert_outbox ORDER BY signal",
    )
    .fetch_all(&pool)
    .await
    .unwrap();
    assert_eq!(
        alerts,
        vec![
            ("free_finish_errors".into(), true),
            ("shares_without_landings".into(), true)
        ]
    );
    let d = &metrics::reports(&pool).await.unwrap()[1].0;
    assert_eq!(d.alerts.len(), 2);
}
