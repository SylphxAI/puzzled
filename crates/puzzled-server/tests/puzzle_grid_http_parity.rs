//! HTTP golden parity for puzzle grid generation endpoint.

use std::fs;
use std::net::TcpListener;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::Duration;

use reqwest::blocking::Client;
use serde::Deserialize;
use serde_json::Value;

#[derive(Debug, Deserialize)]
struct GoldenFile {
    #[serde(rename = "httpCases")]
    http_cases: Vec<HttpCase>,
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

fn golden_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/puzzle-grid/golden.json")
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
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
    {
        Ok(child) => child,
        Err(error) => panic!("spawn puzzled-server: {error}"),
    }
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

#[test]
fn http_cases_match_golden_baseline() {
    let golden = load_golden();
    let port = pick_ephemeral_port();
    let mut child = spawn_api(port);
    wait_for_health(port);

    let client = Client::new();
    for case in &golden.http_cases {
        let url = format!("http://127.0.0.1:{port}{}{}", case.path, {
            if case.query.is_empty() {
                String::new()
            } else {
                format!("?{}", case.query)
            }
        });
        let response = client
            .get(&url)
            .send()
            .unwrap_or_else(|error| panic!("case {} request: {error}", case.id));
        assert_eq!(
            response.status().as_u16(),
            case.http_status,
            "case {}",
            case.id
        );
        let body: Value = response
            .json()
            .unwrap_or_else(|error| panic!("case {} parse json: {error}", case.id));
        assert_json_subset(&body, &case.body, &case.id);
    }

    let _ = child.kill();
    let _ = child.wait();
}