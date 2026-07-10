//! TRUE differential parity: TS oracle vs Rust HTTP + core SSOT.
//!
//! Fail-closed — no SKIP-as-pass. Oracle subprocess must succeed before comparison.
//! Bounded slice entrypoints (rej-010 cycle29):
//! - `puzzle_grid_generation_differential_matches_ts_oracle` — puzzle-grid core + HTTP
//! - `puzzle_solution_submit_differential_matches_ts_oracle` — puzzle-solution-submit scoring + HTTP
//! - `leaderboard_read_differential_matches_ts_oracle` — leaderboard enrich/queryParse + HTTP
//! See scripts/run-puzzled-differential.sh and rej-010 re-audit.

use std::fs;
use std::net::TcpListener;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::Duration;

use puzzled_core::{
    generate_sudoku_puzzle, seeded_random, shuffle_array, validate_and_score_sudoku,
    GameSubmission, ScoringResult, SubmissionStatus, SudokuDifficulty,
};
use puzzled_server::leaderboard_db::{build_leaderboard_entries, LeaderboardQuery, RankRow};
use reqwest::blocking::Client;
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

const GRID_SLICE: &str = "puzzle-grid";
const SOLUTION_SLICE: &str = "puzzle-solution-submit";
const LEADERBOARD_SLICE: &str = "leaderboard-read";

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn corpus_fixture_path() -> PathBuf {
    repo_root().join("scripts/differential/fixtures/puzzled-corpus.json")
}

#[derive(Debug, Deserialize)]
struct OracleCase {
    id: String,
    slice: String,
    domain: String,
    kind: String,
    input: Value,
    output: Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OracleCorpus {
    corpus_version: u32,
    fixture_corpus_hash: String,
    cases: Vec<OracleCase>,
}

fn load_oracle_corpus() -> OracleCorpus {
    if let Ok(path) = std::env::var("PUZZLED_ORACLE_JSON") {
        let raw = fs::read_to_string(&path)
            .unwrap_or_else(|error| panic!("read oracle artifact {path}: {error}"));
        return serde_json::from_str(&raw).expect("oracle artifact must be valid JSON");
    }

    let script = repo_root().join("scripts/differential/puzzled-oracle.ts");
    let output = Command::new("bun")
        .arg("run")
        .arg(&script)
        .current_dir(repo_root())
        .output()
        .unwrap_or_else(|error| panic!("spawn TS oracle at {}: {error}", script.display()));

    assert!(
        output.status.success(),
        "TS oracle failed:\nstdout: {}\nstderr: {}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );

    serde_json::from_slice(&output.stdout).expect("oracle output must be valid JSON")
}

fn assert_oracle_metadata(oracle: &OracleCorpus) {
    assert_eq!(oracle.corpus_version, 1);
    assert!(
        !oracle.fixture_corpus_hash.is_empty(),
        "oracle must emit fixtureCorpusHash"
    );
    assert!(!oracle.cases.is_empty(), "oracle must emit at least one case");
}

fn cases_for_slice<'a>(oracle: &'a OracleCorpus, slice: &str) -> Vec<&'a OracleCase> {
    oracle
        .cases
        .iter()
        .filter(|case| case.slice == slice)
        .collect()
}

fn parse_difficulty(raw: &str) -> SudokuDifficulty {
    match raw.to_ascii_lowercase().as_str() {
        "easy" => SudokuDifficulty::Easy,
        "hard" => SudokuDifficulty::Hard,
        _ => SudokuDifficulty::Medium,
    }
}

fn pick_ephemeral_port() -> u16 {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind ephemeral port");
    listener.local_addr().expect("local addr").port()
}

fn spawn_api(port: u16) -> Child {
    let bin = env!("CARGO_BIN_EXE_puzzled-server");
    Command::new(bin)
        .env("PUZZLED_HTTP_PORT", port.to_string())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .unwrap_or_else(|error| panic!("spawn puzzled-server: {error}"))
}

fn wait_for_health(port: u16) {
    let client = Client::new();
    let url = format!("http://127.0.0.1:{port}/healthz");
    for _ in 0..50 {
        if client.get(&url).send().is_ok() {
            return;
        }
        thread::sleep(Duration::from_millis(100));
    }
    panic!("puzzled-server did not become healthy on port {port}");
}

