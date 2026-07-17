//! Product generation-job orchestration (dens path for `puzzle-generation-jobs`).
//!
//! Ports job registry + seed/date planning from
//! `apps/puzzled/src/lib/jobs/handlers.ts` and
//! `apps/puzzled/src/lib/jobs/handlers/generate-puzzles.ts` / registry seed helpers.
//! LLM generators and DB writes remain TS/FE-side; this is the backend plan +
//! seed-game dispatch product path.

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use puzzled_core::{generate_sudoku_puzzle, SudokuDifficulty};
use serde::{Deserialize, Serialize};
use serde_json::json;

/// Known platform cron / job names (parity: JOB_HANDLERS keys).
pub const JOB_GENERATE_DAILY_PUZZLES: &str = "generate-daily-puzzles";
pub const JOB_DLQ_RETRY: &str = "dlq-retry";
pub const JOB_DAILY_REMINDER: &str = "daily-reminder";
pub const JOB_STREAK_AT_RISK: &str = "streak-at-risk";
pub const JOB_WIN_BACK_EMAILS: &str = "win-back-emails";

/// Seed-based games densed in Rust (generators backend product slice).
pub const RUST_SEED_GAMES: &[&str] = &["sudoku"];

/// Games that still require LLM pre-generation (FE-TS residual).
pub const LLM_GAMES: &[&str] = &["word-groups", "crossword", "cryptogram"];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GenerationStrategy {
    Seed,
    Llm,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PuzzleDifficulty {
    Easy,
    Medium,
    Hard,
}

impl PuzzleDifficulty {
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Easy => "easy",
            Self::Medium => "medium",
            Self::Hard => "hard",
        }
    }

    #[must_use]
    pub fn parse(raw: &str) -> Option<Self> {
        match raw.to_ascii_lowercase().as_str() {
            "easy" => Some(Self::Easy),
            "medium" => Some(Self::Medium),
            "hard" => Some(Self::Hard),
            _ => None,
        }
    }

    /// Seed offset for difficulty (parity: puzzle service difficultyOffset).
    #[must_use]
    pub fn seed_offset(self) -> i64 {
        match self {
            Self::Easy => 0,
            Self::Medium => 1,
            Self::Hard => 2,
        }
    }

    #[must_use]
    pub fn all() -> [Self; 3] {
        [Self::Easy, Self::Medium, Self::Hard]
    }
}

/// UTC seed from calendar date: YYYYMMDD integer (parity: getSeedFromDate).
#[must_use]
pub fn get_seed_from_date(year: i32, month: u32, day: u32) -> i64 {
    i64::from(year) * 10_000 + i64::from(month) * 100 + i64::from(day)
}

/// Parse `YYYY-MM-DD` into (year, month, day).
///
/// # Errors
///
/// Returns error string when format is invalid.
pub fn parse_date_yyyy_mm_dd(date: &str) -> Result<(i32, u32, u32), String> {
    let parts: Vec<&str> = date.split('-').collect();
    if parts.len() != 3 {
        return Err(format!("invalid date: {date}"));
    }
    let year: i32 = parts[0]
        .parse()
        .map_err(|_| format!("invalid year in date: {date}"))?;
    let month: u32 = parts[1]
        .parse()
        .map_err(|_| format!("invalid month in date: {date}"))?;
    let day: u32 = parts[2]
        .parse()
        .map_err(|_| format!("invalid day in date: {date}"))?;
    if !(1..=12).contains(&month) || !(1..=31).contains(&day) {
        return Err(format!("out-of-range date: {date}"));
    }
    Ok((year, month, day))
}

/// One planned generation unit for the batch job.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationUnit {
    pub game_slug: String,
    pub strategy: GenerationStrategy,
    pub seed: i64,
    pub difficulty: Option<PuzzleDifficulty>,
    pub supports_difficulty: bool,
}

/// Full plan for a target date.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationPlan {
    pub date: String,
    pub base_seed: i64,
    pub units: Vec<GenerationUnit>,
}

