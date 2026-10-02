//! Daily pipeline end to end against a real Postgres (issue #246): every game
//! gets a stored, self-checked puzzle; GetDaily and SubmitGuess agree on it;
//! word games are graded per guess without the answer and capped; the answer
//! is revealed only after an accepted finish.

use axum::body::{to_bytes, Body};
use axum::http::{Method, Request, StatusCode};
use axum::Router;
use chrono::Duration;
use serde_json::{json, Value};
use tower::ServiceExt;

use puzzled_core::puzzle_play::daily_time::product_day_key;
use puzzled_core::puzzle_play::game_slugs::all_game_slugs;
use puzzled_core::puzzle_play::generate::difficulties_for;

use crate::capabilities::daily_pipeline::{self, store};
use crate::test_support::fresh_database;
use crate::{router, AppState};

const GUEST_COOKIE: &str = "__Host-puzzled_guest=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

async fn call(app: &Router, path: &str, body: Value) -> (StatusCode, Value) {
    let request = Request::builder()
        .method(Method::POST)
        .uri(path)
        .header("content-type", "application/json")
        .header("cookie", GUEST_COOKIE)
        .body(Body::from(body.to_string()))
        .unwrap_or_else(|e| panic!("request: {e}"));
    let response = app
        .clone()
        .oneshot(request)
        .await
        .unwrap_or_else(|e| panic!("call {path}: {e}"));
    let status = response.status();
    let bytes = to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap_or_default();
    (
        status,
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
    )
}

