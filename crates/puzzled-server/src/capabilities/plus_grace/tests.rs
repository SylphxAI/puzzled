//! Plus grace: argument rules, eligibility on a real migrated Postgres, the
//! dry run's id-free output, and grant idempotency against a fake Money.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::{DateTime, TimeZone, Utc};
use serde_json::{json, Value};
use uuid::Uuid;

use super::*;
use crate::capabilities::money::grants::valid_grant_id;

fn args(list: &[&str]) -> Vec<String> {
    list.iter().map(|s| (*s).to_string()).collect()
}

fn at(raw: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(raw)
        .unwrap()
        .with_timezone(&Utc)
}

fn campaign() -> Campaign {
    parse(
        &args(&[
            "--apply",
            "--cutoff",
            "2026-10-05T00:00:00Z",
            "--approver",
            "CEO 2026-10-02",
        ]),
        Utc::now(),
    )
    .unwrap()
    .campaign
}

#[test]
fn apply_needs_a_cutoff_and_an_approver() {
    let now = at("2026-10-02T12:00:00Z");
    assert!(parse(&args(&["--apply", "--approver", "CEO"]), now)
        .unwrap_err()
        .contains("--cutoff"));
    assert!(
        parse(&args(&["--apply", "--cutoff", "2026-10-05T00:00:00Z"]), now)
            .unwrap_err()
            .contains("--approver")
    );
    assert!(parse(&args(&["--dry-run", "--apply"]), now).is_err());
    assert!(parse(&args(&[]), now).is_err());
    assert!(parse(&args(&["--dry-run", "--days", "0"]), now).is_err());
    assert!(parse(&args(&["--dry-run", "--exclude-player", "nope"]), now).is_err());
    let dry = parse(&args(&["--dry-run"]), now).unwrap();
    assert_eq!(dry.mode, Mode::DryRun);
    assert_eq!(dry.campaign.cutoff, now);
}

#[test]
fn a_campaign_is_named_by_its_cutoff_and_ends_thirty_days_later() {
    let c = campaign();
    assert_eq!(c.id(), "plus-grace-20261005");
    assert_eq!(c.expires, at("2026-11-04T00:00:00Z"));
    let account = Uuid::parse_str("0190a0a0-0000-7000-8000-000000000001").unwrap();
    let grant = c.grant(account);
    assert!(valid_grant_id(&grant.id), "{}", grant.id);
    assert_eq!(
        grant.id,
        c.grant(account).id,
        "a re-run names the same grant"
    );
    assert_eq!(grant.end_user, account.to_string());
    assert_eq!(grant.feature, "plus");
    assert_eq!(grant.approver, "CEO 2026-10-02");
    let body = grant.body();
    assert_eq!(body["subject"]["end_user"], account.to_string());
    assert_eq!(body["expire_time"], "2026-11-04T00:00:00Z");
    assert_eq!(body["source"], "operator_grants/plus-grace-20261005");
}

// ---------------------------------------------------------------- fake Money

#[derive(Default)]
struct FakeMoney {
    /// Serve `POST entitlement_grants` at all (Money does not today).
    serves_create: bool,
    /// Answer 503 once this many grants exist.
    outage_after: Option<usize>,
    /// Answer 404 to every GET, as a replica that has not seen a write yet.
    hide_from_get: bool,
    grants: HashMap<String, Value>,
    posts: usize,
    idempotency_keys: Vec<String>,
}

type Fake = Arc<Mutex<FakeMoney>>;

async fn get_grant(State(fake): State<Fake>, Path(id): Path<String>) -> (StatusCode, Json<Value>) {
    let fake = fake.lock().unwrap();
    match fake.grants.get(&id).filter(|_| !fake.hide_from_get) {
        Some(grant) => (StatusCode::OK, Json(grant.clone())),
        None => (
            StatusCode::NOT_FOUND,
            Json(json!({"code": "RESOURCE_NOT_FOUND"})),
        ),
    }
}

