//! Architecture boundary proofs for ADR-169 / engineering-standard.

use std::fs;
use std::path::{Path, PathBuf};

fn manifest_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

fn read(path: &str) -> String {
    let full = manifest_dir().join(path);
    fs::read_to_string(&full).unwrap_or_else(|e| panic!("read {}: {e}", full.display()))
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
fn core_cargo_forbids_shell_dependencies() {
    let toml = read("Cargo.toml");
    for forbidden in [
        "axum",
        "sqlx",
        "reqwest",
        "tokio",
        "jsonwebtoken",
        "tracing-subscriber",
    ] {
        assert!(
            !toml.contains(forbidden),
            "puzzled-core must not depend on shell crate `{forbidden}`"
        );
    }
    // FCIS: no wall-clock feature in functional core.
    assert!(
        !toml.contains("\"clock\""),
        "puzzled-core chrono must not enable the clock feature"
    );
}

#[test]
fn capability_modules_have_domain_layer() {
    let root = manifest_dir().join("src/capabilities");
    for cap in [
        "puzzle_play",
        "identity_policy",
        "leaderboard",
        "gamification",
        "product_policy",
        "privacy",
        "presentation_policy",
        "jobs_policy",
        "billing_access",
    ] {
        let domain = root.join(cap).join("domain").join("mod.rs");
        assert!(domain.is_file(), "missing domain layer {}", domain.display());
    }
    assert!(
        root.join("puzzle_play/application/mod.rs").is_file(),
        "puzzle_play must expose application flows"
    );
}

#[test]
fn core_source_tree_has_no_shell_framework_imports() {
    let src = manifest_dir().join("src");
    let mut offenders = Vec::new();
    for entry in walk_rs(&src) {
        let text = fs::read_to_string(&entry).unwrap_or_else(|e| panic!("read {}: {e}", entry.display()));
        for needle in ["use axum", "use sqlx", "use reqwest", "use tokio::", "std::env::"] {
            if text.contains(needle) {
                offenders.push(format!("{} contains `{needle}`", entry.display()));
            }
        }
        if text.contains("Utc::now()") {
            offenders.push(format!("{} uses Utc::now wall clock", entry.display()));
        }
    }
    assert!(
        offenders.is_empty(),
        "functional core imported shell frameworks or clocks:\n{}",
        offenders.join("\n")
    );
}

#[test]
fn stable_sudoku_contract_surface_still_exported() {
    let _ = puzzled_core::generate_sudoku_puzzle;
    let _ = puzzled_core::validate_and_score_sudoku;
    let _ = puzzled_core::seeded_random;
}