#[tokio::test]
async fn every_game_has_a_stored_puzzle_and_word_games_grade_without_the_answer() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let today = product_day_key(chrono::Utc::now());

    // One day for every game and difficulty: stored, and the buffer counts it.
    let report = daily_pipeline::fill_range(&pool, today, today, today)
        .await
        .unwrap_or_else(|e| panic!("fill: {e}"));
    assert!(report.failed.is_empty(), "{:?}", report.failed);
    let expected: usize = all_game_slugs()
        .iter()
        .map(|slug| difficulties_for(slug).len())
        .sum();
    assert_eq!(report.generated as usize, expected);
    assert_eq!(report.min_days_ahead, 1);
    // A second run stores nothing new and never replaces a row.
    let again = daily_pipeline::fill_range(&pool, today, today, today)
        .await
        .unwrap_or_else(|e| panic!("fill again: {e}"));
    assert_eq!(again.generated, 0);

    let app = router(AppState::new(Some(pool.clone())));

    // GetDaily serves the stored row for every game, with no answer in it.
    for slug in all_game_slugs() {
        let (status, body) = call(
            &app,
            "/puzzled.v1.PuzzleService/GetDaily",
            json!({"gameSlug": slug}),
        )
        .await;
        assert_eq!(status, StatusCode::OK, "{slug}: {body}");
        assert!(body["puzzleId"].as_str().is_some(), "{slug}: {body}");
        assert!(
            body.get("stub").is_none() || body["stub"] == false,
            "{slug}"
        );
    }

    // A day nobody filled is generated and stored on first read.
    let tomorrow = today + Duration::days(1);
    assert!(store::fetch(&pool, "word-hive", tomorrow, None)
        .await
        .unwrap_or(None)
        .is_none());
    let (status, _) = call(
        &app,
        "/puzzled.v1.PuzzleService/CheckGuess",
        json!({"gameSlug": "word-hive", "guessJson": "{}"}),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "word-hive is not graded per guess"
    );
    let resolved = daily_pipeline::resolve(Some(&pool), "word-hive", tomorrow, None)
        .await
        .unwrap_or_else(|e| panic!("resolve: {e}"));
    assert!(resolved.id.is_some());

    // word-guess: tiles per guess, the answer never sent, six guesses at most.
    let answer = store::fetch(&pool, "word-guess", today, None)
        .await
        .ok()
        .flatten()
        .and_then(|p| p.solution["word"].as_str().map(str::to_lowercase))
        .unwrap_or_else(|| panic!("word-guess answer"));
    let (status, graded) = call(
        &app,
        "/puzzled.v1.PuzzleService/CheckGuess",
        json!({"gameSlug": "word-guess", "guessJson": json!({"word": answer}).to_string()}),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{graded}");
    let result: Value =
        serde_json::from_str(graded["resultJson"].as_str().unwrap_or("{}")).unwrap_or(Value::Null);
    assert_eq!(
        result["tiles"],
        json!(["correct", "correct", "correct", "correct", "correct"])
    );
    assert!(!graded
        .to_string()
        .to_lowercase()
        .contains(&format!("\"{answer}\"")));
    for _ in 0..5 {
        let (status, _) = call(
            &app,
            "/puzzled.v1.PuzzleService/CheckGuess",
            json!({"gameSlug": "word-guess", "guessJson": "{\"word\":\"crane\"}"}),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
    }
    let (status, _) = call(
        &app,
        "/puzzled.v1.PuzzleService/CheckGuess",
        json!({"gameSlug": "word-guess", "guessJson": "{\"word\":\"crane\"}"}),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::TOO_MANY_REQUESTS,
        "seventh guess is refused"
    );

    // The finish is validated against the same stored puzzle, and only then
    // is the answer revealed.
    let (status, submitted) = call(
        &app,
        "/puzzled.v1.PuzzleService/SubmitGuess",
        json!({
            "gameSlug": "word-guess", "status": "won", "attempts": 1, "timeSpentMs": "30000",
            "submissionJson": json!({"guesses": [answer]}).to_string()
        }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{submitted}");
    assert_eq!(submitted["valid"], true, "{submitted}");
    let reveal: Value = serde_json::from_str(submitted["revealJson"].as_str().unwrap_or("{}"))
        .unwrap_or(Value::Null);
    assert_eq!(reveal["word"].as_str().map(str::to_lowercase), Some(answer));

    // word-groups: a correct group returns its category; a near miss says so.
    let categories = store::fetch(&pool, "word-groups", today, None)
        .await
        .ok()
        .flatten()
        .map(|p| p.solution["categories"].clone())
        .unwrap_or_else(|| panic!("word-groups solution"));
    let first = categories[0]["words"].clone();
    let (_, graded) = call(
        &app,
        "/puzzled.v1.PuzzleService/CheckGuess",
        json!({"gameSlug": "word-groups", "guessJson": json!({"words": first}).to_string()}),
    )
    .await;
    let result: Value =
        serde_json::from_str(graded["resultJson"].as_str().unwrap_or("{}")).unwrap_or(Value::Null);
    assert_eq!(result["correct"], true, "{graded}");
    assert_eq!(result["category"]["name"], categories[0]["name"]);

    pool.close().await;
}

async fn stored_version(pool: &sqlx::PgPool, day: chrono::NaiveDate) -> Option<String> {
    sqlx::query_scalar(
        "SELECT generator_version FROM daily_puzzles
         WHERE game_slug = 'crossword' AND puzzle_date = $1",
    )
    .bind(day.and_hms_opt(0, 0, 0).unwrap_or_default())
    .fetch_optional(pool)
    .await
    .unwrap_or(None)
}

/// Each stored crossword row keeps the generator that made it: an existing
/// V1 row is served as stored (first row wins), a new pipeline day is made by
/// V2, and a new day before the pipeline is still V1.
#[tokio::test]
async fn crossword_rows_record_and_keep_their_generator_version() {
    use puzzled_core::puzzle_play::generate::{
        generate_seeded, Generated, GENERATOR_CROSSWORD_V2, GENERATOR_V1,
    };

    let Some(pool) = fresh_database().await else {
        return;
    };
    let day = |y, m, d| chrono::NaiveDate::from_ymd_opt(y, m, d).unwrap_or_default();

    // A V1 row already stored for a pipeline day.
    let stored_day = day(2026, 10, 20);
    let (puzzle_data, solution) =
        generate_seeded("crossword", 1, None).unwrap_or_else(|e| panic!("v1 generate: {e}"));
    store::insert(
        &pool,
        "crossword",
        stored_day,
        None,
        &Generated {
            puzzle_data: puzzle_data.clone(),
            solution,
            seed: 1,
            generator_version: GENERATOR_V1,
        },
    )
    .await
    .unwrap_or_else(|e| panic!("insert v1: {e}"));
    let served = daily_pipeline::resolve(Some(&pool), "crossword", stored_day, None)
        .await
        .unwrap_or_else(|e| panic!("resolve stored: {e}"));
    assert_eq!(served.puzzle_data, puzzle_data, "first row wins, unchanged");
    assert_eq!(
        stored_version(&pool, stored_day).await.as_deref(),
        Some(GENERATOR_V1)
    );

    // A new pipeline day is generated by V2 and says so.
    let new_day = day(2026, 10, 21);
    let made = daily_pipeline::resolve(Some(&pool), "crossword", new_day, None)
        .await
        .unwrap_or_else(|e| panic!("resolve new: {e}"));
    assert_eq!(made.puzzle_data["clueSet"], "rows-columns");
    assert_eq!(
        stored_version(&pool, new_day).await.as_deref(),
        Some(GENERATOR_CROSSWORD_V2)
    );

    // A new day before the pipeline keeps the original seed and V1.
    let legacy_day = day(2026, 9, 20);
    let legacy = daily_pipeline::resolve(Some(&pool), "crossword", legacy_day, None)
        .await
        .unwrap_or_else(|e| panic!("resolve legacy: {e}"));
    assert!(legacy.puzzle_data.get("clueSet").is_none());
    assert_eq!(
        stored_version(&pool, legacy_day).await.as_deref(),
        Some(GENERATOR_V1)
    );
}