async fn create_grant(
    State(fake): State<Fake>,
    Query(query): Query<HashMap<String, String>>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> (StatusCode, Json<Value>) {
    let mut fake = fake.lock().unwrap();
    fake.posts += 1;
    if !fake.serves_create {
        return (StatusCode::NOT_FOUND, Json(json!({"code": "NOT_FOUND"})));
    }
    if fake.outage_after.is_some_and(|n| fake.grants.len() >= n) {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({"code": "UNAVAILABLE"})),
        );
    }
    let id = query
        .get("entitlement_grant_id")
        .cloned()
        .unwrap_or_default();
    if let Some(key) = headers.get("idempotency-key").and_then(|v| v.to_str().ok()) {
        fake.idempotency_keys.push(key.to_string());
    }
    if fake.grants.contains_key(&id) {
        return (
            StatusCode::CONFLICT,
            Json(json!({"code": "RESOURCE_ALREADY_EXISTS"})),
        );
    }
    fake.grants.insert(id, body.clone());
    (StatusCode::OK, Json(body))
}

async fn fake_money(fake: FakeMoney) -> (Money, Fake) {
    let fake: Fake = Arc::new(Mutex::new(fake));
    let app = Router::new()
        .route("/env/entitlement_grants/{id}", get(get_grant))
        .route("/env/entitlement_grants", post(create_grant))
        .with_state(fake.clone());
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    (
        Money::new(
            &format!("http://{addr}/env"),
            "sk_test",
            "https://puzzled.test",
        ),
        fake,
    )
}

fn accounts(n: u128) -> Vec<Uuid> {
    (1..=n)
        .map(|i| Uuid::from_u128(0x0190_a0a0_0000_7000_8000_0000_0000_0000 + i))
        .collect()
}

#[tokio::test]
async fn a_rerun_grants_nothing_twice() {
    let (money, fake) = fake_money(FakeMoney {
        serves_create: true,
        ..Default::default()
    })
    .await;
    let c = campaign();
    let list = accounts(3);

    let first = apply_grants(&money, &c, &list).await;
    assert_eq!(
        first,
        ApplyReport {
            granted: 3,
            ..Default::default()
        }
    );
    let second = apply_grants(&money, &c, &list).await;
    assert_eq!(
        second,
        ApplyReport {
            already_granted: 3,
            ..Default::default()
        }
    );

    let fake = fake.lock().unwrap();
    assert_eq!(fake.posts, 3, "the re-run wrote nothing");
    assert_eq!(fake.grants.len(), 3);
    for account in &list {
        let grant = c.grant(*account);
        assert_eq!(fake.grants[&grant.id], grant.body());
        assert!(fake.idempotency_keys.contains(&grant.id));
    }
}

#[tokio::test]
async fn a_grant_already_created_under_the_id_is_counted_not_repeated() {
    // Money answered 409 on create (a concurrent run won the race).
    let (money, fake) = fake_money(FakeMoney {
        serves_create: true,
        ..Default::default()
    })
    .await;
    let c = campaign();
    let list = accounts(1);
    let grant = c.grant(list[0]);
    let report = apply_grants(&money, &c, &list).await;
    assert_eq!(report.granted, 1);
    // GET misses it, so the second call reaches POST and gets 409.
    fake.lock().unwrap().hide_from_get = true;
    assert_eq!(
        money.ensure_operator_grant(&grant).await,
        Ok(GrantOutcome::AlreadyHeld)
    );
    assert_eq!(fake.lock().unwrap().posts, 2);
    assert_eq!(fake.lock().unwrap().grants.len(), 1);
}

#[tokio::test]
async fn a_grant_id_naming_another_account_stops_the_run() {
    let (money, fake) = fake_money(FakeMoney {
        serves_create: true,
        ..Default::default()
    })
    .await;
    let c = campaign();
    let list = accounts(2);
    let other = c.grant(list[1]).body();
    fake.lock()
        .unwrap()
        .grants
        .insert(c.grant(list[0]).id, other);
    let report = apply_grants(&money, &c, &list).await;
    assert_eq!(report.granted, 0);
    assert_eq!(report.not_attempted, 2);
    assert!(report
        .stopped_on
        .unwrap()
        .contains("grant_id_names_another_grant"));
}

