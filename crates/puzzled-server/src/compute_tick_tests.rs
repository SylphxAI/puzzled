//! Exercise the real router against the published SDK and a local JWKS issuer.
//! No product-side key injection or alternate receipt verification path.

use axum::body::{to_bytes, Body};
use axum::http::{Method, Request, StatusCode};
use axum::response::Response;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use ed25519_dalek::{Signer as _, SigningKey};
use serde_json::{json, Value};
use sylphx::auth::verify::{CALLBACK_RECEIPT_ISSUER, CALLBACK_RECEIPT_TYP};
use tower::ServiceExt;

use crate::{router, AppState};

const TRYIT_CONVERSIONS_PATH: &str = "/internal/compute/tryit-conversions";
const COMPUTE_PATHS: [&str; 5] = [
    "/internal/compute/daily-puzzles",
    "/internal/compute/audit-log-retention",
    "/internal/compute/daily-reminders",
    TRYIT_CONVERSIONS_PATH,
    "/internal/compute/product-metrics",
];
const JOBS_PATH: &str = "/puzzled.v1.JobsService/RunRetentionJob";

struct Provider {
    url: String,
    task: tokio::task::JoinHandle<()>,
}

impl Drop for Provider {
    fn drop(&mut self) {
        self.task.abort();
    }
}

impl Provider {
    async fn start(status: StatusCode) -> Self {
        let key = SigningKey::from_bytes(&[7; 32]);
        // Public keys have the same shape as Compute's published JWKS.
        let keys = json!({"keys": [{
            "issuer": CALLBACK_RECEIPT_ISSUER, "typ": CALLBACK_RECEIPT_TYP,
            "kty": "OKP", "crv": "Ed25519", "alg": "EdDSA", "use": "sig",
            "kid": "compute-tick-1",
            "x": URL_SAFE_NO_PAD.encode(key.verifying_key().as_bytes()),
            "not_before_unix_seconds": 0, "not_after_unix_seconds": 4_102_444_800i64
        }]});
        let app = axum::Router::new().route(
            "/jwks",
            axum::routing::get(move || async move { (status, axum::Json(keys)) }),
        );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .unwrap_or_else(|e| panic!("JWKS bind: {e}"));
        let addr = listener
            .local_addr()
            .unwrap_or_else(|e| panic!("JWKS addr: {e}"));
        Self {
            url: format!("http://{addr}/jwks"),
            task: tokio::spawn(async move {
                axum::serve(listener, app)
                    .await
                    .unwrap_or_else(|e| panic!("JWKS serve: {e}"));
            }),
        }
    }

    fn state(&self) -> AppState {
        AppState::new(None).with_tick_jwks_url(self.url.clone())
    }
}

fn receipt(path: &str, overrides: Value, seed: u8) -> String {
    let now = chrono::Utc::now().timestamp();
    let header = URL_SAFE_NO_PAD.encode(
        json!({"alg": "EdDSA", "typ": CALLBACK_RECEIPT_TYP, "kid": "compute-tick-1"}).to_string(),
    );
    let mut claims = json!({
        "iss": CALLBACK_RECEIPT_ISSUER, "aud": format!("https://puzzled.test{path}"),
        "schedule_id": "puzzled-test", "tick_id": "tick-1", "iat": now, "exp": now + 300
    });
    for (key, value) in overrides
        .as_object()
        .unwrap_or_else(|| panic!("overrides object"))
    {
        claims[key] = value.clone();
    }
    let payload = URL_SAFE_NO_PAD.encode(claims.to_string());
    let signed = format!("{header}.{payload}");
    let signature = SigningKey::from_bytes(&[seed; 32]).sign(signed.as_bytes());
    format!("{signed}.{}", URL_SAFE_NO_PAD.encode(signature.to_bytes()))
}

