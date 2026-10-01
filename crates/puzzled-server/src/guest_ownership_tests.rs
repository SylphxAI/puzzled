//! Browser identity boundary through the real router and migrated scratch DB.
#![allow(clippy::unwrap_used)]
use crate::test_support::{fresh_database, token};
use crate::{router, AppState};
use axum::body::{to_bytes, Body};
use axum::http::{Request, StatusCode};
use serde_json::{json, Value};
use tower::ServiceExt;
use uuid::Uuid;

async fn request(
    app: &axum::Router,
    path: &str,
    cookie: Option<&str>,
    bearer: Option<&str>,
    guest: Option<&str>,
) -> (StatusCode, Value, Option<String>) {
    let mut req = Request::builder()
        .method("POST")
        .uri(path)
        .header("content-type", "application/json")
        .header("origin", "https://puzzled.gg");
    if let Some(cookie) = cookie {
        req = req.header("cookie", cookie);
    }
    if let Some(bearer) = bearer {
        req = req.header("authorization", format!("Bearer {bearer}"));
    }
    if let Some(guest) = guest {
        req = req
            .header("x-puzzled-guest-id", guest)
            .header("x-puzzled-verified-guest", guest);
    }
    let response = app
        .clone()
        .oneshot(req.body(Body::from("{}")).unwrap())
        .await
        .unwrap();
    let status = response.status();
    let cookie = response
        .headers()
        .get("set-cookie")
        .map(|v| v.to_str().unwrap().to_string());
    let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let body = serde_json::from_slice(&bytes).unwrap_or_else(|_| json!(null));
    (status, body, cookie)
}

#[tokio::test]
async fn unsigned_ids_and_forged_internal_headers_cannot_read_or_adopt() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let a = Uuid::now_v7();
    let b = Uuid::now_v7();
    sqlx::query("INSERT INTO auth_subjects(subject,user_id) VALUES ($1,$2),($3,$4)")
        .bind(format!("principal-{a}"))
        .bind(a)
        .bind(format!("principal-{b}"))
        .bind(b)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO game_sessions(user_id,game_slug,status,attempts,mode) VALUES ($1,'word-guess','won',1,'daily')")
        .bind(a).execute(&pool).await.unwrap();
    let app = router(AppState::new(Some(pool.clone())));
    let b_token = token(&b.to_string());
    for path in [
        "/puzzled.v1.StatsService/GetHistory",
        "/puzzled.v1.StatsService/GetUserStats",
        "/puzzled.v1.GamificationService/GetStreakInfo",
    ] {
        let legacy = format!("puzzled_guest_id={a}");
        let (status, _, _) = request(&app, path, Some(&legacy), None, Some(&a.to_string())).await;
        assert_eq!(status, StatusCode::UNAUTHORIZED);
        let (status, body, _) = request(
            &app,
            path,
            Some(&legacy),
            Some(&b_token),
            Some(&a.to_string()),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        if path.ends_with("GetHistory") {
            assert!(body
                .get("sessions")
                .is_none_or(|v| v.as_array().unwrap().is_empty()));
        }
        let owners: Vec<Uuid> =
            sqlx::query_scalar("SELECT user_id FROM game_sessions ORDER BY user_id")
                .fetch_all(&pool)
                .await
                .unwrap();
        assert_eq!(owners, [a]);
    }
    pool.close().await;
}

#[tokio::test]
async fn issued_cookie_is_fresh_host_only_and_progress_adopts_without_deleting_collisions() {
    use crate::capabilities::identity_access::adapters::guest_credentials;
    let Some(pool) = fresh_database().await else {
        return;
    };
    let app = router(AppState::new(Some(pool.clone())));
    let (status, body, cookie) = request(
        &app,
        "/v1/guest/session",
        None,
        None,
        Some(&Uuid::now_v7().to_string()),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, json!({"issued":true}));
    let cookie = cookie.unwrap();
    assert!(cookie.starts_with("__Host-puzzled_guest="));
    for attribute in [
        "Path=/",
        "HttpOnly",
        "Secure",
        "SameSite=Lax",
        "Max-Age=34560000",
    ] {
        assert!(cookie.contains(attribute));
    }
    assert!(!cookie.contains("Domain="));
    let pair = cookie.split(';').next().unwrap();
    let raw = pair.split_once('=').unwrap().1;
    let hash = guest_credentials::token_hash(raw).unwrap();
    assert!(guest_credentials::lookup_hash(&pool, &hash)
        .await
        .unwrap()
        .is_none());
    let mut headers = axum::http::HeaderMap::new();
    headers.insert(
        guest_credentials::VERIFIED_GUEST_HEADER,
        hash.parse().unwrap(),
    );
    let first_write = crate::bootstrap::identity::admitted_request_identities(
        &connectrpc::RequestContext::new(headers),
        Some(&pool),
        true,
    )
    .await
    .unwrap();
    first_write.commit().await.unwrap();
    let guest = guest_credentials::lookup_hash(&pool, &hash)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(guest.get_version_num(), 7);
    assert_ne!(hash, raw);
    let account = Uuid::now_v7();
    sqlx::query("INSERT INTO auth_subjects(subject,user_id) VALUES ($1,$2)")
        .bind(format!("principal-{account}"))
        .bind(account)
        .execute(&pool)
        .await
        .unwrap();
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
    assert_eq!(
        request(
            &app,
            "/puzzled.v1.StatsService/GetHistory",
            Some(pair),
            None,
            None
        )
        .await
        .0,
        StatusCode::OK
    );
    let account_token = token(&account.to_string());
    assert_eq!(
        request(
            &app,
            "/puzzled.v1.StatsService/GetHistory",
            Some(pair),
            Some(&account_token),
            None
        )
        .await
        .0,
        StatusCode::OK
    );
    let rows: i64 = sqlx::query_scalar("SELECT count(*) FROM game_sessions")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(rows, 3);
    let adopted: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM game_sessions WHERE user_id=$1 AND adopted_from_guest=$2",
    )
    .bind(account)
    .bind(guest)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(adopted, 1);
    assert!(guest_credentials::lookup_hash(&pool, &hash)
        .await
        .unwrap()
        .is_none());
    assert_eq!(
        request(
            &app,
            "/puzzled.v1.StatsService/GetHistory",
            Some(pair),
            None,
            None
        )
        .await
        .0,
        StatusCode::UNAUTHORIZED
    );
    pool.close().await;
}

