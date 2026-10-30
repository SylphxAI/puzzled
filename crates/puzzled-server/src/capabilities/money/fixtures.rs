//! One-time fixture registration before its first product sign-in. The Auth
//! end-user resource must attest that it was born synthetic in this exact home.
//! An existing product player can never be reclassified by this command.

use std::time::Duration;

use serde_json::Value;
use sqlx::postgres::PgPoolOptions;
use uuid::Uuid;

use super::client::{Money, resolve_env_url};

fn setting(name: &str) -> Result<String, ()> {
    std::env::var(name)
        .ok()
        .filter(|v| !v.trim().is_empty())
        .ok_or(())
}

fn plain(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 128
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'_' | b'-'))
}

pub fn proof_time<'a>(body: &'a Value, name: &str) -> Option<&'a str> {
    if body.get("name")?.as_str()? != name {
        return None;
    }
    let stamp = body.get("synthetic_time")?.as_str()?;
    chrono::DateTime::parse_from_rfc3339(stamp).ok()?;
    Some(stamp)
}

async fn register() -> Result<(), ()> {
    let subject = setting("PUZZLED_CHECKOUT_FIXTURE_SUBJECT")?;
    let fixture = setting("PUZZLED_CHECKOUT_FIXTURE_KEY")?;
    if !plain(&subject) || !plain(&fixture) {
        return Err(());
    }
    let expected = setting("PUZZLED_CHECKOUT_ENVIRONMENT")?;
    let origin = setting("SYLPHX_API_URL").unwrap_or_else(|()| "https://api.sylphx.com".into());
    let key = setting("PUZZLED_FIXTURE_AUTH_READ_KEY")?;
    let http = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|_| ())?;
    let auth_url = resolve_env_url(&http, &origin, &key)
        .await
        .map_err(|_| ())?;
    let money = Money::from_env().ok_or(())?;
    if auth_url != format!("{}/v1/{expected}", origin.trim_end_matches('/'))
        || money.environment_resource().await.map_err(|_| ())? != expected
    {
        return Err(());
    }
    let name = format!("{expected}/end_users/{subject}");
    let response = http
        .get(format!("{}/v1/{name}", origin.trim_end_matches('/')))
        .bearer_auth(key)
        .send()
        .await
        .map_err(|_| ())?;
    if !response.status().is_success() {
        return Err(());
    }
    let body: Value = response.json().await.map_err(|_| ())?;
    let stamp = proof_time(&body, &name).ok_or(())?;
    let stamp = chrono::DateTime::parse_from_rfc3339(stamp).map_err(|_| ())?;
    let url = crate::shared::db_config::select_database_url().ok_or(())?;
    let pool = PgPoolOptions::new()
        .max_connections(1)
        .acquire_timeout(Duration::from_secs(5))
        .connect(&url)
        .await
        .map_err(|_| ())?;
    register_proven(&pool, &subject, &fixture, stamp.with_timezone(&chrono::Utc)).await
}

/// Commit a supported Auth proof before normal product admission. Kept separate
/// from the network adapter so atomicity is exercised against migrated Postgres.
pub(crate) async fn register_proven(
    pool: &sqlx::PgPool,
    subject: &str,
    fixture: &str,
    stamp: chrono::DateTime<chrono::Utc>,
) -> Result<(), ()> {
    let mut tx = pool.begin().await.map_err(|_| ())?;
    // Serialize two provisioning calls without locking the processor network.
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended('puzzled:fixture:' || $1,0))")
        .bind(subject)
        .execute(&mut *tx)
        .await
        .map_err(|_| ())?;
    let existing: Option<(String, String)> = sqlx::query_as(
        "SELECT fixture_key,auth_subject FROM synthetic_fixtures WHERE auth_subject=$1 OR fixture_key=$2",
    ).bind(subject).bind(fixture).fetch_optional(&mut *tx).await.map_err(|_| ())?;
    if let Some((known_key, known_subject)) = existing {
        if known_key != fixture || known_subject != subject {
            return Err(());
        }
        return tx.commit().await.map_err(|_| ());
    }
    let player = Uuid::now_v7();
    let inserted: Option<Uuid> = sqlx::query_scalar(
        "INSERT INTO auth_subjects (subject,user_id) VALUES ($1,$2) ON CONFLICT (subject) DO NOTHING RETURNING user_id",
    ).bind(subject).bind(player).fetch_optional(&mut *tx).await.map_err(|_| ())?;
    if inserted != Some(player) {
        return Err(());
    }
    sqlx::query("INSERT INTO synthetic_fixtures (user_id,fixture_key,auth_subject,synthetic_time) VALUES ($1,$2,$3,$4)")
        .bind(player).bind(fixture).bind(subject).bind(stamp).execute(&mut *tx).await.map_err(|_| ())?;
    tx.commit().await.map_err(|_| ())
}

/// Counts/status only: no account, buyer, response body or credential output.
pub async fn main() -> i32 {
    match register().await {
        Ok(()) => {
            println!("{{\"outcome\":\"registered\"}}");
            0
        }
        Err(()) => {
            println!("{{\"outcome\":\"unconfirmed\"}}");
            2
        }
    }
}

#[cfg(test)]
mod tests {
    use super::proof_time;
    use serde_json::json;

    #[test]
    fn a_stamp_requires_the_exact_supported_resource() {
        let name = "orgs/example/projects/example/envs/example/end_users/example";
        assert!(
            proof_time(
                &json!({"name":name,"synthetic_time":"2026-10-30T12:00:00Z"}),
                name
            )
            .is_some()
        );
        for body in [
            json!({"name":name}),
            json!({"name":name,"synthetic_time":"true"}),
            json!({"name":"other","synthetic_time":"2026-10-30T12:00:00Z"}),
        ] {
            assert!(proof_time(&body, name).is_none());
        }
    }
}
