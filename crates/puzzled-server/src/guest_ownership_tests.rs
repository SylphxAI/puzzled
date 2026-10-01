//! Browser identity boundary through the real router and migrated scratch DB.
#![allow(clippy::unwrap_used)]
use axum::body::{to_bytes, Body};
use axum::http::{Request, StatusCode};
use serde_json::{json, Value};
use tower::ServiceExt;
use uuid::Uuid;
use crate::test_support::{fresh_database, token};
use crate::{router, AppState};

async fn request(app: &axum::Router, path: &str, cookie: Option<&str>, bearer: Option<&str>, guest: Option<&str>) -> (StatusCode, Value, Option<String>) {
    let mut req = Request::builder().method("POST").uri(path)
        .header("content-type", "application/json").header("origin", "https://puzzled.gg");
    if let Some(cookie) = cookie { req = req.header("cookie", cookie); }
    if let Some(bearer) = bearer { req = req.header("authorization", format!("Bearer {bearer}")); }
    if let Some(guest) = guest { req = req.header("x-puzzled-guest-id", guest).header("x-puzzled-verified-guest", guest); }
    let response = app.clone().oneshot(req.body(Body::from("{}")).unwrap()).await.unwrap();
    let status = response.status();
    let cookie = response.headers().get("set-cookie").map(|v| v.to_str().unwrap().to_string());
    let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let body = serde_json::from_slice(&bytes).unwrap_or_else(|_| json!(null));
    (status, body, cookie)
}

#[tokio::test]
async fn unsigned_ids_and_forged_internal_headers_cannot_read_or_adopt() {
    let Some(pool) = fresh_database().await else { return; };
    let a = Uuid::now_v7();
    let b = Uuid::now_v7();
    sqlx::query("INSERT INTO auth_subjects(subject,user_id) VALUES ($1,$2),($3,$4)")
        .bind(format!("principal-{a}")).bind(a).bind(format!("principal-{b}")).bind(b).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO game_sessions(user_id,game_slug,status,attempts,mode) VALUES ($1,'word-guess','won',1,'daily')")
        .bind(a).execute(&pool).await.unwrap();
    let app = router(AppState::new(Some(pool.clone())));
    let b_token = token(&b.to_string());
    for path in ["/puzzled.v1.StatsService/GetHistory", "/puzzled.v1.StatsService/GetUserStats", "/puzzled.v1.GamificationService/GetStreakInfo"] {
        let legacy = format!("puzzled_guest_id={a}");
        let (status, _, _) = request(&app, path, Some(&legacy), None, Some(&a.to_string())).await;
        assert_eq!(status, StatusCode::UNAUTHORIZED);
        let (status, body, _) = request(&app, path, Some(&legacy), Some(&b_token), Some(&a.to_string())).await;
        assert_eq!(status, StatusCode::OK);
        if path.ends_with("GetHistory") { assert!(body.get("sessions").is_none_or(|v| v.as_array().unwrap().is_empty())); }
        let owners: Vec<Uuid> = sqlx::query_scalar("SELECT user_id FROM game_sessions ORDER BY user_id")
            .fetch_all(&pool).await.unwrap();
        assert_eq!(owners, [a]);
    }
    pool.close().await;
}

#[tokio::test]
async fn issued_cookie_is_fresh_host_only_and_progress_adopts_without_deleting_collisions() {
    use crate::capabilities::identity_access::adapters::guest_credentials;
    let Some(pool) = fresh_database().await else { return; };
    let app = router(AppState::new(Some(pool.clone())));
    let (status, body, cookie) = request(&app, "/v1/guest/session", None, None, Some(&Uuid::now_v7().to_string())).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, json!({}));
    let cookie = cookie.unwrap();
    assert!(cookie.starts_with("__Host-puzzled_guest="));
    for attribute in ["Path=/", "HttpOnly", "Secure", "SameSite=Lax"] { assert!(cookie.contains(attribute)); }
    assert!(!cookie.contains("Domain="));
    let pair = cookie.split(';').next().unwrap();
    let raw = pair.split_once('=').unwrap().1;
    let hash = guest_credentials::token_hash(raw).unwrap();
    let guest = guest_credentials::lookup_hash(&pool, &hash).await.unwrap().unwrap();
    assert_eq!(guest.get_version_num(), 7);
    assert_ne!(hash, raw);
    let account = Uuid::now_v7();
    sqlx::query("INSERT INTO auth_subjects(subject,user_id) VALUES ($1,$2)")
        .bind(format!("principal-{account}")).bind(account).execute(&pool).await.unwrap();
    let puzzle = Uuid::now_v7();
    // The fixture's null puzzle id avoids depending on a content row; ritual
    // collisions still name the same module and product day.
    let _ = puzzle;
    for player in [guest, account] {
        sqlx::query("INSERT INTO game_sessions(user_id,game_slug,status,attempts,mode,is_ritual,day_key) VALUES ($1,'word-guess','won',1,'daily',true,'2026-09-30')")
            .bind(player).execute(&pool).await.unwrap();
    }
    sqlx::query("INSERT INTO game_sessions(user_id,game_slug,status,attempts,mode,is_ritual,day_key) VALUES ($1,'word-guess','won',1,'daily',true,'2026-09-29')")
        .bind(guest).execute(&pool).await.unwrap();
    assert_eq!(request(&app, "/puzzled.v1.StatsService/GetHistory", Some(pair), None, None).await.0, StatusCode::OK);
    let account_token = token(&account.to_string());
    assert_eq!(request(&app, "/puzzled.v1.StatsService/GetHistory", Some(pair), Some(&account_token), None).await.0, StatusCode::OK);
    let rows: i64 = sqlx::query_scalar("SELECT count(*) FROM game_sessions").fetch_one(&pool).await.unwrap();
    assert_eq!(rows, 3);
    let adopted: i64 = sqlx::query_scalar("SELECT count(*) FROM game_sessions WHERE user_id=$1 AND adopted_from_guest=$2")
        .bind(account).bind(guest).fetch_one(&pool).await.unwrap();
    assert_eq!(adopted, 1);
    assert!(guest_credentials::lookup_hash(&pool, &hash).await.unwrap().is_none());
    assert_eq!(request(&app, "/puzzled.v1.StatsService/GetHistory", Some(pair), None, None).await.0, StatusCode::UNAUTHORIZED);
    pool.close().await;
}