fn assert_json_subset(actual: &Value, expected: &Value, case_id: &str) {
    match (actual, expected) {
        (Value::Object(actual_map), Value::Object(expected_map)) => {
            for (key, expected_value) in expected_map {
                let actual_value = actual_map
                    .get(key)
                    .unwrap_or_else(|| panic!("case {case_id}: missing key {key}"));
                assert_json_subset(actual_value, expected_value, case_id);
            }
        }
        (actual, expected) => {
            assert_eq!(actual, expected, "case {case_id}");
        }
    }
}

fn grid_to_json(grid: &[Vec<u8>]) -> Value {
    Value::Array(
        grid
            .iter()
            .map(|row| {
                Value::Array(
                    row.iter()
                        .map(|cell| Value::Number((*cell).into()))
                        .collect(),
                )
            })
            .collect(),
    )
}

fn incorrect_grid(grid: &[Vec<u8>]) -> Value {
    let mut copy = grid.to_vec();
    copy[0][0] = (copy[0][0] % 9) + 1;
    grid_to_json(&copy)
}

fn build_submission_from_template(input: &Value, solution_grid: &[Vec<u8>]) -> GameSubmission {
    let submission = &input["submission"];
    let data = &submission["data"];
    let status = match submission["status"].as_str().unwrap_or("won") {
        "lost" => SubmissionStatus::Lost,
        _ => SubmissionStatus::Won,
    };

    let body_data = if data.get("finalGrid").is_some() {
        json!({
            "finalGrid": data["finalGrid"],
            "mistakes": data["mistakes"].as_u64().unwrap_or(0)
        })
    } else if data.get("useSolutionGrid").and_then(Value::as_bool) == Some(true) {
        json!({
            "finalGrid": grid_to_json(solution_grid),
            "mistakes": data["mistakes"].as_u64().unwrap_or(0)
        })
    } else if data.get("useIncorrectGrid").and_then(Value::as_bool) == Some(true) {
        json!({
            "finalGrid": incorrect_grid(solution_grid),
            "mistakes": data["mistakes"].as_u64().unwrap_or(0)
        })
    } else {
        json!({
            "mistakes": data["mistakes"].as_u64().unwrap_or(0)
        })
    };

    GameSubmission {
        status,
        attempts: submission["attempts"].as_u64().unwrap_or(1) as u32,
        time_spent_ms: submission["timeSpentMs"].as_u64().unwrap_or(0),
        data: Some(body_data),
    }
}

fn scoring_to_json(result: &ScoringResult) -> Value {
    match result {
        ScoringResult::Valid { status, score, .. } => json!({
            "valid": true,
            "status": status,
            "score": score
        }),
        ScoringResult::Invalid { error, .. } => json!({
            "valid": false,
            "error": error
        }),
    }
}

