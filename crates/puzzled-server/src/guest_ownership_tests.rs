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

#[tokio::test]
async fn freeze_failure_rolls_back_adoption_and_keeps_credential_live() {
    use crate::capabilities::identity_access::adapters::guest_credentials;
    let Some(pool) = fresh_database().await else { return; };
    let cookie = guest_credentials::issue(&pool).await.unwrap();
    let pair = cookie.split(';').next().unwrap();
    let hash = guest_credentials::token_hash(pair.split_once('=').unwrap().1).unwrap();
    let guest = guest_credentials::lookup_hash(&pool, &hash).await.unwrap().unwrap();
    let account = Uuid::now_v7();
    sqlx::query("INSERT INTO auth_subjects(subject,user_id) VALUES ($1,$2)")
        .bind(format!("principal-{account}")).bind(account).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO game_sessions(user_id,game_slug,status,attempts,mode) VALUES ($1,'word-guess','won',1,'daily')")
        .bind(guest).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO user_freeze_data(user_id,freezes_available) VALUES($1,1)")
        .bind(guest).execute(&pool).await.unwrap();
    sqlx::raw_sql("CREATE FUNCTION fail_freeze_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test rollback'; END $$; CREATE TRIGGER fail_freeze_insert BEFORE INSERT ON user_freeze_data FOR EACH ROW EXECUTE FUNCTION fail_freeze_insert();")
        .execute(&pool).await.unwrap();
    let app = router(AppState::new(Some(pool.clone())));
    let signed = token(&account.to_string());
    assert_eq!(request(&app, "/puzzled.v1.StatsService/GetHistory", Some(pair), Some(&signed), None).await.0, StatusCode::INTERNAL_SERVER_ERROR);
    let owners: Vec<Uuid> = sqlx::query_scalar("SELECT user_id FROM game_sessions").fetch_all(&pool).await.unwrap();
    assert_eq!(owners, [guest]);
    assert_eq!(guest_credentials::lookup_hash(&pool, &hash).await.unwrap(), Some(guest));
    let freeze_owner: Uuid = sqlx::query_scalar("SELECT user_id FROM user_freeze_data").fetch_one(&pool).await.unwrap();
    assert_eq!(freeze_owner, guest);
    pool.close().await;
}

#[tokio::test]
async fn private_access_lease_serializes_adoption_and_revocation() {
    use crate::bootstrap::identity::admitted_request_identities;
    use crate::capabilities::identity_access::adapters::guest_credentials;
    let Some(pool) = fresh_database().await else { return; };
    let cookie = guest_credentials::issue(&pool).await.unwrap();
    let pair = cookie.split(';').next().unwrap().to_string();
    let hash = guest_credentials::token_hash(pair.split_once('=').unwrap().1).unwrap();
    let guest = guest_credentials::lookup_hash(&pool, &hash).await.unwrap().unwrap();
    let account = Uuid::now_v7();
    sqlx::query("INSERT INTO auth_subjects(subject,user_id) VALUES($1,$2)")
        .bind(format!("principal-{account}")).bind(account).execute(&pool).await.unwrap();
    let mut headers = axum::http::HeaderMap::new();
    headers.insert(guest_credentials::VERIFIED_GUEST_HEADER, hash.parse().unwrap());
    let context = connectrpc::RequestContext::new(headers);
    let mut access = admitted_request_identities(&context, Some(&pool)).await.unwrap();
    let app = router(AppState::new(Some(pool.clone())));
    let signed = token(&account.to_string());
    let account_app = app.clone();
    let account_cookie = pair.clone();
    let adoption = tokio::spawn(async move {
        request(&account_app, "/puzzled.v1.StatsService/GetHistory", Some(&account_cookie), Some(&signed), None).await.0
    });
    // Wait for an observed database lock waiter, not a guessed wall-clock delay.
    tokio::time::timeout(std::time::Duration::from_secs(5), async {
        loop {
            let waiting: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype='advisory' AND NOT granted AND database=(SELECT oid FROM pg_database WHERE datname=current_database()))")
                .fetch_one(&pool).await.unwrap();
            if waiting { break; }
            tokio::task::yield_now().await;
        }
    }).await.unwrap();
    assert!(!adoption.is_finished());
    sqlx::query("INSERT INTO game_sessions(user_id,game_slug,status,attempts,mode) VALUES($1,'word-guess','won',1,'daily')")
        .bind(guest).execute(access.connection().unwrap()).await.unwrap();
    access.commit().await.unwrap();
    assert_eq!(adoption.await.unwrap(), StatusCode::OK);
    let owners: Vec<Uuid> = sqlx::query_scalar("SELECT user_id FROM game_sessions").fetch_all(&pool).await.unwrap();
    assert_eq!(owners, [account]);
    assert_eq!(request(&app, "/puzzled.v1.StatsService/GetHistory", Some(&pair), None, None).await.0, StatusCode::UNAUTHORIZED);
    pool.close().await;
}