#[tokio::test]
async fn freeze_failure_rolls_back_adoption_and_keeps_credential_live() {
    use crate::capabilities::identity_access::adapters::guest_credentials;
    let Some(pool) = fresh_database().await else {
        return;
    };
    let cookie = guest_credentials::issue(&pool).await.unwrap();
    let pair = cookie.split(';').next().unwrap();
    let hash = guest_credentials::token_hash(pair.split_once('=').unwrap().1).unwrap();
    let guest = guest_credentials::lookup_hash(&pool, &hash)
        .await
        .unwrap()
        .unwrap();
    let account = Uuid::now_v7();
    sqlx::query("INSERT INTO auth_subjects(subject,user_id) VALUES ($1,$2)")
        .bind(format!("principal-{account}"))
        .bind(account)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO game_sessions(user_id,game_slug,status,attempts,mode) VALUES ($1,'word-guess','won',1,'daily')")
        .bind(guest).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO user_freeze_data(user_id,freezes_available) VALUES($1,1)")
        .bind(guest)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::raw_sql("CREATE FUNCTION fail_freeze_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test rollback'; END $$; CREATE TRIGGER fail_freeze_insert BEFORE INSERT ON user_freeze_data FOR EACH ROW EXECUTE FUNCTION fail_freeze_insert();")
        .execute(&pool).await.unwrap();
    let app = router(AppState::new(Some(pool.clone())));
    let signed = token(&account.to_string());
    assert_eq!(
        request(
            &app,
            "/puzzled.v1.StatsService/GetHistory",
            Some(pair),
            Some(&signed),
            None
        )
        .await
        .0,
        StatusCode::INTERNAL_SERVER_ERROR
    );
    let owners: Vec<Uuid> = sqlx::query_scalar("SELECT user_id FROM game_sessions")
        .fetch_all(&pool)
        .await
        .unwrap();
    assert_eq!(owners, [guest]);
    assert_eq!(
        guest_credentials::lookup_hash(&pool, &hash).await.unwrap(),
        Some(guest)
    );
    let freeze_owner: Uuid = sqlx::query_scalar("SELECT user_id FROM user_freeze_data")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(freeze_owner, guest);
    pool.close().await;
}

