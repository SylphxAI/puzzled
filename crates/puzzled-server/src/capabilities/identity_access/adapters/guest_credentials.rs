//! Server-issued browser identity; public player ids are not credentials.
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use sha2::{Digest, Sha256};
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

pub const COOKIE: &str = "__Host-puzzled_guest";
pub const VERIFIED_GUEST_HEADER: &str = "x-puzzled-verified-guest";

pub const ACCOUNT_BACKED_SQL: &str = "SELECT EXISTS (SELECT 1 FROM auth_subjects WHERE user_id = $1) OR EXISTS (SELECT 1 FROM user_preferences WHERE user_id = $1) OR EXISTS (SELECT 1 FROM user_display_cache WHERE user_id = $1) OR EXISTS (SELECT 1 FROM notification_preferences WHERE user_id = $1) OR EXISTS (SELECT 1 FROM billing_customers WHERE user_id = $1) OR EXISTS (SELECT 1 FROM billing_subscriptions WHERE user_id = $1) OR EXISTS (SELECT 1 FROM family_groups WHERE owner_user_id = $1) OR EXISTS (SELECT 1 FROM family_members WHERE owner_user_id = $1 OR member_user_id = $1) OR EXISTS (SELECT 1 FROM account_attribution WHERE user_id = $1) OR EXISTS (SELECT 1 FROM checkout_consents WHERE user_id = $1) OR EXISTS (SELECT 1 FROM win_back_emails WHERE user_id = $1) OR EXISTS (SELECT 1 FROM push_subscriptions WHERE user_id = $1) OR EXISTS (SELECT 1 FROM guest_credentials WHERE adopted_user_id = $1)";

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
    let live: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM guest_credentials WHERE user_id = $1 AND token_hash = $2 AND adopted_user_id IS NULL AND revoked_at IS NULL)")
        .bind(player).bind(hash).fetch_one(&mut *connection).await?;
    Ok(live && !account_backed(connection, player).await?)
}

/// No client player id is accepted: every issuance allocates a fresh UUIDv7.
pub async fn issue(pool: &PgPool) -> Result<String, sqlx::Error> {
    use std::io::Read;
    let mut raw = [0_u8; 32];
    std::fs::File::open("/dev/urandom")
        .and_then(|mut file| file.read_exact(&mut raw))
        .map_err(sqlx::Error::Io)?;
    let token = URL_SAFE_NO_PAD.encode(raw);
    let hash = URL_SAFE_NO_PAD.encode(Sha256::digest(raw));
    loop {
        let player = Uuid::now_v7();
        let mut tx = pool.begin().await?;
        lock_players(&mut tx, vec![player]).await?;
        let mut unused = true;
        for (table, column, _) in crate::capabilities::preferences::adapters::account_deletion::USER_KEYED_COLUMNS {
            let statement = format!("SELECT EXISTS (SELECT 1 FROM \"{table}\" WHERE \"{column}\" = $1)");
            let exists: bool = sqlx::query_scalar(sqlx::AssertSqlSafe(statement))
                .bind(player).fetch_one(&mut *tx).await?;
            if exists { unused = false; break; }
        }
        if !unused { tx.rollback().await?; continue; }
        sqlx::query("INSERT INTO guest_credentials (token_hash, user_id, provenance) VALUES ($1, $2, 'server_issued')")
            .bind(&hash).bind(player).execute(&mut *tx).await?;
        tx.commit().await?;
        break;
    }
    Ok(format!("{COOKIE}={token}; Path=/; HttpOnly; Secure; SameSite=Lax"))
}

pub fn cookie_token(headers: &axum::http::HeaderMap) -> Option<&str> {
    headers.get(axum::http::header::COOKIE)?.to_str().ok()?.split(';')
        .filter_map(|pair| pair.trim().split_once('='))
        .find_map(|(name, value)| (name == COOKIE).then_some(value))
}

pub async fn attach_guest(
    axum::extract::State(pool): axum::extract::State<Option<PgPool>>,
    mut request: axum::http::Request<axum::body::Body>,
    next: axum::middleware::Next,
) -> axum::response::Response {
    use axum::response::IntoResponse;
    request.headers_mut().remove(VERIFIED_GUEST_HEADER);
    if let (Some(pool), Some(hash)) = (&pool, cookie_token(request.headers()).and_then(token_hash)) {
        match lookup_hash(pool, &hash).await {
            Ok(Some(_player)) => {
                if let Ok(value) = hash.parse() {
                    request.headers_mut().insert(VERIFIED_GUEST_HEADER, value);
                }
            }
            Ok(None) => {}
            Err(_) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, axum::Json(serde_json::json!({"code":"internal", "message":"identity_store_failed"}))).into_response(),
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
    let Some(pool) = &state.pool else { return axum::http::StatusCode::SERVICE_UNAVAILABLE.into_response(); };
    if let Some(hash) = cookie_token(&headers).and_then(token_hash) {
        match lookup_hash(pool, &hash).await {
            Ok(Some(player)) => {
                let result = async {
                    let mut tx = pool.begin().await?;
                    lock_players(&mut tx, vec![player]).await?;
                    let admitted = validate_locked(&mut tx, player, &hash).await?;
                    tx.commit().await?;
                    Ok::<_, sqlx::Error>(admitted)
                }.await;
                match result {
                    Ok(true) => return axum::Json(serde_json::json!({})).into_response(),
                    Ok(false) => {}
                    Err(_) => return axum::http::StatusCode::INTERNAL_SERVER_ERROR.into_response(),
                }
            }
            Ok(None) => {}
            Err(_) => return axum::http::StatusCode::INTERNAL_SERVER_ERROR.into_response(),
        }
    }
    match issue(pool).await {
        Ok(cookie) => match cookie.parse() {
            Ok(value) => {
                let mut response = axum::Json(serde_json::json!({})).into_response();
                response.headers_mut().insert(axum::http::header::SET_COOKIE, value);
                response
            }
            Err(_) => axum::http::StatusCode::INTERNAL_SERVER_ERROR.into_response(),
        },
        Err(_) => axum::http::StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    }
}