#[tokio::test]
async fn money_without_a_create_api_fails_closed_on_the_first_grant() {
    let (money, fake) = fake_money(FakeMoney::default()).await;
    let c = campaign();
    let report = apply_grants(&money, &c, &accounts(5)).await;
    assert_eq!(report.granted, 0);
    assert_eq!(report.not_attempted, 5);
    let why = report.stopped_on.unwrap();
    assert!(why.starts_with("money_grant_create_not_served"), "{why}");
    assert_eq!(
        fake.lock().unwrap().posts,
        1,
        "stopped at the first refusal"
    );
}

#[tokio::test]
async fn a_money_outage_stops_the_run_and_a_rerun_resumes() {
    let (money, fake) = fake_money(FakeMoney {
        serves_create: true,
        outage_after: Some(2),
        ..Default::default()
    })
    .await;
    let c = campaign();
    let list = accounts(5);
    let report = apply_grants(&money, &c, &list).await;
    assert_eq!(report.granted, 2);
    assert_eq!(report.not_attempted, 3);
    assert!(report.stopped_on.is_some());

    fake.lock().unwrap().outage_after = None;
    let resumed = apply_grants(&money, &c, &list).await;
    assert_eq!(
        resumed,
        ApplyReport {
            granted: 3,
            already_granted: 2,
            ..Default::default()
        }
    );
}

#[tokio::test]
async fn an_unreachable_money_never_names_the_account() {
    // Nothing listens on port 9: the transport error carries the request URL.
    let money = Money::new("http://127.0.0.1:9/env", "sk_test", "https://puzzled.test");
    let c = campaign();
    let list = accounts(1);
    let report = apply_grants(&money, &c, &list).await;
    let why = report.stopped_on.unwrap();
    assert!(why.contains("money unavailable"), "{why}");
    assert!(!why.contains(&list[0].simple().to_string()), "{why}");
    assert!(!why.contains(&list[0].to_string()), "{why}");
}

// ------------------------------------------------------------- database

fn naive(raw: &str) -> chrono::NaiveDateTime {
    at(raw).naive_utc()
}

async fn finish(pool: &PgPool, player: Uuid, status: &str, completed: Option<&str>, day: &str) {
    sqlx::query(
        "INSERT INTO game_sessions (user_id, game_slug, status, started_at, completed_at, day_key) \
         VALUES ($1, 'sudoku', $2::game_status, $3, $4, $5)",
    )
    .bind(player)
    .bind(status)
    .bind(naive(&format!("{day}T08:00:00Z")))
    .bind(completed.map(naive))
    .bind(day)
    .execute(pool)
    .await
    .unwrap();
}

async fn account(pool: &PgPool, player: Uuid, subject: &str) {
    sqlx::query("INSERT INTO auth_subjects (subject, user_id) VALUES ($1, $2)")
        .bind(subject)
        .bind(player)
        .execute(pool)
        .await
        .unwrap();
}