#[tokio::test]
async fn private_access_lease_serializes_adoption_and_revocation() {
    use crate::bootstrap::identity::admitted_request_identities;
    use crate::capabilities::identity_access::adapters::guest_credentials;
    let Some(pool) = fresh_database().await else {
        return;
    };
    let cookie = guest_credentials::issue(&pool).await.unwrap();
    let pair = cookie.split(';').next().unwrap().to_string();
    let hash = guest_credentials::token_hash(pair.split_once('=').unwrap().1).unwrap();
    let guest = guest_credentials::lookup_hash(&pool, &hash)
        .await
        .unwrap()
        .unwrap();
    let account = Uuid::now_v7();
    sqlx::query("INSERT INTO auth_subjects(subject,user_id) VALUES($1,$2)")
        .bind(format!("principal-{account}"))
        .bind(account)
        .execute(&pool)
        .await
        .unwrap();
    let mut headers = axum::http::HeaderMap::new();
    headers.insert(
        guest_credentials::VERIFIED_GUEST_HEADER,
        hash.parse().unwrap(),
    );
    let context = connectrpc::RequestContext::new(headers);
    let mut access = admitted_request_identities(&context, Some(&pool), false)
        .await
        .unwrap();
    let app = router(AppState::new(Some(pool.clone())));
    let signed = token(&account.to_string());
    let account_app = app.clone();
    let account_cookie = pair.clone();
    let adoption = tokio::spawn(async move {
        request(
            &account_app,
            "/puzzled.v1.StatsService/GetHistory",
            Some(&account_cookie),
            Some(&signed),
            None,
        )
        .await
        .0
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
    let owners: Vec<Uuid> = sqlx::query_scalar("SELECT user_id FROM game_sessions")
        .fetch_all(&pool)
        .await
        .unwrap();
    assert_eq!(owners, [account]);
    assert_eq!(
        request(
            &app,
            "/puzzled.v1.StatsService/GetHistory",
            Some(&pair),
            None,
            None
        )
        .await
        .0,
        StatusCode::UNAUTHORIZED
    );
    pool.close().await;
}

#[tokio::test]
async fn issuance_rejects_origin_ambiguity_without_database_effects() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let app = router(AppState::new(Some(pool.clone())));
    for origin in [
        None,
        Some("null"),
        Some("https://elsewhere.invalid"),
        Some("https://puzzled.gg:8443"),
        Some("https://puzzled.gg, https://puzzled.gg"),
    ] {
        let mut req = Request::builder()
            .method("POST")
            .uri("/v1/guest/session")
            .header("content-type", "application/json")
            .header("host", "internal.invalid")
            .header("x-forwarded-host", "puzzled.gg");
        if let Some(origin) = origin {
            req = req.header("origin", origin);
        }
        let response = app
            .clone()
            .oneshot(req.body(Body::from("{}")).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        assert!(response.headers().get("set-cookie").is_none());
    }
    for (duplicate, mime, fetch_site) in [
        (true, "application/json", "same-origin"),
        (false, "text/plain", "same-origin"),
        (false, "application/json", "cross-site"),
    ] {
        let mut req = Request::builder()
            .method("POST")
            .uri("/v1/guest/session")
            .header("origin", "https://puzzled.gg")
            .header("content-type", mime)
            .header("sec-fetch-site", fetch_site);
        if duplicate {
            req = req.header("origin", "https://puzzled.gg");
        }
        let response = app
            .clone()
            .oneshot(req.body(Body::from("{}")).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        assert!(response.headers().get("set-cookie").is_none());
    }
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM guest_credentials")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 0);
    pool.close().await;
}

#[tokio::test]
async fn allocation_collision_never_aliases_existing_account_or_guest() {
    use crate::capabilities::identity_access::adapters::{auth_subjects, guest_credentials};
    let Some(pool) = fresh_database().await else {
        return;
    };
    let account = Uuid::now_v7();
    sqlx::query("INSERT INTO auth_subjects(subject,user_id) VALUES($1,$2)")
        .bind(format!("principal-{account}"))
        .bind(account)
        .execute(&pool)
        .await
        .unwrap();
    let cookie = guest_credentials::issue_with_first_candidate(&pool, account)
        .await
        .unwrap();
    let hash =
        guest_credentials::token_hash(cookie.split(';').next().unwrap().split_once('=').unwrap().1)
            .unwrap();
    let guest = guest_credentials::lookup_hash(&pool, &hash)
        .await
        .unwrap()
        .unwrap();
    assert_ne!(guest, account);
    assert_eq!(guest.get_version_num(), 7);
    let remapped = auth_subjects::player_for(&pool, &format!("principal-{guest}"), None)
        .await
        .unwrap();
    assert_ne!(remapped, guest);
    assert_eq!(remapped.get_version_num(), 7);
    assert_eq!(
        guest_credentials::lookup_hash(&pool, &hash).await.unwrap(),
        Some(guest)
    );
    pool.close().await;
}

#[tokio::test]
async fn issuance_header_refusal_precedes_unavailable_database_and_supplied_credentials() {
    let pool = sqlx::postgres::PgPoolOptions::new()
        .connect_lazy("postgres://test@127.0.0.1:59987/test")
        .unwrap();
    let app = router(AppState::new(Some(pool)));
    let req = Request::builder()
        .method("POST")
        .uri("/v1/guest/session")
        .header("content-type", "application/json")
        .header("origin", "https://foreign.invalid")
        .header(
            "authorization",
            format!("Bearer {}", token(&Uuid::now_v7().to_string())),
        )
        .header(
            "cookie",
            "__Host-puzzled_guest=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        )
        .body(Body::from("{}"))
        .unwrap();
    let response = app.oneshot(req).await.unwrap();
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
    assert!(response.headers().get("set-cookie").is_none());
}

#[tokio::test]
async fn second_guest_cookie_never_reads_or_adopts_a_public_player_id() {
    use crate::capabilities::identity_access::adapters::guest_credentials;
    let Some(pool) = fresh_database().await else {
        return;
    };
    let app = router(AppState::new(Some(pool.clone())));
    let a_cookie = guest_credentials::issue(&pool).await.unwrap();
    let b_cookie = guest_credentials::issue(&pool).await.unwrap();
    let a_pair = a_cookie.split(';').next().unwrap();
    let b_pair = b_cookie.split(';').next().unwrap();
    let a_hash = guest_credentials::token_hash(a_pair.split_once('=').unwrap().1).unwrap();
    let b_hash = guest_credentials::token_hash(b_pair.split_once('=').unwrap().1).unwrap();
    let a = guest_credentials::lookup_hash(&pool, &a_hash)
        .await
        .unwrap()
        .unwrap();
    let b = guest_credentials::lookup_hash(&pool, &b_hash)
        .await
        .unwrap()
        .unwrap();
    for (player, attempts) in [(a, 7), (b, 2)] {
        sqlx::query("INSERT INTO game_sessions(user_id,game_slug,status,attempts,mode) VALUES($1,'word-guess','won',$2,'daily')")
            .bind(player).bind(attempts).execute(&pool).await.unwrap();
    }
    let (status, body, _) = request(
        &app,
        "/puzzled.v1.StatsService/GetHistory",
        Some(b_pair),
        None,
        Some(&a.to_string()),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let sessions = body["sessions"].as_array().unwrap();
    assert_eq!(sessions.len(), 1);
    assert_eq!(sessions[0]["attempts"], 2);
    let account = Uuid::now_v7();
    sqlx::query("INSERT INTO auth_subjects(subject,user_id) VALUES($1,$2)")
        .bind(format!("principal-{account}"))
        .bind(account)
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(
        request(
            &app,
            "/puzzled.v1.StatsService/GetHistory",
            Some(b_pair),
            Some(&token(&account.to_string())),
            Some(&a.to_string())
        )
        .await
        .0,
        StatusCode::OK
    );
    let a_owner: Uuid = sqlx::query_scalar("SELECT user_id FROM game_sessions WHERE attempts=7")
        .fetch_one(&pool)
        .await
        .unwrap();
    let b_owner: Uuid = sqlx::query_scalar("SELECT user_id FROM game_sessions WHERE attempts=2")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(a_owner, a);
    assert_eq!(b_owner, account);
    assert_eq!(
        guest_credentials::lookup_hash(&pool, &a_hash)
            .await
            .unwrap(),
        Some(a)
    );
    assert_eq!(
        guest_credentials::lookup_hash(&pool, &b_hash)
            .await
            .unwrap(),
        None
    );
    pool.close().await;
}

#[tokio::test]
async fn existing_cookie_parallel_bootstrap_keeps_one_registry_player() {
    use crate::capabilities::identity_access::adapters::guest_credentials;
    let Some(pool) = fresh_database().await else {
        return;
    };
    let cookie = guest_credentials::issue(&pool).await.unwrap();
    let pair = cookie.split(';').next().unwrap();
    let app = router(AppState::new(Some(pool.clone())));
    let (first, second) = tokio::join!(
        request(&app, "/v1/guest/session", Some(pair), None, None),
        request(&app, "/v1/guest/session", Some(pair), None, None),
    );
    assert_eq!(first.0, StatusCode::OK);
    assert_eq!(second.0, StatusCode::OK);
    assert!(first.2.unwrap().contains("Max-Age=34560000"));
    assert!(second.2.unwrap().contains("Max-Age=34560000"));
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM guest_credentials")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 1);
    pool.close().await;
}

#[tokio::test]
async fn legacy_guest_write_and_completion_paths_have_no_player_effects() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let legacy = Uuid::now_v7();
    sqlx::query("INSERT INTO game_sessions(user_id,game_slug,status,attempts,mode) VALUES($1,'word-guess','won',1,'daily')")
        .bind(legacy).execute(&pool).await.unwrap();
    let app = router(AppState::new(Some(pool.clone())));
    let cookie = format!("puzzled_guest_id={legacy}");
    let cases = [
        (
            "/puzzled.v1.PuzzleService/SubmitGuess",
            json!({"gameSlug":"word-guess","status":"won","attempts":1,"submissionJson":"{}"}),
        ),
        (
            "/puzzled.v1.PuzzleService/CheckGuess",
            json!({"gameSlug":"word-guess","guessJson":"{}"}),
        ),
        (
            "/puzzled.v1.PuzzleService/ShareResult",
            json!({"gameSlug":"word-guess","tap":true}),
        ),
    ];
    for (path, body) in cases {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(path)
                    .header("content-type", "application/json")
                    .header("cookie", &cookie)
                    .header("x-puzzled-guest-id", legacy.to_string())
                    .body(Body::from(body.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED, "{path}");
    }
    let rows: Vec<(Uuid, i32)> = sqlx::query_as("SELECT user_id,attempts FROM game_sessions")
        .fetch_all(&pool)
        .await
        .unwrap();
    assert_eq!(rows, [(legacy, 1)]);
    for table in ["result_shares", "user_freeze_data", "guest_credentials"] {
        let statement = format!("SELECT count(*) FROM {table}");
        let count: i64 = sqlx::query_scalar(sqlx::AssertSqlSafe(statement))
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 0, "{table}");
    }
    pool.close().await;
}

#[tokio::test]
async fn bootstrap_is_zero_database_and_unknown_read_does_not_allocate() {
    use crate::capabilities::identity_access::adapters::guest_credentials;
    let app = router(AppState::new(None));
    let (status, body, cookie) = request(&app, "/v1/guest/session", None, None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, json!({"issued":true}));
    let cookie = cookie.unwrap();
    assert!(cookie.contains("Max-Age=34560000"));
    let pair = cookie.split(';').next().unwrap();
    let Some(pool) = fresh_database().await else {
        return;
    };
    let app = router(AppState::new(Some(pool.clone())));
    assert_eq!(
        request(
            &app,
            "/puzzled.v1.StatsService/GetHistory",
            Some(pair),
            None,
            None
        )
        .await
        .0,
        StatusCode::UNAUTHORIZED
    );
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM guest_credentials")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 0);
    let account = Uuid::now_v7();
    assert_eq!(
        request(
            &app,
            "/puzzled.v1.StatsService/GetHistory",
            Some(pair),
            Some(&token(&account.to_string())),
            None
        )
        .await
        .0,
        StatusCode::OK
    );
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM guest_credentials")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 0);
    let _ = guest_credentials::COOKIE;
    pool.close().await;
}

#[tokio::test]
async fn four_concurrent_submits_with_two_connections_do_not_hold_pool_during_content_lookup() {
    use crate::capabilities::identity_access::adapters::guest_credentials;
    let Some(admin_pool) = fresh_database().await else {
        return;
    };
    let options = admin_pool.connect_options();
    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(2)
        .acquire_timeout(std::time::Duration::from_secs(2))
        .connect_with((*options).clone())
        .await
        .unwrap();
    let day = puzzled_core::puzzle_play::daily_time::product_day_key(chrono::Utc::now());
    let slug = "word-guess";
    let puzzle = crate::capabilities::daily_pipeline::resolve(Some(&pool), slug, day, None)
        .await
        .unwrap();
    let submission = json!({"guesses": [puzzle.solution["word"]]}).to_string();
    let cookie = guest_credentials::mint_cookie(None).unwrap();
    let pair = cookie.split(';').next().unwrap().to_string();
    let app = router(AppState::new(Some(pool.clone())));
    let mut tasks = Vec::new();
    for _ in 0..4 {
        let app = app.clone();
        let cookie = pair.clone();
        let submission = submission.clone();
        tasks.push(tokio::spawn(async move {
            let body =
                json!({"gameSlug":slug,"status":"won","attempts":1,"submissionJson":submission});
            let response = app
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/puzzled.v1.PuzzleService/SubmitGuess")
                        .header("content-type", "application/json")
                        .header("cookie", cookie)
                        .body(Body::from(body.to_string()))
                        .unwrap(),
                )
                .await
                .unwrap();
            assert!(matches!(
                response.status(),
                StatusCode::OK | StatusCode::CONFLICT
            ));
        }));
    }
    tokio::time::timeout(std::time::Duration::from_secs(8), async {
        for task in tasks {
            task.await.unwrap();
        }
    })
    .await
    .unwrap();
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM guest_credentials")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 1);
    let hash = guest_credentials::token_hash(pair.split_once('=').unwrap().1).unwrap();
    let guest = guest_credentials::lookup_hash(&pool, &hash)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(guest.get_version_num(), 7);
    let sessions: i64 = sqlx::query_scalar("SELECT count(*) FROM game_sessions")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(sessions, 1);
    pool.close().await;
    admin_pool.close().await;
}

#[tokio::test]
async fn fifty_parallel_first_write_pairs_keep_one_winning_namespace_each() {
    use crate::capabilities::identity_access::adapters::guest_credentials;
    let Some(pool) = fresh_database().await else {
        return;
    };
    let day = puzzled_core::puzzle_play::daily_time::product_day_key(chrono::Utc::now());
    let slug = "word-guess";
    let puzzle = crate::capabilities::daily_pipeline::resolve(Some(&pool), slug, day, None)
        .await
        .unwrap();
    let submission = json!({"guesses": [puzzle.solution["word"]]}).to_string();
    let app = router(AppState::new(Some(pool.clone())));
    async fn submit(app: axum::Router, cookie: String, slug: &'static str, submission: String) {
        let body = json!({"gameSlug":slug,"status":"won","attempts":1,"submissionJson":submission});
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/puzzled.v1.PuzzleService/SubmitGuess")
                    .header("content-type", "application/json")
                    .header("cookie", cookie)
                    .body(Body::from(body.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert!(matches!(
            response.status(),
            StatusCode::OK | StatusCode::CONFLICT
        ));
    }
    for iteration in 0..50 {
        let cookie = guest_credentials::mint_cookie(None).unwrap();
        let pair = cookie.split(';').next().unwrap().to_string();
        let first = tokio::spawn(submit(app.clone(), pair.clone(), slug, submission.clone()));
        let second = tokio::spawn(submit(app.clone(), pair.clone(), slug, submission.clone()));
        tokio::time::timeout(std::time::Duration::from_secs(8), async {
            first.await.unwrap();
            second.await.unwrap();
        })
        .await
        .unwrap();
        let hash = guest_credentials::token_hash(pair.split_once('=').unwrap().1).unwrap();
        let count: i64 =
            sqlx::query_scalar("SELECT count(*) FROM guest_credentials WHERE token_hash=$1")
                .bind(hash)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(count, 1, "iteration {iteration}");
    }
    let count: i64 = sqlx::query_scalar("SELECT count(DISTINCT user_id) FROM guest_credentials")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 50);
    let sessions: i64 = sqlx::query_scalar("SELECT count(*) FROM game_sessions")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(sessions, 50);
    pool.close().await;
}

#[tokio::test]
async fn account_erasure_includes_retained_adopted_guest_collisions_and_provenance() {
    use crate::capabilities::identity_access::adapters::guest_credentials;
    use crate::capabilities::preferences::adapters::account_deletion::{
        delete_account_data, USER_KEYED_COLUMNS,
    };
    let Some(pool) = fresh_database().await else {
        return;
    };
    let cookie = guest_credentials::issue(&pool).await.unwrap();
    let pair = cookie.split(';').next().unwrap();
    let hash = guest_credentials::token_hash(pair.split_once('=').unwrap().1).unwrap();
    let guest = guest_credentials::lookup_hash(&pool, &hash)
        .await
        .unwrap()
        .unwrap();
    let account = Uuid::now_v7();
    sqlx::query("INSERT INTO auth_subjects(subject,user_id) VALUES($1,$2)")
        .bind(format!("principal-{account}"))
        .bind(account)
        .execute(&pool)
        .await
        .unwrap();
    for owner in [guest, account] {
        sqlx::query("INSERT INTO game_sessions(user_id,game_slug,status,attempts,mode,is_ritual,day_key) VALUES($1,'word-guess','won',1,'daily',true,'2026-09-30')")
            .bind(owner).execute(&pool).await.unwrap();
        sqlx::query("INSERT INTO result_shares(id,user_id,game_slug,day_key,status,attempts) VALUES($1,$2,'word-guess','2026-09-30','won',1)")
            .bind(Uuid::now_v7()).bind(owner).execute(&pool).await.unwrap();
        sqlx::query("INSERT INTO user_freeze_data(user_id,freezes_available) VALUES($1,1)")
            .bind(owner)
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO streak_freeze_awards(user_id,day_key,granted) VALUES($1,'2026-09-29',true)")
            .bind(owner).execute(&pool).await.unwrap();
    }
    sqlx::query("INSERT INTO game_sessions(user_id,game_slug,status,attempts,mode,is_ritual,day_key) VALUES($1,'word-guess','won',1,'daily',true,'2026-09-29')")
        .bind(guest).execute(&pool).await.unwrap();
    let app = router(AppState::new(Some(pool.clone())));
    assert_eq!(
        request(
            &app,
            "/puzzled.v1.StatsService/GetHistory",
            Some(pair),
            Some(&token(&account.to_string())),
            None
        )
        .await
        .0,
        StatusCode::OK
    );
    let retained: i64 = sqlx::query_scalar("SELECT count(*) FROM game_sessions WHERE user_id=$1")
        .bind(guest)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(retained, 1);
    delete_account_data(&pool, &account.to_string())
        .await
        .unwrap();
    for (table, column, _) in USER_KEYED_COLUMNS {
        let statement = format!("SELECT count(*) FROM \"{table}\" WHERE \"{column}\" IN ($1,$2)");
        let remaining: i64 = sqlx::query_scalar(sqlx::AssertSqlSafe(statement))
            .bind(account)
            .bind(guest)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(remaining, 0, "{table}.{column}");
    }
    pool.close().await;
}

#[tokio::test]
async fn raced_adoption_and_erasure_preserve_only_unclaimed_guest_or_erase_linked_sources() {
    use crate::capabilities::identity_access::adapters::guest_credentials;
    use crate::capabilities::preferences::adapters::account_deletion::delete_account_data;
    use crate::capabilities::puzzle_play::adapters::game_sessions_db::{
        adopt_guest_sessions, adopt_guest_sessions_on_connection,
    };
    let Some(pool) = fresh_database().await else {
        return;
    };
    for adoption_first in [true, false] {
        let cookie = guest_credentials::issue(&pool).await.unwrap();
        let raw = cookie.split(';').next().unwrap().split_once('=').unwrap().1;
        let hash = guest_credentials::token_hash(raw).unwrap();
        let guest = guest_credentials::lookup_hash(&pool, &hash)
            .await
            .unwrap()
            .unwrap();
        let account = Uuid::now_v7();
        sqlx::query("INSERT INTO auth_subjects(subject,user_id) VALUES($1,$2)")
            .bind(format!("principal-{account}"))
            .bind(account)
            .execute(&pool)
            .await
            .unwrap();
        for owner in [account, guest] {
            sqlx::query("INSERT INTO game_sessions(user_id,game_slug,status,attempts,mode,is_ritual,day_key) VALUES($1,'word-guess','won',1,'daily',true,'2026-09-30')")
                .bind(owner).execute(&pool).await.unwrap();
        }
        let identity = crate::VerifiedIdentity {
            user_id: account.to_string(),
            display_name: None,
            email: None,
            is_admin: false,
            actor: None,
        };
        let mut tx = pool.begin().await.unwrap();
        if adoption_first {
            sqlx::query(
                "SELECT pg_advisory_xact_lock(hashtextextended('puzzled:guest-token:' || $1, 0))",
            )
            .bind(&hash)
            .execute(&mut *tx)
            .await
            .unwrap();
            adopt_guest_sessions_on_connection(
                &mut tx,
                &identity,
                &format!("guest_{guest}"),
                &hash,
            )
            .await
            .unwrap();
            let erasure_pool = pool.clone();
            let erase = tokio::spawn(async move {
                delete_account_data(&erasure_pool, &account.to_string()).await
            });
            tokio::time::timeout(std::time::Duration::from_secs(2),async {
                loop {
                    let blocked: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND NOT granted AND database=(SELECT oid FROM pg_database WHERE datname=current_database()))")
                        .fetch_one(&pool).await.unwrap();
                    if blocked { break; }
                    tokio::task::yield_now().await;
                }
            }).await.unwrap();
            tx.commit().await.unwrap();
            tokio::time::timeout(std::time::Duration::from_secs(3), erase)
                .await
                .unwrap()
                .unwrap()
                .unwrap();
        } else {
            guest_credentials::lock_players(&mut tx, vec![account])
                .await
                .unwrap();
            let adoption_pool = pool.clone();
            let adopt = tokio::spawn(async move {
                adopt_guest_sessions(&adoption_pool, &identity, &format!("guest_{guest}"), &hash)
                    .await
            });
            sqlx::query("DELETE FROM auth_subjects WHERE user_id=$1")
                .bind(account)
                .execute(&mut *tx)
                .await
                .unwrap();
            sqlx::query("DELETE FROM game_sessions WHERE user_id=$1")
                .bind(account)
                .execute(&mut *tx)
                .await
                .unwrap();
            tx.commit().await.unwrap();
            assert!(
                tokio::time::timeout(std::time::Duration::from_secs(3), adopt)
                    .await
                    .unwrap()
                    .unwrap()
                    .is_err()
            );
        }
        let account_rows: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM game_sessions WHERE user_id=$1 OR adopted_from_guest=$1",
        )
        .bind(account)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(account_rows, 0);
        let source_rows: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM game_sessions WHERE user_id=$1 OR adopted_from_guest=$1",
        )
        .bind(guest)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(source_rows, if adoption_first { 0 } else { 1 });
        let linked: i64 =
            sqlx::query_scalar("SELECT count(*) FROM guest_credentials WHERE adopted_user_id=$1")
                .bind(account)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(linked, 0);
    }
    pool.close().await;
}

async fn puzzle_request(
    app: &axum::Router,
    method: &str,
    cookie: &str,
    bearer: Option<&str>,
    body: Value,
) -> (StatusCode, Value) {
    let mut request = Request::builder()
        .method("POST")
        .uri(format!("/puzzled.v1.PuzzleService/{method}"))
        .header("content-type", "application/json")
        .header("cookie", cookie);
    if let Some(bearer) = bearer {
        request = request.header("authorization", format!("Bearer {bearer}"));
    }
    let response = app
        .clone()
        .oneshot(request.body(Body::from(body.to_string())).unwrap())
        .await
        .unwrap();
    let status = response.status();
    let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    (status, serde_json::from_slice(&bytes).unwrap())
}

#[tokio::test]
async fn unregistered_guess_budget_uses_hash_without_allocating_player() {
    use crate::capabilities::identity_access::adapters::guest_credentials;
    let Some(pool) = fresh_database().await else {
        return;
    };
    let day = puzzled_core::puzzle_play::daily_time::product_day_key(chrono::Utc::now());
    crate::capabilities::daily_pipeline::resolve(Some(&pool), "word-guess", day, None)
        .await
        .unwrap();
    let cookie = guest_credentials::mint_cookie(None).unwrap();
    let pair = cookie.split(';').next().unwrap();
    let app = router(AppState::new(Some(pool.clone())));
    for attempt in 0..7 {
        let (status, _) = puzzle_request(
            &app,
            "CheckGuess",
            pair,
            None,
            json!({"gameSlug":"word-guess","guessJson":"{\"word\":\"crane\"}"}),
        )
        .await;
        assert_eq!(
            status,
            if attempt < 6 {
                StatusCode::OK
            } else {
                StatusCode::TOO_MANY_REQUESTS
            }
        );
    }
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM guest_credentials")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 0);
    pool.close().await;
}

#[tokio::test]
async fn invalid_submit_rolls_back_allocation_and_adoption_until_valid_finish() {
    use crate::capabilities::identity_access::adapters::guest_credentials;
    let Some(pool) = fresh_database().await else {
        return;
    };
    let day = puzzled_core::puzzle_play::daily_time::product_day_key(chrono::Utc::now());
    let puzzle = crate::capabilities::daily_pipeline::resolve(Some(&pool), "word-guess", day, None)
        .await
        .unwrap();
    let valid = json!({"gameSlug":"word-guess","status":"won","attempts":1,
        "submissionJson":json!({"guesses":[puzzle.solution["word"]]}).to_string()});
    let invalid =
        json!({"gameSlug":"word-guess","status":"won","attempts":1,"submissionJson":"{}"});
    let app = router(AppState::new(Some(pool.clone())));
    let cookie = guest_credentials::mint_cookie(None).unwrap();
    let pair = cookie.split(';').next().unwrap();
    let (status, body) = puzzle_request(&app, "SubmitGuess", pair, None, invalid.clone()).await;
    assert_eq!(status, StatusCode::OK);
    assert_ne!(body["valid"], true); // proto3 JSON omits false
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM guest_credentials")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 0);
    let (status, body) = puzzle_request(&app, "SubmitGuess", pair, None, valid.clone()).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["valid"], true);
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM guest_credentials")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 1);
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM game_sessions")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 1);

    let cookie = guest_credentials::issue(&pool).await.unwrap();
    let pair = cookie.split(';').next().unwrap();
    let hash = guest_credentials::token_hash(pair.split_once('=').unwrap().1).unwrap();
    let guest = guest_credentials::lookup_hash(&pool, &hash)
        .await
        .unwrap()
        .unwrap();
    let account = Uuid::now_v7();
    sqlx::query("INSERT INTO auth_subjects(subject,user_id) VALUES($1,$2)")
        .bind(format!("principal-{account}"))
        .bind(account)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO game_sessions(user_id,game_slug,status,attempts,mode,is_ritual,day_key) VALUES($1,'word-guess','won',1,'daily',true,'2026-09-01')")
        .bind(guest).execute(&pool).await.unwrap();
    let bearer = token(&account.to_string());
    let (_, body) = puzzle_request(&app, "SubmitGuess", pair, Some(&bearer), invalid).await;
    assert_ne!(body["valid"], true); // proto3 JSON omits false
    let live: bool = sqlx::query_scalar("SELECT revoked_at IS NULL AND adopted_user_id IS NULL FROM guest_credentials WHERE token_hash=$1")
        .bind(&hash).fetch_one(&pool).await.unwrap();
    assert!(live);
    let (_, body) = puzzle_request(&app, "SubmitGuess", pair, Some(&bearer), valid).await;
    assert_eq!(body["valid"], true);
    let adopted: Option<Uuid> =
        sqlx::query_scalar("SELECT adopted_user_id FROM guest_credentials WHERE token_hash=$1")
            .bind(&hash)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(adopted, Some(account));
    pool.close().await;
}