fn rust_core_output(case: &OracleCase) -> Value {
    match (case.slice.as_str(), case.domain.as_str()) {
        ("puzzle-grid", "random") => {
            let seed = case.input["seed"].as_i64().expect("seed");
            let count = case.input["count"].as_u64().expect("count") as usize;
            let mut rng = seeded_random(seed);
            let values: Vec<f64> = (0..count).map(|_| rng.next()).collect();
            json!({ "values": values })
        }
        ("puzzle-grid", "shuffle") => {
            let seed = case.input["seed"].as_i64().expect("seed");
            let items: Vec<String> = serde_json::from_value(case.input["items"].clone())
                .expect("shuffle items");
            let mut rng = seeded_random(seed);
            let actual = shuffle_array(&items, &mut rng);
            serde_json::to_value(actual).expect("serialize shuffle")
        }
        ("puzzle-grid", "sudoku") => {
            let seed = case.input["seed"].as_i64().expect("seed");
            let difficulty = parse_difficulty(
                case.input["difficulty"]
                    .as_str()
                    .unwrap_or("medium"),
            );
            let result = generate_sudoku_puzzle(seed, difficulty);
            serde_json::to_value(result).expect("serialize sudoku")
        }
        ("puzzle-solution-submit", "scoring") => {
            let seed = case.input["seed"].as_i64().expect("seed");
            let difficulty = parse_difficulty(
                case.input["difficulty"]
                    .as_str()
                    .unwrap_or("medium"),
            );
            let puzzle = generate_sudoku_puzzle(seed, difficulty);
            let submission = build_submission_from_template(&case.input, &puzzle.solution.grid);
            let actual = validate_and_score_sudoku(&puzzle.solution, &submission);
            scoring_to_json(&actual)
        }
        ("leaderboard-read", "enrich") => {
            #[derive(Debug, Deserialize)]
            struct GoldenRankRow {
                #[serde(rename = "userId")]
                user_id: Uuid,
                #[serde(rename = "totalScore")]
                total_score: i32,
            }
            #[derive(Debug, Deserialize)]
            struct GoldenDisplayRow {
                #[serde(rename = "userId")]
                user_id: Uuid,
                #[serde(rename = "displayName")]
                display_name: Option<String>,
                #[serde(rename = "avatarUrl")]
                avatar_url: Option<String>,
            }

            let rank_rows: Vec<GoldenRankRow> =
                serde_json::from_value(case.input["rankRows"].clone()).expect("rankRows");
            let display_cache: Vec<GoldenDisplayRow> =
                serde_json::from_value(case.input["displayCache"].clone()).expect("displayCache");

            let rows: Vec<RankRow> = rank_rows
                .iter()
                .map(|row| RankRow {
                    user_id: row.user_id,
                    total_score: row.total_score,
                })
                .collect();
            let display_rows: Vec<puzzled_server::leaderboard_db::DisplayRow> = display_cache
                .iter()
                .map(|row| puzzled_server::leaderboard_db::DisplayRow {
                    user_id: row.user_id,
                    display_name: row.display_name.clone(),
                    avatar_url: row.avatar_url.clone(),
                })
                .collect();

            let entries = build_leaderboard_entries(&rows, &display_rows);
            serde_json::to_value(entries).expect("serialize enrich")
        }
        ("leaderboard-read", "queryParse") => {
            let params = case.input["params"].as_object().expect("params");
            let parsed = LeaderboardQuery::from_params(
                params.get("gameSlug").and_then(|v| v.as_str()),
                params.get("type").and_then(|v| v.as_str()),
                params.get("period").and_then(|v| v.as_str()),
                params.get("limit").and_then(|v| v.as_str()),
            );

            let parsed_json = parsed.map(|query| {
                let leaderboard_type = match query.leaderboard_type {
                    puzzled_server::leaderboard_db::LeaderboardType::Streak => "streak",
                    puzzled_server::leaderboard_db::LeaderboardType::Score => "score",
                };
                let period = match query.period {
                    puzzled_server::leaderboard_db::LeaderboardPeriod::Today => "today",
                    puzzled_server::leaderboard_db::LeaderboardPeriod::Week => "week",
                    puzzled_server::leaderboard_db::LeaderboardPeriod::All => "all",
                };
                json!({
                    "gameSlug": query.game_slug,
                    "type": leaderboard_type,
                    "period": period,
                    "limit": query.limit
                })
            });

            json!({
                "valid": parsed_json.is_some(),
                "parsed": parsed_json
            })
        }
        _ => panic!("unsupported core case {} ({}/{})", case.id, case.slice, case.domain),
    }
}

fn rust_http_output(client: &Client, port: u16, case: &OracleCase) -> Value {
    let method = case.input["method"]
        .as_str()
        .unwrap_or("GET")
        .to_ascii_uppercase();
    let path = case.input["path"].as_str().expect("path");
    let query = case.input["query"].as_str().unwrap_or("");
    let url = if query.is_empty() {
        format!("http://127.0.0.1:{port}{path}")
    } else {
        format!("http://127.0.0.1:{port}{path}?{query}")
    };

    let response = match method.as_str() {
        "GET" => client.get(&url).send(),
        "POST" => {
            let body = case.input.get("requestBody").cloned().unwrap_or(json!({}));
            client.post(&url).json(&body).send()
        }
        other => panic!("case {} unsupported method {other}", case.id),
    }
    .unwrap_or_else(|error| panic!("case {} request: {error}", case.id));

    let body: Value = response
        .json()
        .unwrap_or_else(|error| panic!("case {} parse json: {error}", case.id));

    json!({
        "httpStatus": response.status().as_u16(),
        "body": body
    })
}