#[tokio::test]
async fn eligibility_counts_real_play_and_the_dry_run_prints_no_ids() {
    let Some(pool) = crate::test_support::fresh_database().await else {
        return;
    };
    let id = |n: u128| Uuid::from_u128(0x0190_b0b0_0000_7000_8000_0000_0000_0000 + n);
    let (two_days, adopted, in_progress, after_cutoff, qa, excluded, abandoned) =
        (id(1), id(2), id(3), id(4), id(5), id(6), id(7));
    let (guest_cred, guest_legacy, one_day) = (id(8), id(9), id(10));

    // An account that finished on two days before the cutoff.
    account(&pool, two_days, "usr_twodays").await;
    finish(
        &pool,
        two_days,
        "won",
        Some("2026-10-01T09:00:00Z"),
        "2026-10-01",
    )
    .await;
    finish(
        &pool,
        two_days,
        "lost",
        Some("2026-10-02T09:00:00Z"),
        "2026-10-02",
    )
    .await;
    // An account whose finish came from an adopted guest.
    account(&pool, adopted, "usr_adopted").await;
    finish(
        &pool,
        adopted,
        "won",
        Some("2026-10-03T09:00:00Z"),
        "2026-10-03",
    )
    .await;
    sqlx::query("UPDATE game_sessions SET adopted_from_guest = $2 WHERE user_id = $1")
        .bind(adopted)
        .bind(id(99))
        .execute(&pool)
        .await
        .unwrap();
    // An account with one finished day (below --min-days 2 later).
    account(&pool, one_day, "usr_oneday").await;
    finish(
        &pool,
        one_day,
        "won",
        Some("2026-10-04T09:00:00Z"),
        "2026-10-04",
    )
    .await;
    // No history: only started, only after the cutoff, only abandoned.
    account(&pool, in_progress, "usr_inprogress").await;
    finish(&pool, in_progress, "in_progress", None, "2026-10-01").await;
    account(&pool, after_cutoff, "usr_after").await;
    finish(
        &pool,
        after_cutoff,
        "won",
        Some("2026-10-06T09:00:00Z"),
        "2026-10-06",
    )
    .await;
    account(&pool, abandoned, "usr_abandoned").await;
    finish(
        &pool,
        abandoned,
        "abandoned",
        Some("2026-10-01T09:00:00Z"),
        "2026-10-01",
    )
    .await;
    // Synthetic: a QA email, and an Auth subject the operator excludes.
    account(&pool, qa, "usr_qa").await;
    sqlx::query("INSERT INTO user_display_cache (user_id, email) VALUES ($1, 'QA-Inbox+puzzled@sylphx.com')")
        .bind(qa)
        .execute(&pool)
        .await
        .unwrap();
    finish(&pool, qa, "won", Some("2026-10-01T09:00:00Z"), "2026-10-01").await;
    account(&pool, excluded, "usr_synthetic_readback").await;
    finish(
        &pool,
        excluded,
        "won",
        Some("2026-10-01T09:00:00Z"),
        "2026-10-01",
    )
    .await;
    // Guests: one with a live server-issued credential, one legacy.
    sqlx::query("INSERT INTO guest_credentials (token_hash, user_id, provenance) VALUES ('h1', $1, 'server_issued')")
        .bind(guest_cred)
        .execute(&pool)
        .await
        .unwrap();
    finish(
        &pool,
        guest_cred,
        "lost",
        Some("2026-10-01T09:00:00Z"),
        "2026-10-01",
    )
    .await;
    finish(
        &pool,
        guest_legacy,
        "won",
        Some("2026-10-02T09:00:00Z"),
        "2026-10-02",
    )
    .await;

    let command = parse(
        &args(&[
            "--dry-run",
            "--cutoff",
            "2026-10-05T00:00:00Z",
            "--exclude-subject",
            "usr_synthetic_readback",
        ]),
        Utc::now(),
    )
    .unwrap();
    let found = eligibility(&pool, &command.campaign).await.unwrap();
    let mut expected = vec![two_days, adopted, one_day];
    expected.sort();
    assert_eq!(found.accounts, expected);
    assert_eq!(found.counts.players_with_history, 7);
    assert_eq!(found.counts.excluded_synthetic, 2);
    assert_eq!(found.counts.below_min_days, 0);
    assert_eq!(found.counts.eligible_accounts, 3);
    assert_eq!(found.counts.eligible_accounts_by_days["1"], 2);
    assert_eq!(found.counts.eligible_accounts_by_days["2-6"], 1);
    assert_eq!(found.counts.eligible_guests_credentialed, 1);
    assert_eq!(found.counts.eligible_guests_legacy, 1);

    let mut stricter = command.clone();
    stricter.campaign.min_days = 2;
    let strict = eligibility(&pool, &stricter.campaign).await.unwrap();
    assert_eq!(strict.accounts, vec![two_days]);
    assert_eq!(strict.counts.below_min_days, 4);

    // The dry run: one line of counts, and no id, subject or email anywhere.
    let mut out = Vec::new();
    let code = run(&command, &pool, None, &mut out).await;
    assert_eq!(code, exit::OK);
    let printed = String::from_utf8(out).unwrap();
    assert_eq!(printed.lines().count(), 1, "{printed}");
    let line: Value = serde_json::from_str(printed.trim()).unwrap();
    assert_eq!(line["mode"], "dry_run");
    assert_eq!(line["eligible_accounts"], 3);
    assert_eq!(line["excluded_synthetic"], 2);
    assert_eq!(line["eligible_guests_credentialed"], 1);
    assert_eq!(line["eligible_guests_legacy"], 1);
    for n in 1..=10 {
        let player = id(n);
        assert!(!printed.contains(&player.to_string()), "{printed}");
        assert!(!printed.contains(&player.simple().to_string()), "{printed}");
    }
    assert!(!printed.to_lowercase().contains("usr_"), "{printed}");
    assert!(!printed.to_lowercase().contains("qa-inbox"), "{printed}");
    assert!(!printed.contains('@'), "{printed}");

    // An apply without a Money key refuses before reading anything.
    let apply = parse(
        &args(&[
            "--apply",
            "--cutoff",
            "2026-10-05T00:00:00Z",
            "--approver",
            "CEO 2026-10-02",
        ]),
        Utc::now(),
    )
    .unwrap();
    let mut out = Vec::new();
    assert_eq!(run(&apply, &pool, None, &mut out).await, exit::CONFIG);
}

