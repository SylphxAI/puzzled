//! Shell architecture proofs for ADR-169 / ADR-170 terminal ownership.

use std::fs;
use std::path::{Path, PathBuf};

fn manifest_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

fn walk_rs(dir: &Path) -> Vec<PathBuf> {
    let mut out = Vec::new();
    let entries = fs::read_dir(dir).unwrap_or_else(|e| panic!("read_dir {}: {e}", dir.display()));
    for entry in entries {
        let entry = entry.unwrap_or_else(|e| panic!("dir entry: {e}"));
        let path = entry.path();
        if path.is_dir() {
            out.extend(walk_rs(&path));
        } else if path.extension().and_then(|s| s.to_str()) == Some("rs") {
            out.push(path);
        }
    }
    out
}

#[test]
fn shell_depends_on_puzzled_core() {
    let toml = fs::read_to_string(manifest_dir().join("Cargo.toml"))
        .unwrap_or_else(|e| panic!("read cargo: {e}"));
    assert!(toml.contains("puzzled-core"));
}

#[test]
fn shell_capability_tree_exists() {
    let root = manifest_dir().join("src/capabilities");
    for rel in [
        "puzzle_play/interfaces/games_api.rs",
        "puzzle_play/adapters/game_sessions_db.rs",
        "identity_access/adapters/platform_jwt.rs",
        "identity_access/contract.rs",
        "identity_access/interfaces/auth_sessions.rs",
        "leaderboard/adapters/leaderboard_db.rs",
        "leaderboard/interfaces/leaderboard.rs",
        "preferences/interfaces/prefs_api.rs",
        "gamification/interfaces/gamification_api.rs",
        "stats/interfaces/stats_api.rs",
        "generation_jobs/interfaces/generation_jobs.rs",
    ] {
        let path = root.join(rel);
        assert!(path.is_file(), "missing shell module {}", path.display());
    }
}

#[test]
fn sql_adapters_exist_for_persisting_capabilities() {
    let root = manifest_dir().join("src/capabilities");
    for rel in [
        "puzzle_play/adapters/game_sessions_db.rs",
        "preferences/adapters/preferences_db.rs",
        "gamification/adapters/freezes_db.rs",
        "leaderboard/adapters/leaderboard_db.rs",
        "identity_access/adapters/platform_jwt.rs",
    ] {
        assert!(root.join(rel).is_file(), "missing adapter {rel}");
    }
}

#[test]
fn router_registers_rust_product_api_only() {
    let router = fs::read_to_string(manifest_dir().join("src/bootstrap/router.rs"))
        .unwrap_or_else(|e| panic!("read router: {e}"));
    for route in [
        "/healthz",
        "/readyz",
        "/api/leaderboard",
        "/api/v1",
        "/api/v1/jobs/plan",
        "/api/v1/jobs/execute",
    ] {
        assert!(router.contains(route), "router missing {route}");
    }
    assert!(
        !router.contains("/api/webhooks/platform-jobs"),
        "Rust router must not expose platform-jobs webhook (ADR-170 terminal web ownership)"
    );
}

#[test]
fn cross_capability_auth_goes_through_identity_contract() {
    let src = manifest_dir().join("src/capabilities");
    let mut offenders = Vec::new();
    for path in walk_rs(&src) {
        if path.ends_with("auth_sessions.rs")
            || path.ends_with("platform_jwt.rs")
            || path.ends_with("contract.rs")
        {
            continue;
        }
        let text =
            fs::read_to_string(&path).unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
        if text.contains("identity_access::interfaces::auth_sessions")
            || text.contains("identity_access::adapters::platform_jwt")
        {
            offenders.push(path.display().to_string());
        }
    }
    assert!(
        offenders.is_empty(),
        "capabilities must use identity_access::contract, not private internals:\n{}",
        offenders.join("\n")
    );
}

#[test]
fn terminal_web_job_worker_is_sole_webhook_authority() {
    let route =
        manifest_dir().join("../../apps/puzzled/src/app/api/webhooks/platform-jobs/route.ts");
    let text =
        fs::read_to_string(&route).unwrap_or_else(|e| panic!("read {}: {e}", route.display()));
    assert!(
        text.contains("executeJob") && text.contains("web-platform-job-worker"),
        "terminal webhook must execute JOB_HANDLERS under web-platform-job-worker authority"
    );
    assert!(
        !text.contains("status: 410"),
        "terminal webhook must not be 410"
    );

    let manifest = fs::read_to_string(manifest_dir().join("../../sylphx.toml"))
        .unwrap_or_else(|e| panic!("read sylphx.toml: {e}"));
    let prefixes = manifest
        .split("path_prefixes")
        .nth(1)
        .and_then(|s| s.split(']').next())
        .unwrap_or("");
    assert!(
        !prefixes.contains("/api/webhooks/platform-jobs"),
        "api path_prefixes must not steal terminal web job webhook"
    );
}

#[test]
fn dual_legacy_job_http_entries_are_gone() {
    let root = manifest_dir().join("../../apps/puzzled/src/app/api");
    for rel in [
        "cron/generate-daily-puzzles/route.ts",
        "cron/dlq-retry/route.ts",
        "cron/daily-reminder/route.ts",
        "cron/streak-at-risk/route.ts",
        "cron/win-back-emails/route.ts",
        "jobs/generate-puzzles/route.ts",
        "jobs/dlq-retry/route.ts",
    ] {
        let path = root.join(rel);
        let text =
            fs::read_to_string(&path).unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
        assert!(
            text.contains("status: 410") && text.contains("ADR-170"),
            "{} must be ADR-170 410 retirement",
            path.display()
        );
        assert!(
            !text.contains("executeJob(") && !text.contains("generateGamePuzzle"),
            "{} must not still execute job I/O",
            path.display()
        );
    }
}