fn request(path: &str, bearer: Option<&str>) -> Request<Body> {
    let mut builder = Request::builder()
        .method(Method::POST)
        .uri(path)
        .header("host", "puzzled.test")
        .header("content-type", "application/json");
    if let Some(token) = bearer {
        builder = builder.header("authorization", format!("Bearer {token}"));
    }
    builder
        .body(Body::from(r#"{"name":"audit-log-retention"}"#))
        .unwrap_or_else(|e| panic!("callback request: {e}"))
}

async fn call(state: AppState, request: Request<Body>) -> (StatusCode, Value) {
    let response: Response = router(state)
        .oneshot(request)
        .await
        .unwrap_or_else(|e| panic!("callback: {e}"));
    let status = response.status();
    let bytes = to_bytes(response.into_body(), 1024 * 1024)
        .await
        .unwrap_or_else(|e| panic!("callback body: {e}"));
    let json = serde_json::from_slice(&bytes).unwrap_or_else(|e| panic!("callback JSON: {e}"));
    (status, json)
}

fn assert_admitted(path: &str, status: StatusCode, body: &Value) {
    // Prove execution reached the existing no-database result, not an
    // authentication 503 mistaken for an admitted callback.
    if path.starts_with(JOBS_PATH) {
        assert_eq!(status, StatusCode::OK, "{path}: {body}");
        // Proto JSON may omit the default false scalar.
        assert!(!body["ok"].as_bool().unwrap_or(false));
        assert_eq!(body["errors"], json!(["no database pool"]));
    } else {
        assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE, "{path}: {body}");
        let expected = if path.starts_with(TRYIT_CONVERSIONS_PATH) {
            "not_configured"
        } else {
            "no_database"
        };
        assert_eq!(body["error"], expected, "{path}: {body}");
    }
}

#[test]
fn compute_callback_regressions_cover_every_declared_schedule() {
    let manifest = include_str!("../../../sylphx.toml");
    let declared: Vec<&str> = manifest
        .split("[[compute.schedules]]")
        .skip(1)
        .map(|schedule| {
            assert!(schedule.contains("signed = true"));
            schedule
                .lines()
                .find_map(|line| {
                    line.strip_prefix("path = \"")
                        .and_then(|p| p.strip_suffix('"'))
                })
                .unwrap_or_else(|| panic!("schedule path"))
        })
        .collect();
    assert_eq!(declared.len(), COMPUTE_PATHS.len());
    for path in declared {
        assert!(COMPUTE_PATHS.contains(&path), "untested callback: {path}");
    }
}

#[tokio::test]
async fn compute_callbacks_accept_only_authentic_receipts_for_the_exact_request() {
    let provider = Provider::start(StatusCode::OK).await;
    for path in COMPUTE_PATHS.into_iter().chain([JOBS_PATH]) {
        for (case, bearer) in [
            ("missing", None),
            ("shared secret", Some("issued-events-credential".to_owned())),
            ("wrong path", Some(receipt("/other", json!({}), 7))),
            (
                "wrong audience",
                Some(receipt(
                    path,
                    json!({"aud": format!("https://other.test{path}")}),
                    7,
                )),
            ),
            (
                "expired",
                Some(receipt(path, json!({"iat": 1, "exp": 2}), 7)),
            ),
            ("forged", Some(receipt(path, json!({}), 9))),
            (
                "wrong issuer",
                Some(receipt(path, json!({"iss": "https://other.test"}), 7)),
            ),
            (
                "missing expiry",
                Some(receipt(path, json!({"exp": null}), 7)),
            ),
        ] {
            let (status, body) = call(provider.state(), request(path, bearer.as_deref())).await;
            assert_eq!(status, StatusCode::UNAUTHORIZED, "{case} {path}: {body}");
        }
        let (status, body) = call(
            provider.state(),
            request(path, Some(&receipt(path, json!({}), 7))),
        )
        .await;
        assert_admitted(path, status, &body);

        let query = format!("{path}?day=2026-10-29&label=a%2Fb");
        let (status, body) = call(
            provider.state(),
            request(&query, Some(&receipt(path, json!({}), 7))),
        )
        .await;
        assert_eq!(
            status,
            StatusCode::UNAUTHORIZED,
            "changed query {path}: {body}"
        );
        let (status, body) = call(
            provider.state(),
            request(&query, Some(&receipt(&query, json!({}), 7))),
        )
        .await;
        assert_admitted(&query, status, &body);
    }
}

#[tokio::test]
async fn compute_callbacks_never_authorize_on_provider_outage() {
    let provider = Provider::start(StatusCode::SERVICE_UNAVAILABLE).await;
    for path in COMPUTE_PATHS.into_iter().chain([JOBS_PATH]) {
        let (status, body) = call(
            provider.state(),
            request(path, Some(&receipt(path, json!({}), 7))),
        )
        .await;
        assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE, "{path}: {body}");
        let message = if path == JOBS_PATH {
            &body["message"]
        } else {
            &body["error"]
        };
        assert_eq!(message, "tick_receipt_unavailable", "{path}: {body}");
        let (status, _) = call(provider.state(), request(path, None)).await;
        assert_eq!(
            status,
            StatusCode::UNAUTHORIZED,
            "missing during outage: {path}"
        );
    }
}

#[tokio::test]
async fn compute_callbacks_bind_host_and_preserve_the_existing_forwarded_host_fallback() {
    let provider = Provider::start(StatusCode::OK).await;
    for path in COMPUTE_PATHS.into_iter().chain([JOBS_PATH]) {
        let token = receipt(path, json!({}), 7);
        let mut forwarded = request(path, Some(&token));
        forwarded.headers_mut().remove("host");
        forwarded.headers_mut().insert(
            "x-forwarded-host",
            "puzzled.test".parse().unwrap_or_else(|_| panic!("host")),
        );
        let (status, body) = call(provider.state(), forwarded).await;
        assert_admitted(path, status, &body);

        let mut wrong_host = request(path, Some(&token));
        wrong_host.headers_mut().insert(
            "host",
            "other.test".parse().unwrap_or_else(|_| panic!("host")),
        );
        wrong_host.headers_mut().insert(
            "x-forwarded-host",
            "puzzled.test".parse().unwrap_or_else(|_| panic!("host")),
        );
        let (status, body) = call(provider.state(), wrong_host).await;
        assert_eq!(
            status,
            StatusCode::UNAUTHORIZED,
            "host precedence {path}: {body}"
        );

        let mut no_host = request(path, Some(&token));
        no_host.headers_mut().remove("host");
        let (status, body) = call(provider.state(), no_host).await;
        assert_eq!(
            status,
            StatusCode::UNAUTHORIZED,
            "missing host {path}: {body}"
        );
    }
}