async fn bootstrap(
    app: &axum::Router,
    origin: &str,
    cookie: Option<&str>,
    body: Value,
) -> (StatusCode, Value, Vec<String>) {
    let mut req = Request::builder()
        .method("POST")
        .uri("/v1/guest/session")
        .header("content-type", "application/json")
        .header("origin", origin);
    if let Some(cookie) = cookie {
        req = req.header("cookie", cookie);
    }
    let response = app
        .clone()
        .oneshot(req.body(Body::from(body.to_string())).unwrap())
        .await
        .unwrap();
    let status = response.status();
    let cookies = response
        .headers()
        .get_all("set-cookie")
        .iter()
        .map(|v| v.to_str().unwrap().to_string())
        .collect();
    let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    (
        status,
        serde_json::from_slice(&bytes).unwrap_or(json!(null)),
        cookies,
    )
}

const ORIGIN: &str = "https://puzzled.gg";

async fn seed_legacy_progress(pool: &sqlx::PgPool, legacy: Uuid) {
    for day in ["2026-09-01", "2026-09-02"] {
        sqlx::query("INSERT INTO game_sessions(user_id,game_slug,status,attempts,mode,is_ritual,day_key) VALUES($1,'word-guess','won',2,'daily',true,$2::date)")
            .bind(legacy).bind(day).execute(pool).await.unwrap();
    }
    sqlx::query("INSERT INTO streak_freeze_uses(user_id,day_key) VALUES($1,'2026-09-03')")
        .bind(legacy)
        .execute(pool)
        .await
        .unwrap();
}