#[tokio::test]
async fn apply_end_to_end_grants_eligible_accounts_once() {
    let Some(pool) = crate::test_support::fresh_database().await else {
        return;
    };
    let player = Uuid::from_u128(0x0190_c0c0_0000_7000_8000_0000_0000_0001);
    account(&pool, player, "usr_e2e").await;
    finish(
        &pool,
        player,
        "won",
        Some("2026-10-01T09:00:00Z"),
        "2026-10-01",
    )
    .await;
    let (money, fake) = fake_money(FakeMoney {
        serves_create: true,
        ..Default::default()
    })
    .await;
    let apply = parse(
        &args(&[
            "--apply",
            "--cutoff",
            "2026-10-05T00:00:00Z",
            "--approver",
            "CEO 2026-10-02",
        ]),
        Utc.with_ymd_and_hms(2026, 10, 5, 0, 0, 0).unwrap(),
    )
    .unwrap();
    for (round, (granted, already)) in [(1, 0), (0, 1)].into_iter().enumerate() {
        let mut out = Vec::new();
        assert_eq!(run(&apply, &pool, Some(&money), &mut out).await, exit::OK);
        let printed = String::from_utf8(out).unwrap();
        let line: Value = serde_json::from_str(printed.trim()).unwrap();
        assert_eq!(
            line["apply"]["granted"], granted,
            "round {round}: {printed}"
        );
        assert_eq!(line["apply"]["already_granted"], already, "round {round}");
        assert!(!printed.contains(&player.simple().to_string()));
        assert!(!printed.contains(&player.to_string()));
    }
    assert_eq!(fake.lock().unwrap().posts, 1);

    // Money without the create API: exit code MONEY, nothing granted.
    let (unserved, _) = fake_money(FakeMoney::default()).await;
    let mut out = Vec::new();
    assert_eq!(
        run(&apply, &pool, Some(&unserved), &mut out).await,
        exit::MONEY
    );
    let line: Value = serde_json::from_slice(&out).unwrap();
    assert_eq!(line["apply"]["granted"], 0);
    assert_eq!(line["apply"]["not_attempted"], 1);
}
