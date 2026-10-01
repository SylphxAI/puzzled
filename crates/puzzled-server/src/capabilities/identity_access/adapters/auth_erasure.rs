//! Deleting a player's Sylphx Auth sign-in, so an in-app erasure erases the
//! whole person.
//!
//! Puzzled's own rows are only half of a player: the Sylphx Auth subject is
//! the identity they sign in with. Erasing the rows alone would leave a live
//! sign-in behind a purged account — an erasure that is not an erasure — so
//! the account deletion also files Auth's privacy request
//! (`POST /v1/privacy-requests`, `request_type: delete`) with the instance's
//! secret key. Auth accepts it asynchronously, suspends the principal at once
//! and ends every session it had. The idempotency key is fixed per subject,
//! so a retried erasure repeats the same request instead of filing a second.
//!
//! Credentials come from the Enable Auth binding (`SYLPHX_AUTH_URL`,
//! `SYLPHX_AUTH_ORGANIZATION_ID`, `SYLPHX_AUTH_SECRET_KEY`); they are bound at
//! the environment level, so this service receives them. [`AuthErasure::from_env`]
//! is `None` until they are set, and the api then refuses erasure rather than
//! leaving a live sign-in behind.

use std::time::Duration;

use serde_json::{json, Value};

const DEFAULT_AUTH_URL: &str = "https://api.sylphx.com";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);

/// The Auth instance's secret-key handle on a person's sign-in account.
#[derive(Clone)]
pub struct AuthErasure {
    http: reqwest::Client,
    auth_url: String,
    organization_id: String,
    secret_key: String,
}

impl AuthErasure {
    #[must_use]
    pub fn new(auth_url: String, organization_id: String, secret_key: String) -> Self {
        Self {
            http: reqwest::Client::builder()
                .timeout(REQUEST_TIMEOUT)
                .build()
                .unwrap_or_default(),
            auth_url: auth_url.trim_end_matches('/').to_string(),
            organization_id,
            secret_key,
        }
    }

    /// The credential Enable Auth binds, when every part is set.
    #[must_use]
    pub fn from_env() -> Option<Self> {
        let read = |name: &str| {
            std::env::var(name)
                .ok()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
        };
        let url = read("SYLPHX_AUTH_URL").unwrap_or_else(|| DEFAULT_AUTH_URL.to_string());
        let organization_id = read("SYLPHX_AUTH_ORGANIZATION_ID")?;
        let secret_key = read("SYLPHX_AUTH_SECRET_KEY")?;
        Some(Self::new(url, organization_id, secret_key))
    }

    /// File the deletion of one Auth subject. `Ok(Some(request id))` when Auth
    /// accepted it, `Ok(None)` when Auth holds no such account (already gone,
    /// or never created); `Err` when Auth refused or was unreachable, which
    /// the caller surfaces instead of reporting a success.
    pub async fn delete_principal(&self, principal_id: &str) -> Result<Option<String>, String> {
        let response = self
            .http
            .post(format!("{}/v1/privacy-requests", self.auth_url))
            .bearer_auth(&self.secret_key)
            .json(&json!({
                "idempotency_key": format!("puzzled-account-erasure-{principal_id}"),
                "principal_id": principal_id,
                "request_type": "delete",
                "organization_id": self.organization_id,
            }))
            .send()
            .await
            .map_err(|_| "auth privacy request unavailable".to_string())?;
        let status = response.status();
        let payload = response.json::<Value>().await.unwrap_or_else(|_| json!({}));
        self.validate_receipt(status, &payload, principal_id)
    }