async fn rows_for(pool: &sqlx::PgPool, player: Uuid) -> (i64, i64) {
    let sessions = sqlx::query_scalar("SELECT count(*) FROM game_sessions WHERE user_id=$1")
        .bind(player)
        .fetch_one(pool)
        .await
        .unwrap();
    let freezes = sqlx::query_scalar("SELECT count(*) FROM streak_freeze_uses WHERE user_id=$1")
        .bind(player)
        .fetch_one(pool)
        .await
        .unwrap();
    (sessions, freezes)
}

fn token_of(cookies: &[String]) -> String {
    cookies
        .iter()
        .find(|c| c.starts_with("__Host-puzzled_guest="))
        .unwrap()
        .split(';')
        .next()
        .unwrap()
        .to_string()
}

async fn player_of(pool: &sqlx::PgPool, pair: &str) -> Option<Uuid> {
    use crate::capabilities::identity_access::adapters::guest_credentials as g;
    let hash = g::token_hash(pair.split_once('=').unwrap().1).unwrap();
    g::lookup_hash(pool, &hash).await.unwrap()
}

#[tokio::test]
async fn legacy_claim_keeps_streak_and_history_and_leaves_nothing_under_legacy() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let legacy = Uuid::now_v7();
    seed_legacy_progress(&pool, legacy).await;
    let app = router(AppState::new(Some(pool.clone())));
    let cookie = format!("puzzled_guest_id={legacy}");
    let (status, body, cookies) = bootstrap(&app, ORIGIN, Some(&cookie), json!({})).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["claimed"], true);
    assert!(cookies
        .iter()
        .any(|c| c == "puzzled_guest_id=; Path=/; Max-Age=0"));
    let fresh = player_of(&pool, &token_of(&cookies)).await.unwrap();
    assert_ne!(fresh, legacy);
    assert_eq!(rows_for(&pool, fresh).await, (2, 1));
    assert_eq!(rows_for(&pool, legacy).await, (0, 0));
    let from: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM game_sessions WHERE user_id=$1 AND adopted_from_guest=$2",
    )
    .bind(fresh)
    .bind(legacy)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(from, 2);
    // The body field carries the id too, and the history reads through the new cookie.
    let (status, history, _) = request(
        &app,
        "/puzzled.v1.StatsService/GetHistory",
        Some(&token_of(&cookies)),
        None,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{history}");
    pool.close().await;
}