fn compare_case(case: &OracleCase, client: &Client, port: u16) {
    let actual = if case.kind == "http" {
        rust_http_output(client, port, case)
    } else {
        rust_core_output(case)
    };

    let expected = &case.output;
    if case.kind == "http" {
        assert_eq!(
            actual["httpStatus"], expected["httpStatus"],
            "http status mismatch for {}",
            case.id
        );
        assert_json_subset(&actual["body"], &expected["body"], &case.id);
    } else if case.domain == "random" {
        let actual_values = actual["values"].as_array().expect("values");
        let expected_values = expected["values"].as_array().expect("expected values");
        assert_eq!(actual_values.len(), expected_values.len(), "case {}", case.id);
        for (index, (actual_value, expected_value)) in actual_values
            .iter()
            .zip(expected_values.iter())
            .enumerate()
        {
            let actual_f = actual_value.as_f64().expect("actual f64");
            let expected_f = expected_value.as_f64().expect("expected f64");
            let delta = (actual_f - expected_f).abs();
            assert!(
                delta < 1e-12,
                "case {} value[{index}]: actual {actual_f} expected {expected_f}",
                case.id
            );
        }
    } else {
        assert_eq!(actual, *expected, "differential mismatch for {}", case.id);
    }
}

struct HttpServer {
    port: u16,
    child: Option<Child>,
    client: Client,
}

impl HttpServer {
    fn for_cases(cases: &[&OracleCase]) -> Self {
        let needs_http = cases.iter().any(|case| case.kind == "http");
        if !needs_http {
            return Self {
                port: 0,
                child: None,
                client: Client::new(),
            };
        }
        let port = pick_ephemeral_port();
        let child = Some(spawn_api(port));
        wait_for_health(port);
        Self {
            port,
            child: Some(child.unwrap()),
            client: Client::new(),
        }
    }
}

impl Drop for HttpServer {
    fn drop(&mut self) {
        if let Some(mut server) = self.child.take() {
            let _ = server.kill();
            let _ = server.wait();
        }
    }
}

fn run_bounded_slice(slice: &str, min_cases: usize) {
    let _ = fs::read_to_string(corpus_fixture_path()).expect("read puzzled corpus fixture");
    let oracle = load_oracle_corpus();
    assert_oracle_metadata(&oracle);

    let cases = cases_for_slice(&oracle, slice);
    assert!(
        cases.len() >= min_cases,
        "slice {slice} must have at least {min_cases} oracle cases, got {}",
        cases.len()
    );

    let server = HttpServer::for_cases(&cases);
    for case in cases {
        compare_case(case, &server.client, server.port);
    }
}

#[test]
fn puzzle_grid_generation_differential_matches_ts_oracle() {
    run_bounded_slice(GRID_SLICE, 5);
}

#[test]
fn puzzle_solution_submit_differential_matches_ts_oracle() {
    run_bounded_slice(SOLUTION_SLICE, 11);
}

#[test]
fn leaderboard_read_differential_matches_ts_oracle() {
    run_bounded_slice(LEADERBOARD_SLICE, 13);
}

#[test]
fn puzzled_differential_matches_ts_oracle() {
    let _ = fs::read_to_string(corpus_fixture_path()).expect("read puzzled corpus fixture");
    let oracle = load_oracle_corpus();
    assert_oracle_metadata(&oracle);

    let cases: Vec<&OracleCase> = oracle.cases.iter().collect();
    let http_cases: Vec<&OracleCase> = cases.iter().copied().filter(|case| case.kind == "http").collect();
    assert!(
        !http_cases.is_empty(),
        "oracle corpus must include HTTP cases for puzzle-grid, puzzle-solution-submit, leaderboard"
    );

    let server = HttpServer::for_cases(&cases);
    for case in cases {
        compare_case(case, &server.client, server.port);
    }
}