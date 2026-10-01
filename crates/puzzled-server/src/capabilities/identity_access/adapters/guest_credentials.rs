//! Server-issued browser identity; public player ids are not credentials.
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use sha2::{Digest, Sha256};
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

pub const COOKIE: &str = "__Host-puzzled_guest";
pub const VERIFIED_GUEST_HEADER: &str = "x-puzzled-verified-guest";

pub const ACCOUNT_BACKED_SQL: &str = "SELECT EXISTS (SELECT 1 FROM auth_subjects WHERE user_id = $1) OR EXISTS (SELECT 1 FROM user_preferences WHERE user_id = $1) OR EXISTS (SELECT 1 FROM user_display_cache WHERE user_id = $1) OR EXISTS (SELECT 1 FROM notification_preferences WHERE user_id = $1) OR EXISTS (SELECT 1 FROM billing_customers WHERE user_id = $1) OR EXISTS (SELECT 1 FROM billing_subscriptions WHERE user_id = $1) OR EXISTS (SELECT 1 FROM billing_ledger WHERE user_id = $1) OR EXISTS (SELECT 1 FROM family_groups WHERE owner_user_id = $1) OR EXISTS (SELECT 1 FROM family_members WHERE owner_user_id = $1 OR member_user_id = $1) OR EXISTS (SELECT 1 FROM account_attribution WHERE user_id = $1) OR EXISTS (SELECT 1 FROM checkout_consents WHERE user_id = $1) OR EXISTS (SELECT 1 FROM win_back_emails WHERE user_id = $1) OR EXISTS (SELECT 1 FROM push_subscriptions WHERE user_id = $1) OR EXISTS (SELECT 1 FROM guest_credentials WHERE adopted_user_id = $1)";

pub async fn account_backed(connection: &mut PgConnection, player: Uuid) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar(ACCOUNT_BACKED_SQL).bind(player).fetch_one(connection).await
}

/// Account mapping, guest access, erasure, and adoption share this lock order.
pub async fn lock_players(connection: &mut PgConnection, mut players: Vec<Uuid>) -> Result<(), sqlx::Error> {
    players.sort_unstable();
    players.dedup();
    let mut keys = Vec::new();
    for player in players {
        let key: i64 = sqlx::query_scalar("SELECT hashtextextended('puzzled:erasure:' || $1, 0)")
            .bind(player.to_string()).fetch_one(&mut *connection).await?;
        keys.push(key);
    }
    keys.sort_unstable();
    keys.dedup();
    for key in keys {
        sqlx::query("SELECT pg_advisory_xact_lock($1)").bind(key)
            .execute(&mut *connection).await?;
    }
    Ok(())
}

pub fn token_hash(token: &str) -> Option<String> {
    let raw = URL_SAFE_NO_PAD.decode(token).ok()?;
    (raw.len() == 32).then(|| URL_SAFE_NO_PAD.encode(Sha256::digest(raw)))
}

pub async fn lookup_hash(pool: &PgPool, hash: &str) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT user_id FROM guest_credentials WHERE token_hash = $1 AND adopted_user_id IS NULL AND revoked_at IS NULL")
        .bind(hash).fetch_optional(pool).await
}

pub async fn validate_locked(connection: &mut PgConnection, player: Uuid, hash: &str) -> Result<bool, sqlx::Error> {
    let live: Option<Uuid> = sqlx::query_scalar("SELECT user_id FROM guest_credentials WHERE user_id = $1 AND token_hash = $2 AND adopted_user_id IS NULL AND revoked_at IS NULL FOR SHARE")
        .bind(player).bind(hash).fetch_optional(&mut *connection).await?;
    Ok(live == Some(player) && !account_backed(connection, player).await?)
}

pub fn mint_cookie(existing: Option<&str>) -> Result<String, sqlx::Error> {
    let token = match existing.filter(|token| token_hash(token).is_some()) {
        Some(token) => token.to_string(),
        None => {
            let mut raw = [0_u8; 32];
            getrandom::fill(&mut raw).map_err(|error| sqlx::Error::Io(std::io::Error::other(error.to_string())))?;
            URL_SAFE_NO_PAD.encode(raw)
        }
    };
    Ok(format!("{COOKIE}={token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=34560000"))
}

pub async fn unused_player(connection: &mut PgConnection, player: Uuid) -> Result<bool, sqlx::Error> {
    if account_backed(connection, player).await? { return Ok(false); }
    for (table, column, _) in crate::capabilities::preferences::adapters::account_deletion::USER_KEYED_COLUMNS {
        let statement = format!("SELECT EXISTS (SELECT 1 FROM \"{table}\" WHERE \"{column}\" = $1)");
        let exists: bool = sqlx::query_scalar(sqlx::AssertSqlSafe(statement))
            .bind(player).fetch_one(&mut *connection).await?;
        if exists { return Ok(false); }
    }
    Ok(true)
}

/// Test fixture that performs a first guest write's allocation. Production
/// bootstrap only returns a cookie and never populates the registry.
#[cfg(test)]
pub async fn issue(pool: &PgPool) -> Result<String, sqlx::Error> {
    issue_with_first_candidate(pool, Uuid::now_v7()).await
}