#[tokio::test]
async fn replaying_the_legacy_id_with_another_token_claims_nothing() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let legacy = Uuid::now_v7();
    seed_legacy_progress(&pool, legacy).await;
    let app = router(AppState::new(Some(pool.clone())));
    let (_, first, first_cookies) =
        bootstrap(&app, ORIGIN, None, json!({"legacyGuestId": legacy})).await;
    assert_eq!(first["claimed"], true);
    let first_player = player_of(&pool, &token_of(&first_cookies)).await.unwrap();
    let (status, second, second_cookies) =
        bootstrap(&app, ORIGIN, None, json!({"legacyGuestId": legacy})).await;
    assert_eq!(status, StatusCode::OK);
    assert_ne!(second["claimed"], true);
    assert!(!second_cookies
        .iter()
        .any(|c| c.starts_with("puzzled_guest_id=")));
    assert!(player_of(&pool, &token_of(&second_cookies)).await.is_none());
    assert_eq!(rows_for(&pool, first_player).await, (2, 1));
    pool.close().await;
}

#[tokio::test]
async fn account_backed_or_registered_legacy_id_is_refused() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let app = router(AppState::new(Some(pool.clone())));
    let account = Uuid::now_v7();
    sqlx::query("INSERT INTO auth_subjects(subject,user_id) VALUES($1,$2)")
        .bind(format!("principal-{account}"))
        .bind(account)
        .execute(&pool)
        .await
        .unwrap();
    seed_legacy_progress(&pool, account).await;
    let (status, body, _) = bootstrap(&app, ORIGIN, None, json!({"legacyGuestId": account})).await;
    assert_eq!((status, &body["claimed"]), (StatusCode::OK, &json!(null)));
    assert_eq!(rows_for(&pool, account).await, (2, 1));

    use crate::capabilities::identity_access::adapters::guest_credentials as g;
    let registered_cookie = g::issue(&pool).await.unwrap();
    let registered = player_of(&pool, registered_cookie.split(';').next().unwrap())
        .await
        .unwrap();
    seed_legacy_progress(&pool, registered).await;
    let (_, body, cookies) =
        bootstrap(&app, ORIGIN, None, json!({"legacyGuestId": registered})).await;
    assert_ne!(body["claimed"], true);
    assert!(player_of(&pool, &token_of(&cookies)).await.is_none());
    assert_eq!(rows_for(&pool, registered).await, (2, 1));
    pool.close().await;
}

