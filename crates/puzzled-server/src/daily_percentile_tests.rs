//! Migrated, isolated populated cohorts through the production Connect router.
//! No production row reads, fixture endpoint or client-supplied ranking authority.
#![allow(clippy::unwrap_used)]
use crate::test_support::{fresh_database, token};
use crate::{router, AppState};
use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use chrono::Utc;
use puzzled_core::puzzle_play::daily_time::product_day_key_string;
use serde_json::{json, Value};
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

async fn rpc(pool: Option<&PgPool>, viewer: Option<Uuid>, body: Value) -> Value {
    let mut request = Request::builder()
        .method("POST")
        .uri("/puzzled.v1.StatsService/GetTodayPercentile")
        .header("content-type", "application/json");
    if let Some(viewer) = viewer {
        request = request.header(
            "authorization",
            format!("Bearer {}", token(&viewer.to_string())),
        );
    }
    let response = router(AppState::new(pool.cloned()))
        .oneshot(request.body(Body::from(body.to_string())).unwrap())
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response.headers()["cache-control"],
        "private, no-store, max-age=0"
    );
    assert_eq!(response.headers()["cdn-cache-control"], "no-store");
    serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap()
}

async fn seed(pool: &PgPool, slug: &str, me_at: i32) -> Uuid {
    let me = Uuid::now_v7();
    for i in 0..12_i32 {
        sqlx::query(
            "INSERT INTO game_sessions
            (user_id, game_slug, mode, status, score, attempts, time_spent_ms,
             hints_used, day_key, is_ritual, module_class)
            VALUES ($1,$2,'daily','won',$3,$4,$5,$6,$7,true,'puzzle_ritual')",
        )
        .bind(if i == me_at { me } else { Uuid::now_v7() })
        .bind(slug)
        .bind(if slug == "word-groups" {
            100 - (i % 4) * 25
        } else {
            i
        })
        .bind(i + 1)
        .bind((i + 1) * 1000)
        .bind(i64::from(i % 3))
        .bind(product_day_key_string(Utc::now()))
        .execute(pool)
        .await
        .unwrap();
    }
    me
}

fn absent_percentile(v: &Value, dispatch: &str) {
    assert!(v.get("percentile").is_none_or(Value::is_null), "{v}");
    assert_eq!(v["dispatch"], dispatch, "{v}");
}

#[tokio::test]
async fn accepted_cohort_percentile_every_game_strict_ties_and_authority() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    // Hand-computed fixtures: six strictly worse rows / twelve, including self.
    for slug in [
        "sudoku",
        "word-search",
        "nonogram",
        "killer-sudoku",
        "crowns",
        "duo",
        "crossword",
        "number-path",
        "pip-place",
        "pattern-match",
        "block-slide",
        "word-ladder",
        "word-guess",
        "quad-words",
        "arithmo",
        "word-box",
        "word-hive",
        "word-groups",
        "cryptogram",
    ] {
        let at = match slug {
            "word-hive" => 6,
            "word-groups" => 1,
            "cryptogram" => 4,
            _ => 5,
        };
        let me = seed(&pool, slug, at).await;
        // Even a valid identity cannot assert a metric or a denominator.
        let v = rpc(
            Some(&pool),
            Some(me),
            json!({"gameSlug":slug,
            "status":"lost", "score":2147483647,"attempts":0,"mistakes":0,
            "timeSpentMs":"0", "totalPlayers":1,"betterThan":999}),
        )
        .await;
        assert_eq!(v["percentile"], 50, "{slug}: {v}");
        assert_eq!(v["totalPlayers"], 12, "{slug}");
        assert_eq!(v["dayKey"], product_day_key_string(Utc::now()));
        assert_eq!(v["dispatch"], "product_db_sessions");
        assert!(v.get("score").is_none()); // no row export, even echoing caller input
        let unknown = rpc(
            Some(&pool),
            Some(Uuid::now_v7()),
            json!({"gameSlug":slug,"status":"won"}),
        )
        .await;
        absent_percentile(&unknown, "accepted_finish_required");
        let anon = rpc(
            Some(&pool),
            None,
            json!({"gameSlug":slug,"totalPlayers":100,"betterThan":100}),
        )
        .await;
        absent_percentile(&anon, "accepted_finish_required");
    }
    pool.close().await;
}

