//! Golden fixture parity: Rust leaderboard read must match TS stats route baseline.

use std::collections::HashMap;
use std::fs;
use std::net::TcpListener;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::Duration;

use puzzled_server::leaderboard_db::{build_leaderboard_entries, LeaderboardQuery, RankRow};
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
struct GoldenFile {
    #[serde(rename = "httpCases")]
    http_cases: Vec<HttpCase>,
    #[serde(rename = "enrichCases")]
    enrich_cases: Vec<EnrichCase>,
    #[serde(rename = "queryParseCases")]
    query_parse_cases: Vec<QueryParseCase>,
}

#[derive(Debug, Deserialize)]
struct HttpCase {
    id: String,
    path: String,
    query: String,
    #[serde(rename = "httpStatus")]
    http_status: u16,
    body: Value,
}

#[derive(Debug, Deserialize)]
struct EnrichCase {
    id: String,
    #[serde(rename = "rankRows")]
    rank_rows: Vec<GoldenRankRow>,
    #[serde(rename = "displayCache")]
    display_cache: Vec<GoldenDisplayRow>,
    expected: Value,
}

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

#[derive(Debug, Deserialize)]
struct QueryParseCase {
    id: String,
    params: HashMap<String, String>,
    valid: bool,
    parsed: Option<GoldenParsedQuery>,
}

#[derive(Debug, Deserialize)]
struct GoldenParsedQuery {
    #[serde(rename = "gameSlug")]
    game_slug: String,
    #[serde(rename = "type")]
    leaderboard_type: String,
    period: String,
    limit: i32,
}

fn golden_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/leaderboard/golden.json")
}

fn load_golden() -> GoldenFile {
    let path = golden_path();
    let raw = fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("read golden corpus {}: {error}", path.display()));
    serde_json::from_str(&raw)
        .unwrap_or_else(|error| panic!("parse golden corpus {}: {error}", path.display()))
}

fn pick_ephemeral_port() -> u16 {
    let listener = match TcpListener::bind("127.0.0.1:0") {
        Ok(listener) => listener,
        Err(error) => panic!("bind ephemeral port: {error}"),
    };
    match listener.local_addr() {
        Ok(addr) => addr.port(),
        Err(error) => panic!("local addr: {error}"),
    }
}

fn spawn_api(port: u16) -> Child {
    let bin = env!("CARGO_BIN_EXE_puzzled-server");
    match Command::new(bin)
        .env("PUZZLED_HTTP_PORT", port.to_string())
        .env("RUST_LOG", "error")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
    {
        Ok(child) => child,
        Err(error) => panic!("spawn puzzled-server: {error}"),
    }
}

fn http_client() -> reqwest::blocking::Client {
    match reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
    {
        Ok(client) => client,
        Err(error) => panic!("http client: {error}"),
    }
}

fn wait_for_server(port: u16) {
    let client = http_client();
    let url = format!("http://127.0.0.1:{port}/healthz");
    let mut last_error = String::from("no attempts");
    for _ in 0..50 {
        match client.get(&url).send() {
            Ok(_) => return,
            Err(error) => {
                last_error = error.to_string();
                thread::sleep(Duration::from_millis(100));
            }
        }
    }
    panic!("server not ready: {last_error}");
}

fn assert_json_eq(actual: &Value, expected: &Value, path: &str) {
    assert_eq!(actual, expected, "mismatch at {path}");
}

#[test]
fn http_cases_match_golden_baseline() {
    let golden = load_golden();
    let port = pick_ephemeral_port();
    let mut child = spawn_api(port);
    wait_for_server(port);
    let client = http_client();

    for case in &golden.http_cases {
        let url = if case.query.is_empty() {
            format!("http://127.0.0.1:{port}{}", case.path)
        } else {
            format!("http://127.0.0.1:{port}{}?{}", case.path, case.query)
        };
        let response = match client.get(&url).send() {
            Ok(response) => response,
            Err(error) => panic!("request {}: {error}", case.id),
        };
        assert_eq!(
            response.status().as_u16(),
            case.http_status,
            "status for {}",
            case.id
        );
        let body: Value = match response.json() {
            Ok(body) => body,
            Err(error) => panic!("json for {}: {error}", case.id),
        };
        assert_json_eq(&body, &case.body, &case.id);
    }

    let _ = child.kill();
    let _ = child.wait();
}

#[test]
fn enrich_cases_match_golden_baseline() {
    let golden = load_golden();

    for case in &golden.enrich_cases {
        let rank_rows: Vec<RankRow> = case
            .rank_rows
            .iter()
            .map(|row| RankRow {
                user_id: row.user_id,
                total_score: row.total_score,
            })
            .collect();

        let display_rows: Vec<puzzled_server::leaderboard_db::DisplayRow> = case
            .display_cache
            .iter()
            .map(|row| puzzled_server::leaderboard_db::DisplayRow {
                user_id: row.user_id,
                display_name: row.display_name.clone(),
                avatar_url: row.avatar_url.clone(),
            })
            .collect();

        let entries = build_leaderboard_entries(&rank_rows, &display_rows);
        let actual = serde_json::to_value(entries)
            .unwrap_or_else(|error| panic!("serialize entries for {}: {error}", case.id));
        assert_json_eq(&actual, &case.expected, &case.id);
    }
}

#[test]
fn query_parse_cases_match_golden_baseline() {
    let golden = load_golden();

    for case in &golden.query_parse_cases {
        let parsed = LeaderboardQuery::from_params(
            case.params.get("gameSlug").map(String::as_str),
            case.params.get("type").map(String::as_str),
            case.params.get("period").map(String::as_str),
            case.params.get("limit").map(String::as_str),
        );

        if !case.valid {
            assert!(parsed.is_none(), "expected invalid parse for {}", case.id);
            continue;
        }

        let Some(parsed) = parsed else {
            panic!("expected valid parse for {}", case.id);
        };
        let expected = case
            .parsed
            .as_ref()
            .unwrap_or_else(|| panic!("missing parsed baseline for {}", case.id));

        assert_eq!(parsed.game_slug, expected.game_slug, "gameSlug for {}", case.id);
        let actual_type = match parsed.leaderboard_type {
            puzzled_server::leaderboard_db::LeaderboardType::Streak => "streak",
            puzzled_server::leaderboard_db::LeaderboardType::Score => "score",
        };
        assert_eq!(actual_type, expected.leaderboard_type, "type for {}", case.id);
        let actual_period = match parsed.period {
            puzzled_server::leaderboard_db::LeaderboardPeriod::Today => "today",
            puzzled_server::leaderboard_db::LeaderboardPeriod::Week => "week",
            puzzled_server::leaderboard_db::LeaderboardPeriod::All => "all",
        };
        assert_eq!(actual_period, expected.period, "period for {}", case.id);
        assert_eq!(parsed.limit, expected.limit, "limit for {}", case.id);
    }
}