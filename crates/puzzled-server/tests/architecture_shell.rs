//! Shell architecture proofs for ADR-169.

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

fn walk_files(dir: &Path) -> Vec<PathBuf> {
    let mut out = Vec::new();
    let entries = fs::read_dir(dir).unwrap_or_else(|e| panic!("read_dir {}: {e}", dir.display()));
    for entry in entries {
        let entry = entry.unwrap_or_else(|e| panic!("dir entry: {e}"));
        let path = entry.path();
        if path.is_dir() {
            out.extend(walk_files(&path));
        } else {
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
        "admin/adapters/admin_db.rs",
        "gamification/interfaces/gamification_api.rs",
        "identity_access/adapters/platform_jwt.rs",
        "identity_access/contract.rs",
        "leaderboard/adapters/leaderboard_db.rs",
        "preferences/adapters/preferences_db.rs",
        "puzzle_play/adapters/daily_puzzles_db.rs",
        "puzzle_play/adapters/game_sessions_db.rs",
        "stats/adapters/sessions_stats_db.rs",
    ] {
        let path = root.join(rel);
        assert!(path.is_file(), "missing shell module {}", path.display());
    }
}

#[test]
fn router_registers_rust_api_prefixes() {
    let router = fs::read_to_string(manifest_dir().join("src/bootstrap/router.rs"))
        .unwrap_or_else(|e| panic!("read router: {e}"));
    for route in ["/healthz", "/readyz"] {
        assert!(router.contains(route), "router missing {route}");
    }
    // Sole surface: Connect services only — no hand-rolled REST routes remain.
    assert!(!router.contains("/api/v1"), "REST surface must be deleted");
    for service in [
        "admin_connect_service",
        "gamification_connect_service",
        "preferences_connect_service",
        "puzzle_connect_service",
        "stats_connect_service",
    ] {
        assert!(router.contains(service), "router missing {service}");
    }
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
fn jobs_executor_is_sole_rust() {
    // The web residual executor is deleted (ADR-170): the webhook route must
    // not exist and the api service must register JobsService.
    let webhook = manifest_dir().join("../../apps/puzzled/src/app/api/webhooks/platform-jobs/route.ts");
    assert!(
        !webhook.exists(),
        "web residual webhook must be deleted; JobsService is the sole executor"
    );
    let router = fs::read_to_string(manifest_dir().join("src/bootstrap/router.rs"))
        .unwrap_or_else(|e| panic!("read router: {e}"));
    assert!(router.contains("jobs_connect_service"), "JobsService must be mounted");
    let proto = manifest_dir().join("../../proto/puzzled/v1/jobs.proto");
    assert!(proto.is_file(), "jobs.proto must exist");
}

#[test]
fn retired_web_server_directory_cannot_reintroduce_executable_backend_source() {
    // This directory contained unmounted legacy TypeScript only. Keeping it
    // executable would recreate the false-authority trap this cutover removes.
    let root = manifest_dir().join("../../apps/puzzled/src/server");
    let executable_extensions = ["ts", "tsx", "js", "jsx", "mts", "cts", "mjs", "cjs"];
    let offenders = walk_files(&root)
        .into_iter()
        .filter(|path| {
            path.extension()
                .and_then(|extension| extension.to_str())
                .is_some_and(|extension| executable_extensions.contains(&extension))
        })
        .map(|path| path.display().to_string())
        .collect::<Vec<_>>();

    assert!(
        offenders.is_empty(),
        "retired web-server archive must not regain executable source:\n{}",
        offenders.join("\n")
    );
}