#[tokio::test]
async fn accepted_cohort_percentile_excludes_wrong_cohorts_and_orders_losses() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let me = seed(&pool, "sudoku", 5).await;
    let day = product_day_key_string(Utc::now());
    for (slug, d, mode, ritual, class, status, synthetic) in [
        (
            "sudoku",
            day.as_str(),
            "daily",
            false,
            "puzzle_ritual",
            "won",
            false,
        ),
        (
            "sudoku",
            day.as_str(),
            "daily",
            true,
            "puzzle_ritual",
            "in_progress",
            false,
        ),
        (
            "sudoku",
            day.as_str(),
            "daily",
            true,
            "puzzle_ritual",
            "abandoned",
            false,
        ),
        (
            "sudoku",
            "2000-01-01",
            "daily",
            true,
            "puzzle_ritual",
            "won",
            false,
        ),
        ("sudoku", day.as_str(), "daily", true, "other", "won", false),
        (
            "crossword",
            day.as_str(),
            "daily",
            true,
            "puzzle_ritual",
            "won",
            false,
        ),
        (
            "sudoku",
            day.as_str(),
            "archive",
            true,
            "puzzle_ritual",
            "won",
            false,
        ),
        (
            "sudoku",
            day.as_str(),
            "daily",
            true,
            "puzzle_ritual",
            "won",
            true,
        ),
    ] {
        sqlx::query(
            "INSERT INTO game_sessions (user_id,game_slug,day_key,mode,
            is_ritual,module_class,status,comparison_excluded,time_spent_ms)
            VALUES ($1,$2,$3,$4::game_mode,$5,$6,$7::game_status,$8,99000)",
        )
        .bind(Uuid::now_v7())
        .bind(slug)
        .bind(d)
        .bind(mode)
        .bind(ritual)
        .bind(class)
        .bind(status)
        .bind(synthetic)
        .execute(&pool)
        .await
        .unwrap();
    }
    let body = json!({"gameSlug":"sudoku", "dayKey":day});
    let v = rpc(Some(&pool), Some(me), body.clone()).await;
    assert_eq!(v["totalPlayers"], 12);
    assert_eq!(v["percentile"], 50);
    sqlx::query("UPDATE game_sessions SET status='lost' WHERE time_spent_ms=1000")
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(
        rpc(Some(&pool), Some(me), body.clone()).await["percentile"],
        58
    );
    sqlx::query("UPDATE game_sessions SET time_spent_ms=6000 WHERE time_spent_ms=7000")
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(
        rpc(Some(&pool), Some(me), body.clone()).await["percentile"],
        50
    );
    // A loss never beats a win even with a faster metric. It beats only slower losses.
    sqlx::query("UPDATE game_sessions SET status='lost' WHERE user_id=$1")
        .bind(me)
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(
        rpc(Some(&pool), Some(me), body.clone()).await["percentile"],
        0
    );
    sqlx::query("UPDATE game_sessions SET status='won',time_spent_ms=6000 WHERE game_slug='sudoku' AND NOT comparison_excluded AND is_ritual AND mode='daily' AND day_key=$1 AND module_class='puzzle_ritual' AND status IN ('won','lost')")
        .bind(&day).execute(&pool).await.unwrap();
    assert_eq!(
        rpc(Some(&pool), Some(me), body.clone()).await["percentile"],
        0
    );
    let past = rpc(
        Some(&pool),
        Some(me),
        json!({"gameSlug":"sudoku","dayKey":"2000-01-01"}),
    )
    .await;
    absent_percentile(&past, "different_day");
    pool.close().await;
}

#[tokio::test]
async fn accepted_cohort_percentile_empty_small_missing_data_and_unavailable_are_honest() {
    let no_db = rpc(
        None,
        None,
        json!({"gameSlug":"sudoku","totalPlayers":100,"betterThan":100}),
    )
    .await;
    absent_percentile(&no_db, "unavailable_data");
    assert_eq!(no_db["stub"], true);
    let Some(pool) = fresh_database().await else {
        return;
    };
    let empty = rpc(Some(&pool), None, json!({"gameSlug":"sudoku"})).await;
    absent_percentile(&empty, "empty_cohort");
    assert_eq!(
        empty
            .get("totalPlayers")
            .and_then(Value::as_i64)
            .unwrap_or(0),
        0
    );
    let me = seed(&pool, "cryptogram", 4).await;
    sqlx::query("UPDATE game_sessions SET hints_used=NULL WHERE attempts=1")
        .execute(&pool)
        .await
        .unwrap();
    let v = rpc(Some(&pool), Some(me), json!({"gameSlug":"cryptogram"})).await;
    absent_percentile(&v, "unavailable_data");
    assert_eq!(v["totalPlayers"], 12);
    let me = seed(&pool, "sudoku", 5).await;
    sqlx::query("DELETE FROM game_sessions WHERE game_slug='sudoku' AND attempts>=10")
        .execute(&pool)
        .await
        .unwrap();
    let v = rpc(Some(&pool), Some(me), json!({"gameSlug":"sudoku"})).await;
    absent_percentile(&v, "insufficient_cohort");
    assert_eq!(v["totalPlayers"], 9);
    // Ten is sufficient; ties count in the denominator, never as beaten.
    sqlx::query("INSERT INTO game_sessions (user_id,game_slug,mode,status,time_spent_ms,day_key,is_ritual,module_class) VALUES ($1,'sudoku','daily','won',6000,$2,true,'puzzle_ritual')")
        .bind(Uuid::now_v7()).bind(product_day_key_string(Utc::now())).execute(&pool).await.unwrap();
    let v = rpc(Some(&pool), Some(me), json!({"gameSlug":"sudoku"})).await;
    assert_eq!(v["totalPlayers"], 10);
    assert_eq!(v["percentile"], 30);
    pool.close().await;
}