    /// Accept only evidence identifying this exact configured instance and subject.
    fn validate_receipt(
        &self,
        status: reqwest::StatusCode,
        payload: &Value,
        principal_id: &str,
    ) -> Result<Option<String>, String> {
        if status.is_success() {
            let receipt = &payload["privacy_request"];
            let request_id = receipt["request_id"]
                .as_str()
                .filter(|id| !id.trim().is_empty());
            if receipt["organization_id"].as_str() != Some(self.organization_id.as_str())
                || receipt["principal_id"].as_str() != Some(principal_id)
                || receipt["request_type"].as_str() != Some("delete")
                || !matches!(
                    receipt["state"].as_str(),
                    Some("pending" | "running" | "completed" | "failed")
                )
            {
                return Err("auth privacy receipt unconfirmed".to_string());
            }
            return request_id
                .map(|id| Some(id.to_string()))
                .ok_or_else(|| "auth privacy receipt unconfirmed".to_string());
        }
        // A proxy/router/HTML 404 is not proof that this identity is absent.
        if status == reqwest::StatusCode::NOT_FOUND
            && payload["code"].as_str() == Some("not_found")
            && payload["authority"].as_str() == Some("identity")
            && payload["error"].as_str() == Some("user not found")
        {
            return Ok(None);
        }
        // Never echo arbitrary Auth response text or bodies into errors/logs.
        Err(format!(
            "auth privacy request refused ({})",
            status.as_u16()
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex};

    /// What the fake Auth received: one record per request.
    type Seen = Arc<Mutex<Vec<Value>>>;

    /// A stub Auth that records each privacy request and answers with `status`
    /// and `answer`.
    async fn spawn_auth(
        status: u16,
        answer: Value,
        seen: Seen,
    ) -> (String, tokio::task::JoinHandle<()>) {
        let app = axum::Router::new().route(
            "/v1/privacy-requests",
            axum::routing::post(move |headers: axum::http::HeaderMap, body: String| {
                let seen = seen.clone();
                let answer = answer.clone();
                async move {
                    seen.lock().unwrap().push(json!({
                        "authorization": headers
                            .get(axum::http::header::AUTHORIZATION)
                            .and_then(|v| v.to_str().ok())
                            .unwrap_or_default(),
                        "body": serde_json::from_str::<Value>(&body).unwrap_or(Value::Null),
                    }));
                    (
                        axum::http::StatusCode::from_u16(status).unwrap(),
                        axum::Json(answer),
                    )
                }
            }),
        );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let handle = tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        (format!("http://{addr}"), handle)
    }

    fn erasure(base: &str) -> AuthErasure {
        AuthErasure::new(
            base.to_string(),
            "org_test".to_string(),
            "sk_secret".to_string(),
        )
    }

    #[tokio::test]
    async fn files_one_delete_request_per_subject_under_the_secret_key() {
        let seen: Seen = Arc::default();
        let (base, _server) = spawn_auth(
            202,
            json!({"privacy_request": {"request_id": "privacy-request-1", "state": "pending", "organization_id": "org_test", "principal_id": "principal-0199aa10-7b2c-7d3e-8f00-1234567890ab", "request_type": "delete"}}),
            seen.clone(),
        )
        .await;
        let request_id = erasure(&base)
            .delete_principal("principal-0199aa10-7b2c-7d3e-8f00-1234567890ab")
            .await
            .expect("accepted");
        assert_eq!(request_id.as_deref(), Some("privacy-request-1"));
        let seen = seen.lock().unwrap();
        assert_eq!(seen.len(), 1);
        assert_eq!(seen[0]["authorization"], "Bearer sk_secret");
        assert_eq!(seen[0]["body"]["request_type"], "delete");
        assert_eq!(seen[0]["body"]["organization_id"], "org_test");
        assert_eq!(
            seen[0]["body"]["principal_id"],
            "principal-0199aa10-7b2c-7d3e-8f00-1234567890ab"
        );
        // Fixed per subject, so a retry repeats the same request.
        assert_eq!(
            seen[0]["body"]["idempotency_key"],
            "puzzled-account-erasure-principal-0199aa10-7b2c-7d3e-8f00-1234567890ab"
        );
    }

    #[tokio::test]
    async fn an_account_auth_does_not_hold_is_not_an_error() {
        let seen: Seen = Arc::default();
        let (base, _server) = spawn_auth(
            404,
            json!({"code": "not_found", "authority": "identity", "error": "user not found"}),
            seen,
        )
        .await;
        assert_eq!(erasure(&base).delete_principal("usr_gone").await, Ok(None));
    }

    #[tokio::test]
    async fn a_refusal_and_an_acceptance_without_an_id_are_errors() {
        let seen: Seen = Arc::default();
        let (base, _server) =
            spawn_auth(403, json!({"error": "privacy_request_forbidden"}), seen).await;
        let refused = erasure(&base).delete_principal("usr_a").await;
        assert!(
            refused
                .as_ref()
                .is_err_and(|error| error == "auth privacy request refused (403)"),
            "{refused:?}"
        );

        let seen: Seen = Arc::default();
        let (base, _server) = spawn_auth(202, json!({}), seen).await;
        let accepted = erasure(&base).delete_principal("usr_a").await;
        assert!(
            accepted
                .as_ref()
                .is_err_and(|error| error == "auth privacy receipt unconfirmed"),
            "{accepted:?}"
        );
    }
    #[test]
    fn unconfirmed_absence_or_ownership_never_authorizes_local_erasure() {
        let adapter = erasure("https://identity.test");
        for payload in [
            json!({}),
            json!({"error": "user not found"}),
            json!({"code": "not_found", "authority": "proxy", "error": "user not found"}),
            json!({"code": "not_found", "authority": "identity", "error": "route not found"}),
            json!("<html>not found</html>"),
        ] {
            assert!(adapter
                .validate_receipt(reqwest::StatusCode::NOT_FOUND, &payload, "subject-fixture")
                .is_err());
        }
        let valid = json!({"privacy_request": {
            "request_id": "receipt-fixture", "organization_id": "org_test",
            "principal_id": "subject-fixture", "request_type": "delete", "state": "pending"
        }});
        assert_eq!(
            adapter.validate_receipt(reqwest::StatusCode::ACCEPTED, &valid, "subject-fixture"),
            Ok(Some("receipt-fixture".into()))
        );
        for (field, value) in [
            ("request_id", ""),
            ("organization_id", "other-org"),
            ("principal_id", "other-subject"),
            ("request_type", "export"),
            ("state", "accepted"),
        ] {
            let mut invalid = valid.clone();
            invalid["privacy_request"][field] = json!(value);
            assert!(adapter
                .validate_receipt(reqwest::StatusCode::ACCEPTED, &invalid, "subject-fixture")
                .is_err());
        }
        for state in ["pending", "running", "completed", "failed"] {
            let mut receipt = valid.clone();
            receipt["privacy_request"]["state"] = json!(state);
            assert!(adapter
                .validate_receipt(reqwest::StatusCode::ACCEPTED, &receipt, "subject-fixture")
                .is_ok());
        }
    }
}
