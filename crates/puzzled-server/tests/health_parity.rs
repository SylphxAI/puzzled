//! S0 parity: spawn `puzzled-server` and verify health probes.

use std::net::TcpListener;
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::Duration;

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

#[test]
fn healthz_returns_ok_json() {
    let port = pick_ephemeral_port();
    let mut child = spawn_api(port);
    let response = wait_for_ok(port, "/healthz");
    assert_eq!(response.status(), 200);
    let body: serde_json::Value = match response.json() {
        Ok(body) => body,
        Err(error) => panic!("response json: {error}"),
    };
    assert_eq!(body["status"], "ok");
    let _ = child.kill();
    let _ = child.wait();
}

#[test]
fn readyz_returns_ok_json() {
    let port = pick_ephemeral_port();
    let mut child = spawn_api(port);
    let response = wait_for_ok(port, "/readyz");
    assert_eq!(response.status(), 200);
    let body: serde_json::Value = match response.json() {
        Ok(body) => body,
        Err(error) => panic!("response json: {error}"),
    };
    assert_eq!(body["status"], "ok");
    assert_eq!(body["stub"], true);
    let _ = child.kill();
    let _ = child.wait();
}