#[cfg(test)]
pub(crate) async fn issue_with_first_candidate(pool: &PgPool, mut player: Uuid) -> Result<String, sqlx::Error> {
    let cookie = mint_cookie(None)?;
    let token = cookie.split(';').next().and_then(|pair| pair.split_once('=').map(|(_, token)| token))
        .ok_or(sqlx::Error::RowNotFound)?;
    let hash = token_hash(token).ok_or(sqlx::Error::RowNotFound)?;
    loop {
        let mut tx = pool.begin().await?;
        lock_players(&mut tx, vec![player]).await?;
        if !unused_player(&mut tx, player).await? {
            tx.rollback().await?;
            player = Uuid::now_v7();
            continue;
        }
        sqlx::query("INSERT INTO guest_credentials (token_hash, user_id, provenance) VALUES ($1, $2, 'server_issued')")
            .bind(&hash).bind(player).execute(&mut *tx).await?;
        tx.commit().await?;
        return Ok(cookie);
    }
}

pub fn cookie_token(headers: &axum::http::HeaderMap) -> Option<&str> {
    let mut token = None;
    for value in headers.get_all(axum::http::header::COOKIE) {
        for pair in value.to_str().ok()?.split(';') {
            if let Some((name, value)) = pair.trim().split_once('=') {
                if name == COOKIE {
                    if token.is_some() { return None; }
                    token = Some(value);
                }
            }
        }
    }
    token
}

pub async fn attach_guest(
    axum::extract::State(pool): axum::extract::State<Option<PgPool>>,
    mut request: axum::http::Request<axum::body::Body>,
    next: axum::middleware::Next,
) -> axum::response::Response {
    use axum::response::IntoResponse;
    request.headers_mut().remove(VERIFIED_GUEST_HEADER);
    if request.uri().path() == "/v1/guest/session" { return next.run(request).await; }
    // A signed subject that aliases a registered guest is not an account.
    if let (Some(pool), Ok(identity)) = (&pool, crate::bootstrap::identity::verify(request.headers())) {
        if let Ok(player) = Uuid::parse_str(&identity.user_id) {
            let result = async {
                let mut tx = pool.begin().await?;
                lock_players(&mut tx, vec![player]).await?;
                let collision: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM guest_credentials WHERE user_id = $1)")
                    .bind(player).fetch_one(&mut *tx).await?;
                tx.commit().await?;
                Ok::<_, sqlx::Error>(collision)
            }.await;
            match result {
                Ok(true) => return (axum::http::StatusCode::UNAUTHORIZED, axum::Json(serde_json::json!({"code":"unauthenticated", "message":"identity_required"}))).into_response(),
                Ok(false) => {},
                Err(_) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, axum::Json(serde_json::json!({"code":"internal", "message":"identity_store_failed"}))).into_response(),
            }
        }
    }
    if let Some(hash) = cookie_token(request.headers()).and_then(token_hash) {
        if let Ok(value) = hash.parse() {
            request.headers_mut().insert(VERIFIED_GUEST_HEADER, value);
        }
    }
    next.run(request).await
}

pub async fn session(
    axum::extract::State(state): axum::extract::State<crate::AppState>,
    headers: axum::http::HeaderMap,
    body: axum::body::Bytes,
) -> axum::response::Response {
    use axum::response::IntoResponse;
    let Ok(expected) = crate::shared::public_origin::public_origin() else {
        return axum::http::StatusCode::SERVICE_UNAVAILABLE.into_response();
    };
    if !crate::shared::public_origin::admits_browser(&headers, &expected)
        || serde_json::from_slice::<serde_json::Value>(&body).is_err()
    {
        return axum::http::StatusCode::FORBIDDEN.into_response();
    }
    let _ = state; // Bootstrap does not acquire a connection or write rows.
    let existing = cookie_token(&headers).filter(|token| token_hash(token).is_some());
    let issued = existing.is_none();
    match mint_cookie(existing) {
        Ok(cookie) => match cookie.parse() {
            Ok(value) => {
                let mut response = axum::Json(serde_json::json!({"issued": issued})).into_response();
                response.headers_mut().insert(axum::http::header::SET_COOKIE, value);
                response
            }
            Err(_) => axum::http::StatusCode::INTERNAL_SERVER_ERROR.into_response(),
        },
        Err(_) => axum::http::StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    }

}

/// Issuance origin and JSON admission precede Auth verification and database
/// access, even when an invalid browser request supplies cookies or a bearer.
pub async fn bootstrap_guard(
    mut request: axum::http::Request<axum::body::Body>,
    next: axum::middleware::Next,
) -> axum::response::Response {
    use axum::response::IntoResponse;
    if request.uri().path() != "/v1/guest/session" { return next.run(request).await; }
    let Ok(origin) = crate::shared::public_origin::public_origin() else {
        return axum::http::StatusCode::SERVICE_UNAVAILABLE.into_response();
    };
    if !crate::shared::public_origin::admits_browser(request.headers(), &origin) {
        return axum::http::StatusCode::FORBIDDEN.into_response();
    }
    let body = std::mem::replace(request.body_mut(), axum::body::Body::empty());
    let Ok(bytes) = axum::body::to_bytes(body, 4096).await else {
        return axum::http::StatusCode::FORBIDDEN.into_response();
    };
    if serde_json::from_slice::<serde_json::Value>(&bytes).is_err() {
        return axum::http::StatusCode::FORBIDDEN.into_response();
    }
    *request.body_mut() = axum::body::Body::from(bytes);
    next.run(request).await
}
