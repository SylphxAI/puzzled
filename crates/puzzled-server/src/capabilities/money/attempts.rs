//! Retained normal checkout requests. Only the process that inserts a request
//! may submit it; later calls reconcile the same Money resource by GET.
//! A timeout or crash leaves a pending request, never permission to replace it.

use serde_json::Value;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use super::client::{Money, MoneyError};

#[derive(Debug)]
pub enum Error {
    InvalidRequest,
    RequestChanged,
    Pending,
    Refused,
    Unavailable,
}

pub struct Attempt {
    pub request_id: String,
    pub state: String,
    pub session: Option<Value>,
}

fn uuid(value: &str) -> Result<Uuid, Error> {
    Uuid::parse_str(value).map_err(|_| Error::InvalidRequest)
}

/// An explicit request id is scoped to its verified buyer. Freeze the body
/// before a network call, including attribution, consent and return URLs.
pub async fn create(
    pool: &PgPool,
    money: &Money,
    user_id: &str,
    request_id: &str,
    body: &Value,
) -> Result<Value, Error> {
    let user = uuid(user_id)?;
    let request = uuid(request_id)?;
    let candidate = format!("chk-{}", Uuid::now_v7().simple());
    let inserted: Option<String> = sqlx::query_scalar(
        "INSERT INTO checkout_attempts (user_id,request_id,money_session_id,request) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id,request_id) DO NOTHING RETURNING money_session_id",
    )
    .bind(user).bind(request).bind(candidate).bind(body).fetch_optional(pool).await
    .map_err(|_| Error::Unavailable)?;
    let Some(session_id) = inserted else {
        let stored: Value = sqlx::query_scalar(
            "SELECT request FROM checkout_attempts WHERE user_id=$1 AND request_id=$2",
        )
        .bind(user)
        .bind(request)
        .fetch_one(pool)
        .await
        .map_err(|_| Error::Unavailable)?;
        if stored != *body {
            return Err(Error::RequestChanged);
        }
        return get(pool, money, user_id, Some(request_id))
            .await?
            .and_then(|attempt| attempt.session)
            .ok_or(Error::Pending);
    };
    match money.create_retained_checkout(&session_id, body).await {
        Ok(session) => {
            require_owner(&session, user_id)?;
            mark(pool, user, request, "ready").await?;
            Ok(session)
        }
        // Only completed input validation is a semantic refusal. Auth,
        // routing, throttling and transport outcomes remain UNKNOWN.
        Err(MoneyError::Refused {
            status: 400 | 422, ..
        }) => {
            mark(pool, user, request, "refused").await?;
            Err(Error::Refused)
        }
        // There may already be a processor session. The next invocation
        // reads its chosen resource id; it does not repeat this POST.
        Err(_) => Err(Error::Unavailable),
    }
}

fn require_owner(session: &Value, user_id: &str) -> Result<(), Error> {
    if session.pointer("/subject/end_user").and_then(Value::as_str) == Some(user_id) {
        Ok(())
    } else {
        Err(Error::Unavailable)
    }
}

async fn mark(pool: &PgPool, user: Uuid, request: Uuid, state: &str) -> Result<(), Error> {
    sqlx::query("UPDATE checkout_attempts SET state=$3 WHERE user_id=$1 AND request_id=$2")
        .bind(user)
        .bind(request)
        .bind(state)
        .execute(pool)
        .await
        .map(|_| ())
        .map_err(|_| Error::Unavailable)
}

/// Read a buyer's named request, or their most recent request. Check ownership
/// again on Money's answer before returning its private hosted URL.
pub async fn get(
    pool: &PgPool,
    money: &Money,
    user_id: &str,
    request_id: Option<&str>,
) -> Result<Option<Attempt>, Error> {
    let user = uuid(user_id)?;
    let request = request_id.map(uuid).transpose()?;
    let row = sqlx::query(
        "SELECT request_id,money_session_id,state FROM checkout_attempts WHERE user_id=$1 AND ($2::uuid IS NULL OR request_id=$2) ORDER BY created_at DESC,request_id DESC LIMIT 1",
    ).bind(user).bind(request).fetch_optional(pool).await.map_err(|_| Error::Unavailable)?;
    let Some(row) = row else { return Ok(None) };
    let request: Uuid = row.try_get("request_id").map_err(|_| Error::Unavailable)?;
    let session_id: String = row
        .try_get("money_session_id")
        .map_err(|_| Error::Unavailable)?;
    let state: String = row.try_get("state").map_err(|_| Error::Unavailable)?;
    if state == "refused" {
        return Ok(Some(Attempt {
            request_id: request.to_string(),
            state,
            session: None,
        }));
    }
    match money.checkout_session(&session_id).await {
        Ok(session) => {
            require_owner(&session, user_id)?;
            mark(pool, user, request, "ready").await?;
            Ok(Some(Attempt {
                request_id: request.to_string(),
                state: "ready".into(),
                session: Some(session),
            }))
        }
        Err(MoneyError::Refused { status: 404, .. }) if state == "pending" => Ok(Some(Attempt {
            request_id: request.to_string(),
            state,
            session: None,
        })),
        Err(_) => Err(Error::Unavailable),
    }
}