#[tokio::test]
async fn accepted_cohort_percentile_submission_persists_hints_and_verification_exclusion() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let day = puzzled_core::puzzle_play::daily_time::product_day_key(Utc::now());
    let puzzle = Uuid::now_v7();
    sqlx::query("INSERT INTO daily_puzzles (id,game_slug,puzzle_date,puzzle_data,solution) VALUES ($1,'cryptogram',$2,'{\"encryptedText\":\"AB\"}'::jsonb,'{\"reverseCipher\":{\"A\":\"C\",\"B\":\"D\"}}'::jsonb)")
        .bind(puzzle).bind(day.and_hms_opt(0,0,0).unwrap()).execute(&pool).await.unwrap();
    // Normal accepted play, current verification and the old harness are all
    // validated identically. Only the latter two opt out of comparisons.
    for marker in ["player", "header", "old-harness"] {
        let me = Uuid::now_v7();
        let mut request = Request::builder()
            .method("POST")
            .uri("/puzzled.v1.PuzzleService/SubmitGuess")
            .header("content-type", "application/json")
            .header(
                "authorization",
                format!("Bearer {}", token(&me.to_string())),
            );
        if marker == "header" {
            request = request.header("x-puzzled-verification", "1");
        }
        if marker == "old-harness" {
            request = request.header("user-agent", "puzzled-verify-live/1 test");
        }
        let response = router(AppState::new(Some(pool.clone()))).oneshot(request.body(Body::from(json!({
            "gameSlug":"cryptogram", "puzzleId":puzzle.to_string(), "status":"won",
            "attempts":1,"timeSpentMs":"5000",
            "submissionJson":json!({"guesses":{"A":"C","B":"D"},"hintsUsed":2}).to_string()
        }).to_string())).unwrap()).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let accepted: Value =
            serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap())
                .unwrap();
        assert_eq!(accepted["valid"], true, "{accepted}");
        let (hints, excluded): (Option<i64>, bool) = sqlx::query_as(
            "SELECT hints_used,comparison_excluded FROM game_sessions WHERE user_id=$1",
        )
        .bind(me)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(hints, Some(2));
        assert_eq!(excluded, marker != "player");
        let v = rpc(Some(&pool), Some(me), json!({"gameSlug":"cryptogram"})).await;
        assert_eq!(v["totalPlayers"], 1);
        absent_percentile(
            &v,
            if marker == "player" {
                "insufficient_cohort"
            } else {
                "accepted_finish_required"
            },
        );
    }
    pool.close().await;
}

#[tokio::test]
async fn accepted_cohort_percentile_archive_id_cannot_masquerade_as_today() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let yesterday = puzzled_core::puzzle_play::daily_time::product_day_key(Utc::now())
        .pred_opt()
        .unwrap();
    let puzzle = Uuid::now_v7();
    sqlx::query("INSERT INTO daily_puzzles (id,game_slug,puzzle_date,puzzle_data,solution) VALUES ($1,'cryptogram',$2,'{\"encryptedText\":\"AB\"}'::jsonb,'{\"reverseCipher\":{\"A\":\"C\",\"B\":\"D\"}}'::jsonb)")
        .bind(puzzle).bind(yesterday.and_hms_opt(0,0,0).unwrap()).execute(&pool).await.unwrap();
    let me = Uuid::now_v7();
    for is_archive in [false, true] {
        let mut body = json!({"gameSlug":"cryptogram", "puzzleId":puzzle.to_string(),
            "status":"won", "attempts":1, "timeSpentMs":"5000",
            "submissionJson":json!({"guesses":{"A":"C","B":"D"},"hintsUsed":0}).to_string()});
        if is_archive {
            body["puzzleDate"] = json!(yesterday.to_string());
            body["mode"] = json!("archive");
        }
        let request = Request::builder()
            .method("POST")
            .uri("/puzzled.v1.PuzzleService/SubmitGuess")
            .header("content-type", "application/json")
            .header(
                "authorization",
                format!("Bearer {}", token(&me.to_string())),
            )
            .body(Body::from(body.to_string()))
            .unwrap();
        let response = router(AppState::new(Some(pool.clone())))
            .oneshot(request)
            .await
            .unwrap();
        assert_eq!(
            response.status(),
            if is_archive {
                StatusCode::OK
            } else {
                StatusCode::BAD_REQUEST
            }
        );
        if is_archive {
            let accepted: Value =
                serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap())
                    .unwrap();
            assert_eq!(accepted["valid"], true, "{accepted}");
        }
        absent_percentile(
            &rpc(Some(&pool), Some(me), json!({"gameSlug":"cryptogram"})).await,
            "empty_cohort",
        );
    }
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM game_sessions WHERE user_id=$1 AND mode='archive' AND NOT is_ritual",
    )
    .bind(me)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(count, 1);
    pool.close().await;
}
