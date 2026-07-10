//! Golden fixture parity: spawn `puzzled-server` and verify health probes.

use std::fs;
use std::net::TcpListener;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::Duration;

use serde::Deserialize;
use serde_json::Value;

#[derive(Debug, Deserialize)]
struct GoldenFile {
    healthz: GoldenProbe,
    readyz: GoldenProbe,
}

#[derive(Debug, Deserialize)]
struct GoldenProbe {
    #[serde(rename = "httpStatus")]
    http_status: u16,
    body: Value,
}

fn golden_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/health/golden.json")
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

fn wait_for_ok(port: u16, path: &str) -> reqwest::blocking::Response {
    let client = http_client();
    let url = format!("http://127.0.0.1:{port}{path}");
    let mut last_error = String::from("no attempts");
    for _ in 0..50 {
        match client.get(&url).send() {
            Ok(response) => return response,
            Err(error) => {
                last_error = error.to_string();
                thread::sleep(Duration::from_millis(100));
            }
        }
    }
    panic!("GET {path} failed after retries: {last_error}");
}

fn assert_json_subset(actual: &Value, expected: &Value, path: &str) {
    match (actual, expected) {
        (Value::Object(actual_map), Value::Object(expected_map)) => {
            for (key, expected_value) in expected_map {
                let child_path = if path.is_empty() {
                    key.clone()
                } else {
                    format!("{path}.{key}")
                };
                let actual_value = actual_map.get(key).unwrap_or_else(|| {
                    panic!("missing key {child_path} in response {actual}")
                });
                assert_json_subset(actual_value, expected_value, &child_path);
            }
        }
        (actual_value, expected_value) => {
            assert_eq!(
                actual_value, expected_value,
                "mismatch at {path}: got {actual_value}, want {expected_value}"
            );
        }
    }
}

#[test]
fn healthz_matches_golden_baseline() {
    let golden = load_golden();
    let port = pick_ephemeral_port();
    let mut child = spawn_api(port);
    let response = wait_for_ok(port, "/healthz");
    assert_eq!(response.status().as_u16(), golden.healthz.http_status);
    let body: Value = match response.json() {
        Ok(body) => body,
        Err(error) => panic!("response json: {error}"),
    };
    assert_json_subset(&body, &golden.healthz.body, "healthz");
    let _ = child.kill();
    let _ = child.wait();
}

#[test]
fn readyz_matches_golden_baseline() {
    let golden = load_golden();
    let port = pick_ephemeral_port();
    let mut child = spawn_api(port);
    let response = wait_for_ok(port, "/readyz");
    assert_eq!(response.status().as_u16(), golden.readyz.http_status);
    let body: Value = match response.json() {
        Ok(body) => body,
        Err(error) => panic!("response json: {error}"),
    };
    assert_json_subset(&body, &golden.readyz.body, "readyz");
    assert!(body.get("uptime_s").and_then(Value::as_u64).is_some());
    let _ = child.kill();
    let _ = child.wait();
}