#[tokio::test]
async fn two_concurrent_legacy_claims_have_exactly_one_winner() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let legacy = Uuid::now_v7();
    seed_legacy_progress(&pool, legacy).await;
    let app = router(AppState::new(Some(pool.clone())));
    let run = || {
        let app = app.clone();
        async move { bootstrap(&app, ORIGIN, None, json!({"legacyGuestId": legacy})).await }
    };
    let (a, b) = tokio::join!(run(), run());
    let wins = [&a, &b].iter().filter(|r| r.1["claimed"] == true).count();
    assert_eq!(wins, 1);
    let registered: i64 = sqlx::query_scalar("SELECT count(*) FROM guest_credentials")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(registered, 1);
    assert_eq!(rows_for(&pool, legacy).await, (0, 0));
    let total: i64 = sqlx::query_scalar("SELECT count(*) FROM game_sessions")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(total, 2);
    pool.close().await;
}

#[tokio::test]
async fn wrong_origin_legacy_claim_is_forbidden_without_database_effect() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let legacy = Uuid::now_v7();
    seed_legacy_progress(&pool, legacy).await;
    let app = router(AppState::new(Some(pool.clone())));
    let (status, _, cookies) = bootstrap(
        &app,
        "https://elsewhere.invalid",
        None,
        json!({"legacyGuestId": legacy}),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert!(cookies.is_empty());
    assert_eq!(rows_for(&pool, legacy).await, (2, 1));
    let registered: i64 = sqlx::query_scalar("SELECT count(*) FROM guest_credentials")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(registered, 0);
    pool.close().await;
}