/// Build generation plan for known seed + LLM game inventory.
///
/// Seed games that support difficulty expand to easy/medium/hard (sudoku).
/// LLM games are listed with strategy=Llm and no seed materialization.
#[must_use]
pub fn plan_daily_generation(date: &str, base_seed: i64) -> GenerationPlan {
    let mut units = Vec::new();

    for slug in RUST_SEED_GAMES {
        // sudoku supports difficulty
        for diff in PuzzleDifficulty::all() {
            units.push(GenerationUnit {
                game_slug: (*slug).to_string(),
                strategy: GenerationStrategy::Seed,
                seed: base_seed + diff.seed_offset(),
                difficulty: Some(diff),
                supports_difficulty: true,
            });
        }
    }

    for slug in LLM_GAMES {
        units.push(GenerationUnit {
            game_slug: (*slug).to_string(),
            strategy: GenerationStrategy::Llm,
            seed: base_seed,
            difficulty: None,
            supports_difficulty: false,
        });
    }

    GenerationPlan {
        date: date.to_string(),
        base_seed,
        units,
    }
}

/// Whether a job name is registered (parity: JOB_HANDLERS lookup).
#[must_use]
pub fn is_known_job(cron_name: &str) -> bool {
    matches!(
        cron_name,
        JOB_GENERATE_DAILY_PUZZLES
            | JOB_DLQ_RETRY
            | JOB_DAILY_REMINDER
            | JOB_STREAK_AT_RISK
            | JOB_WIN_BACK_EMAILS
    )
}

/// Result of executing a registered job in the Rust product path.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobResult {
    pub success: bool,
    pub job: String,
    pub data: serde_json::Value,
    pub error: Option<String>,
}

fn sudoku_difficulty(d: PuzzleDifficulty) -> SudokuDifficulty {
    match d {
        PuzzleDifficulty::Easy => SudokuDifficulty::Easy,
        PuzzleDifficulty::Medium => SudokuDifficulty::Medium,
        PuzzleDifficulty::Hard => SudokuDifficulty::Hard,
    }
}

/// Execute seed-based generation units that Rust owns (sudoku). LLM units are reported
/// as deferred (remain TS workflow).
#[must_use]
pub fn execute_generate_daily_puzzles(plan: &GenerationPlan) -> JobResult {
    let mut generated = Vec::new();
    let mut deferred = Vec::new();
    let mut failed = Vec::new();

    for unit in &plan.units {
        match unit.strategy {
            GenerationStrategy::Llm => {
                deferred.push(json!({
                    "gameSlug": unit.game_slug,
                    "strategy": "llm",
                    "reason": "LLM generator remains TS workflow",
                }));
            }
            GenerationStrategy::Seed => {
                if unit.game_slug == "sudoku" {
                    let diff = unit.difficulty.unwrap_or(PuzzleDifficulty::Medium);
                    let result = generate_sudoku_puzzle(unit.seed, sudoku_difficulty(diff));
                    generated.push(json!({
                        "gameSlug": unit.game_slug,
                        "seed": unit.seed,
                        "difficulty": diff.as_str(),
                        "strategy": "seed",
                        "puzzleData": result.puzzle_data,
                        "solution": result.solution,
                    }));
                } else {
                    failed.push(json!({
                        "gameSlug": unit.game_slug,
                        "error": "seed generator is not available in Rust yet",
                    }));
                }
            }
        }
    }

    let success = failed.is_empty();
    JobResult {
        success,
        job: JOB_GENERATE_DAILY_PUZZLES.to_string(),
        data: json!({
            "date": plan.date,
            "baseSeed": plan.base_seed,
            "generated": generated,
            "deferredLlm": deferred,
            "failed": failed,
            "slice": "puzzle-generation-jobs",
        }),
        error: if success {
            None
        } else {
            Some(format!("{} seed units failed", failed.len()))
        },
    }
}

