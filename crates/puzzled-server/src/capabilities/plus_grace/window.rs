//! WORKAROUND(plus-grace-window): the launch grace as a time-boxed play-gate
//! rule, because Sylphx Money does not yet serve entitlement grant creation,
//! so the `plus-grace` job cannot record the CEO-approved grants (CEO ruling
//! 2026-10-02, registered in docs/monetization.md#launch-grace-grants).
//!
//! An account with real play history before `PUZZLED_PLUS_GRACE_OPEN_AT`
//! (RFC 3339) plays as Plus until that instant plus `PUZZLED_PLUS_GRACE_DAYS`.
//! Both values are configuration, not code: unset, invalid, before the open
//! instant or from the end on, the rule grants nothing. History is decided by
//! the job's own definition ([`super::standing_of`]); guests never reach it
//! (the gate passes only a signed-in account).
//!
//! Removal trigger: Money serves `POST entitlement_grants` and
//! `plus-grace --apply` has run for the same open instant; then delete this
//! module, its gate block and the two variables.
//!
//! Cost: one indexed read per account, then none. A "has history" answer is
//! kept for the life of the process (history before a past instant only
//! grows, when a guest's earlier sessions are adopted); a "no history" answer
//! is kept [`NEGATIVE_TTL`], so an adoption is noticed within that time.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use super::{standing_of, Criteria, Standing};

pub const OPEN_AT_VAR: &str = "PUZZLED_PLUS_GRACE_OPEN_AT";
pub const DAYS_VAR: &str = "PUZZLED_PLUS_GRACE_DAYS";
/// Comma-separated Auth subjects excluded as synthetic or QA, as the job's
/// `--exclude-subject`.
pub const EXCLUDE_VAR: &str = "PUZZLED_PLUS_GRACE_EXCLUDE_SUBJECTS";
/// How long a "no history" answer is reused.
pub const NEGATIVE_TTL: Duration = Duration::from_secs(600);
/// The cache is dropped whole beyond this many accounts (bounded memory).
const CACHE_CAP: usize = 200_000;

#[derive(Debug)]
pub struct GraceWindow {
    open_at: DateTime<Utc>,
    ends_at: DateTime<Utc>,
    exclude_subjects: Vec<String>,
    /// account -> (qualifies, answered at).
    cache: Mutex<HashMap<Uuid, (bool, Instant)>>,
    /// Database reads made, for tests and logs.
    reads: AtomicU64,
}

impl GraceWindow {
    #[must_use]
    pub fn new(open_at: DateTime<Utc>, days: i64, exclude_subjects: Vec<String>) -> Self {
        Self {
            open_at,
            ends_at: open_at + chrono::Duration::days(days),
            exclude_subjects,
            cache: Mutex::default(),
            reads: AtomicU64::new(0),
        }
    }

    /// The window from the environment; None (off) unless both values are
    /// set and valid.
    #[must_use]
    pub fn from_env() -> Option<Self> {
        Self::from_lookup(|name| std::env::var(name).ok())
    }

    pub fn from_lookup(get: impl Fn(&str) -> Option<String>) -> Option<Self> {
        let value = |name: &str| {
            get(name)
                .map(|v| v.trim().to_string())
                .filter(|v| !v.is_empty())
        };
        let (open, days) = (value(OPEN_AT_VAR), value(DAYS_VAR));
        if open.is_none() && days.is_none() {
            return None;
        }
        let open_at = open
            .as_deref()
            .and_then(|raw| DateTime::parse_from_rfc3339(raw).ok())
            .map(|t| t.with_timezone(&Utc));
        let days = days
            .and_then(|raw| raw.parse::<i64>().ok())
            .filter(|d| (1..=366).contains(d));
        let (Some(open_at), Some(days)) = (open_at, days) else {
            tracing::warn!(
                event = "plus_grace_window_misconfigured",
                "{OPEN_AT_VAR} must be RFC 3339 and {DAYS_VAR} 1 to 366; the grace window is off"
            );
            return None;
        };
        let exclude = value(EXCLUDE_VAR)
            .map(|raw| {
                raw.split(',')
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
                    .map(str::to_string)
                    .collect()
            })
            .unwrap_or_default();
        let window = Self::new(open_at, days, exclude);
        tracing::info!(
            event = "plus_grace_window_configured",
            open_at = %window.open_at,
            ends_at = %window.ends_at,
            "WORKAROUND plus-grace-window configured"
        );
        Some(window)
    }

    #[must_use]
    pub fn ends_at(&self) -> DateTime<Utc> {
        self.ends_at
    }

    /// The window grants anything at `now`: from the open instant, up to but
    /// not including its end.
    #[must_use]
    pub fn active_at(&self, now: DateTime<Utc>) -> bool {
        self.open_at <= now && now < self.ends_at
    }

    #[must_use]
    pub fn reads(&self) -> u64 {
        self.reads.load(Ordering::Relaxed)
    }

    fn cached(&self, account: Uuid) -> Option<bool> {
        let cache = self.cache.lock().ok()?;
        match cache.get(&account) {
            Some((true, _)) => Some(true),
            Some((false, at)) if at.elapsed() < NEGATIVE_TTL => Some(false),
            _ => None,
        }
    }

    fn remember(&self, account: Uuid, qualifies: bool) {
        if let Ok(mut cache) = self.cache.lock() {
            if cache.len() >= CACHE_CAP {
                cache.clear();
            }
            cache.insert(account, (qualifies, Instant::now()));
        }
    }

    /// Does the window give `user_id` Plus play at `now`? A read that fails
    /// answers no (the gate's usual answer stands) and is not remembered.
    pub async fn allows(&self, pool: &PgPool, user_id: &str, now: DateTime<Utc>) -> bool {
        if !self.active_at(now) {
            return false;
        }
        let Ok(account) = Uuid::parse_str(user_id) else {
            return false;
        };
        if let Some(answer) = self.cached(account) {
            return answer;
        }
        self.reads.fetch_add(1, Ordering::Relaxed);
        let criteria = Criteria {
            cutoff: self.open_at,
            min_days: 1,
            exclude_subjects: &self.exclude_subjects,
            exclude_players: &[],
        };
        let standing = match pool.acquire().await {
            Ok(mut connection) => standing_of(&mut connection, &criteria, account).await,
            Err(error) => Err(error),
        };
        match standing {
            Ok(standing) => {
                let qualifies = standing == Some(Standing::Account);
                if qualifies {
                    tracing::info!(
                        event = "plus_grace_window_admitted",
                        "WORKAROUND plus-grace-window: an account with history plays as Plus"
                    );
                }
                self.remember(account, qualifies);
                qualifies
            }
            Err(error) => {
                tracing::warn!(%error, "plus grace window read failed; not granted");
                false
            }
        }
    }
}