#[tokio::test]
async fn issuance_rejects_origin_ambiguity_without_database_effects() {
    let Some(pool) = fresh_database().await else { return; };
    let app = router(AppState::new(Some(pool.clone())));
    for origin in [None, Some("null"), Some("https://elsewhere.invalid"), Some("https://puzzled.gg:8443"), Some("https://puzzled.gg, https://puzzled.gg")] {
        let mut req = Request::builder().method("POST").uri("/v1/guest/session")
            .header("content-type", "application/json").header("host", "internal.invalid")
            .header("x-forwarded-host", "puzzled.gg");
        if let Some(origin) = origin { req = req.header("origin", origin); }
        let response = app.clone().oneshot(req.body(Body::from("{}")).unwrap()).await.unwrap();
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        assert!(response.headers().get("set-cookie").is_none());
    }
    for (duplicate, mime, fetch_site) in [(true, "application/json", "same-origin"), (false,"text/plain","same-origin"), (false,"application/json","cross-site")] {
        let mut req = Request::builder().method("POST").uri("/v1/guest/session")
            .header("origin", "https://puzzled.gg").header("content-type",mime).header("sec-fetch-site",fetch_site);
        if duplicate { req = req.header("origin", "https://puzzled.gg"); }
        let response = app.clone().oneshot(req.body(Body::from("{}")).unwrap()).await.unwrap();
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        assert!(response.headers().get("set-cookie").is_none());
    }
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM guest_credentials").fetch_one(&pool).await.unwrap();
    assert_eq!(count,0);
    pool.close().await;
}

#[tokio::test]
async fn allocation_collision_never_aliases_existing_account_or_guest() {
    use crate::capabilities::identity_access::adapters::{auth_subjects, guest_credentials};
    let Some(pool) = fresh_database().await else { return; };
    let account = Uuid::now_v7();
    sqlx::query("INSERT INTO auth_subjects(subject,user_id) VALUES($1,$2)")
        .bind(format!("principal-{account}")).bind(account).execute(&pool).await.unwrap();
    let cookie = guest_credentials::issue_with_first_candidate(&pool, account).await.unwrap();
    let hash = guest_credentials::token_hash(cookie.split(';').next().unwrap().split_once('=').unwrap().1).unwrap();
    let guest = guest_credentials::lookup_hash(&pool, &hash).await.unwrap().unwrap();
    assert_ne!(guest,account);
    assert_eq!(guest.get_version_num(),7);
    let remapped = auth_subjects::player_for(&pool,&format!("principal-{guest}"),None).await.unwrap();
    assert_ne!(remapped,guest);
    assert_eq!(remapped.get_version_num(),7);
    assert_eq!(guest_credentials::lookup_hash(&pool,&hash).await.unwrap(),Some(guest));
    pool.close().await;
}

#[tokio::test]
async fn issuance_header_refusal_precedes_unavailable_database_and_supplied_credentials() {
    let pool = sqlx::postgres::PgPoolOptions::new().connect_lazy("postgres://test@127.0.0.1:59987/test").unwrap();
    let app = router(AppState::new(Some(pool)));
    let req = Request::builder().method("POST").uri("/v1/guest/session")
        .header("content-type","application/json").header("origin","https://foreign.invalid")
        .header("authorization",format!("Bearer {}",token(&Uuid::now_v7().to_string())))
        .header("cookie","__Host-puzzled_guest=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
        .body(Body::from("{}")).unwrap();
    let response = app.oneshot(req).await.unwrap();
    assert_eq!(response.status(),StatusCode::FORBIDDEN);
    assert!(response.headers().get("set-cookie").is_none());
}

#[tokio::test]
async fn second_guest_cookie_never_reads_or_adopts_a_public_player_id() {
    use crate::capabilities::identity_access::adapters::guest_credentials;
    let Some(pool) = fresh_database().await else { return; };
    let app = router(AppState::new(Some(pool.clone())));
    let a_cookie = guest_credentials::issue(&pool).await.unwrap();
    let b_cookie = guest_credentials::issue(&pool).await.unwrap();
    let a_pair = a_cookie.split(';').next().unwrap();
    let b_pair = b_cookie.split(';').next().unwrap();
    let a_hash = guest_credentials::token_hash(a_pair.split_once('=').unwrap().1).unwrap();
    let b_hash = guest_credentials::token_hash(b_pair.split_once('=').unwrap().1).unwrap();
    let a = guest_credentials::lookup_hash(&pool,&a_hash).await.unwrap().unwrap();
    let b = guest_credentials::lookup_hash(&pool,&b_hash).await.unwrap().unwrap();
    for (player, attempts) in [(a,7),(b,2)] {
        sqlx::query("INSERT INTO game_sessions(user_id,game_slug,status,attempts,mode) VALUES($1,'word-guess','won',$2,'daily')")
            .bind(player).bind(attempts).execute(&pool).await.unwrap();
    }
    let (status, body, _) = request(&app,"/puzzled.v1.StatsService/GetHistory",Some(b_pair),None,Some(&a.to_string())).await;
    assert_eq!(status,StatusCode::OK);
    let sessions = body["sessions"].as_array().unwrap();
    assert_eq!(sessions.len(),1);
    assert_eq!(sessions[0]["attempts"],2);
    let account = Uuid::now_v7();
    sqlx::query("INSERT INTO auth_subjects(subject,user_id) VALUES($1,$2)")
        .bind(format!("principal-{account}")).bind(account).execute(&pool).await.unwrap();
    assert_eq!(request(&app,"/puzzled.v1.StatsService/GetHistory",Some(b_pair),Some(&token(&account.to_string())),Some(&a.to_string())).await.0,StatusCode::OK);
    let a_owner: Uuid = sqlx::query_scalar("SELECT user_id FROM game_sessions WHERE attempts=7").fetch_one(&pool).await.unwrap();
    let b_owner: Uuid = sqlx::query_scalar("SELECT user_id FROM game_sessions WHERE attempts=2").fetch_one(&pool).await.unwrap();
    assert_eq!(a_owner,a);
    assert_eq!(b_owner,account);
    assert_eq!(guest_credentials::lookup_hash(&pool,&a_hash).await.unwrap(),Some(a));
    assert_eq!(guest_credentials::lookup_hash(&pool,&b_hash).await.unwrap(),None);
    pool.close().await;
}