#[tokio::test]
async fn signed_in_player_with_legacy_id_ends_with_history_on_the_account() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let day = puzzled_core::puzzle_play::daily_time::product_day_key(chrono::Utc::now());
    let puzzle = crate::capabilities::daily_pipeline::resolve(Some(&pool), "word-guess", day, None)
        .await
        .unwrap();
    let valid = json!({"gameSlug":"word-guess","status":"won","attempts":1,
        "submissionJson":json!({"guesses":[puzzle.solution["word"]]}).to_string()});
    let legacy = Uuid::now_v7();
    seed_legacy_progress(&pool, legacy).await;
    let account = Uuid::now_v7();
    sqlx::query("INSERT INTO auth_subjects(subject,user_id) VALUES($1,$2)")
        .bind(format!("principal-{account}"))
        .bind(account)
        .execute(&pool)
        .await
        .unwrap();
    let app = router(AppState::new(Some(pool.clone())));
    let (_, body, cookies) = bootstrap(&app, ORIGIN, None, json!({"legacyGuestId": legacy})).await;
    assert_eq!(body["claimed"], true);
    let pair = token_of(&cookies);
    let bearer = token(&account.to_string());
    let (_, body) = puzzle_request(&app, "SubmitGuess", &pair, Some(&bearer), valid).await;
    assert_eq!(body["valid"], true);
    assert_eq!(rows_for(&pool, legacy).await, (0, 0));
    let (sessions, freezes) = rows_for(&pool, account).await;
    assert!(sessions >= 2 && freezes == 1, "{sessions} {freezes}");
    pool.close().await;
}
