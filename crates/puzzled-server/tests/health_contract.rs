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

struct RunningApi(Child);

impl Drop for RunningApi {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

fn spawn_api(port: u16) -> RunningApi {
    let bin = env!("CARGO_BIN_EXE_puzzled-server");
    match Command::new(bin)
        .env("PUZZLED_HTTP_PORT", port.to_string())
        .env("RUST_LOG", "error")
        .env_remove("DATABASE_URL")
        .env_remove("POSTGRES_URL")
        .env("GIT_COMMIT_SHA", "0123456789abcdef0123456789abcdef01234567")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
    {
        Ok(child) => RunningApi(child),
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

fn assert_headers(response: &reqwest::blocking::Response, status: u16) {
    assert_eq!(response.status(), status);
    assert_eq!(response.headers()["cache-control"], "no-store");
    assert_eq!(response.headers()["content-type"], "application/json");
    assert!(!response.headers().contains_key("x-revision-sha"));
}

#[test]
fn public_probes_return_only_uncacheable_status() {
    let port = pick_ephemeral_port();
    let _api = spawn_api(port);
    for (path, status, body) in [
        ("/healthz", 200, r#"{"status":"ok"}"#),
        ("/readyz", 503, r#"{"status":"not_ready"}"#),
    ] {
        let response = wait_for_ok(port, path);
        assert_headers(&response, status);
        assert_eq!(
            response
                .text()
                .unwrap_or_else(|err| panic!("GET body: {err}")),
            body
        );

        let response = http_client()
            .head(format!("http://127.0.0.1:{port}{path}"))
            .send()
            .unwrap_or_else(|err| panic!("HEAD {path}: {err}"));
        assert_headers(&response, status);
        assert!(response
            .bytes()
            .unwrap_or_else(|err| panic!("HEAD body: {err}"))
            .is_empty());
    }
}