/// Dispatch a known job by name (product registry).
#[must_use]
pub fn execute_job(cron_name: &str, target_date: Option<&str>) -> JobResult {
    if !is_known_job(cron_name) {
        return JobResult {
            success: false,
            job: cron_name.to_string(),
            data: json!(null),
            error: Some(format!("Unknown job: {cron_name}")),
        };
    }

    match cron_name {
        JOB_GENERATE_DAILY_PUZZLES => {
            let date = target_date.unwrap_or("1970-01-01");
            let (y, m, d) = match parse_date_yyyy_mm_dd(date) {
                Ok(v) => v,
                Err(e) => {
                    return JobResult {
                        success: false,
                        job: cron_name.to_string(),
                        data: json!(null),
                        error: Some(e),
                    };
                }
            };
            let seed = get_seed_from_date(y, m, d);
            let plan = plan_daily_generation(date, seed);
            execute_generate_daily_puzzles(&plan)
        }
        // Notification / DLQ handlers densed as acknowledged stubs (I/O stays Platform/TS).
        JOB_DLQ_RETRY | JOB_DAILY_REMINDER | JOB_STREAK_AT_RISK | JOB_WIN_BACK_EMAILS => {
            JobResult {
                success: true,
                job: cron_name.to_string(),
                data: json!({
                    "acknowledged": true,
                    "execution": "rust-product-envelope",
                    "io": "deferred-to-platform-or-ts",
                    "slice": "puzzle-generation-jobs",
                }),
                error: None,
            }
        }
        _ => JobResult {
            success: false,
            job: cron_name.to_string(),
            data: json!(null),
            error: Some(format!("Unknown job: {cron_name}")),
        },
    }
}

// ── HTTP ────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanGenerationBody {
    /// Target date YYYY-MM-DD (UTC).
    pub date: String,
}

pub async fn plan_generation_http(Json(body): Json<PlanGenerationBody>) -> Response {
    match parse_date_yyyy_mm_dd(&body.date) {
        Ok((y, m, d)) => {
            let seed = get_seed_from_date(y, m, d);
            let plan = plan_daily_generation(&body.date, seed);
            (StatusCode::OK, Json(json!({ "plan": plan, "slice": "puzzle-generation-jobs" }))).into_response()
        }
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": e, "slice": "puzzle-generation-jobs" })),
        )
            .into_response(),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteJobBody {
    pub job: String,
    pub date: Option<String>,
}

pub async fn execute_job_http(Json(body): Json<ExecuteJobBody>) -> Response {
    let result = execute_job(&body.job, body.date.as_deref());
    let status = if result.success {
        StatusCode::OK
    } else if result.error.as_deref().is_some_and(|e| e.starts_with("Unknown job")) {
        StatusCode::NOT_FOUND
    } else {
        StatusCode::BAD_REQUEST
    };
    (status, Json(result)).into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seed_from_date_parity() {
        assert_eq!(get_seed_from_date(2024, 12, 25), 2024_1225);
        assert_eq!(get_seed_from_date(2025, 1, 1), 2025_0101);
        assert_eq!(get_seed_from_date(2024, 1, 5), 2024_0105);
    }

    #[test]
    fn difficulty_offsets() {
        assert_eq!(PuzzleDifficulty::Easy.seed_offset(), 0);
        assert_eq!(PuzzleDifficulty::Medium.seed_offset(), 1);
        assert_eq!(PuzzleDifficulty::Hard.seed_offset(), 2);
    }

    #[test]
    fn plan_expands_sudoku_difficulties_and_lists_llm() {
        let plan = plan_daily_generation("2024-12-25", 2024_1225);
        assert_eq!(plan.base_seed, 2024_1225);
        let sudoku: Vec<_> = plan
            .units
            .iter()
            .filter(|u| u.game_slug == "sudoku")
            .collect();
        assert_eq!(sudoku.len(), 3);
        assert_eq!(sudoku[0].seed, 2024_1225);
        assert_eq!(sudoku[1].seed, 2024_1226);
        assert_eq!(sudoku[2].seed, 2024_1227);
        assert!(plan
            .units
            .iter()
            .any(|u| u.game_slug == "word-groups" && u.strategy == GenerationStrategy::Llm));
    }

    #[test]
    fn execute_generate_produces_sudoku() {
        let plan = plan_daily_generation("2024-12-25", 2024_1225);
        let result = execute_generate_daily_puzzles(&plan);
        assert!(result.success);
        let generated = result.data["generated"].as_array().expect("arr");
        assert_eq!(generated.len(), 3);
        let deferred = result.data["deferredLlm"].as_array().expect("llm");
        assert_eq!(deferred.len(), LLM_GAMES.len());
    }

    #[test]
    fn unknown_job_fails() {
        let r = execute_job("not-a-job", None);
        assert!(!r.success);
        assert!(r.error.as_deref().unwrap_or("").contains("Unknown job"));
    }

    #[test]
    fn known_jobs_registered() {
        assert!(is_known_job(JOB_GENERATE_DAILY_PUZZLES));
        assert!(is_known_job(JOB_DLQ_RETRY));
        assert!(!is_known_job("nope"));
    }
}
