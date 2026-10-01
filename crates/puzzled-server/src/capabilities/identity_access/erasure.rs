//! One durable erasure operation owner (extends #303). No user session is
//! persisted or needed by the signed retry dispatcher. Preparation is fail
//! closed until Money publishes its owned erasure-preparation contract.

use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use super::adapters::auth_erasure::AuthErasure;
use crate::capabilities::money::Money;

const PAGE_SIZE: i64 = 4;
const LEASE_SECONDS: i64 = 120;

#[derive(Clone, Serialize, Deserialize)]
struct Subject {
    principal_id: String,
    idempotency_key: String,
    request_id: Option<String>,
    state: Option<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Failure {
    DatabaseUnavailable,
    MoneyUnavailable,
    MoneyPreflightUnavailable,
    CancelSubscriptionFirst,
    ErasureUnconfigured,
    SubjectLookupFailed,
    AuthDeleteFailed,
    AuthReceiptUnconfirmed,
    AuthRequestPending,
    AuthRequestFailed,
    AuthRequestMissing,
    ProductDeleteFailed,
    LeaseLost,
    InstanceChanged,
}

impl Failure {
    pub fn stage(self) -> &'static str {
        match self {
            Self::DatabaseUnavailable => "database_unavailable",
            Self::MoneyUnavailable => "money_unavailable",
            Self::MoneyPreflightUnavailable => "money_preflight_unavailable",
            Self::CancelSubscriptionFirst => "cancel_subscription_first",
            Self::ErasureUnconfigured => "erasure_unconfigured",
            Self::SubjectLookupFailed => "subject_lookup_failed",
            Self::AuthDeleteFailed => "auth_delete_failed",
            Self::AuthReceiptUnconfirmed => "auth_receipt_unconfirmed",
            Self::AuthRequestPending => "auth_request_pending",
            Self::AuthRequestFailed => "auth_request_failed",
            Self::AuthRequestMissing => "auth_request_missing",
            Self::ProductDeleteFailed => "product_delete_failed",
            Self::LeaseLost => "lease_lost",
            Self::InstanceChanged => "instance_changed",
        }
    }
}

#[derive(Clone)]
pub struct Status {
    pub request_id: Uuid,
    pub state: String,
    pub rows_deleted: u64,
}

/// Caller holds this transaction across checkout/resume side-effect admission.
/// Lock and fresh suppression SELECT are intentionally separate SQL statements.
pub async fn admitted_transaction(
    pool: &PgPool,
    player: Uuid,
) -> Result<sqlx::Transaction<'_, sqlx::Postgres>, Failure> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|_| Failure::DatabaseUnavailable)?;
    sqlx::query("SELECT puzzled_erasure_lock($1)")
        .bind(player)
        .execute(&mut *tx)
        .await
        .map_err(|_| Failure::DatabaseUnavailable)?;
    let suppressed: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM erasure_requests WHERE suppression_hash=puzzled_erasure_player_hash($1))")
        .bind(player).fetch_one(&mut *tx).await.map_err(|_| Failure::DatabaseUnavailable)?;
    if suppressed {
        return Err(Failure::AuthRequestPending);
    }
    Ok(tx)
}

/// Old renewing-subscription guard is before the new fence and every Auth
/// effect. Duplicate owned requests replay the same snapshot and operation.
pub async fn request(
    pool: &PgPool,
    auth: Option<&AuthErasure>,
    money: Option<&Money>,
    player: Uuid,
) -> Result<Status, Failure> {
    let auth = auth.ok_or(Failure::ErasureUnconfigured)?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|_| Failure::DatabaseUnavailable)?;
    sqlx::query("SELECT puzzled_erasure_lock($1)")
        .bind(player)
        .execute(&mut *tx)
        .await
        .map_err(|_| Failure::DatabaseUnavailable)?;
    let existing = sqlx::query("SELECT request_id,state,organization_id,evidence FROM erasure_requests WHERE suppression_hash=puzzled_erasure_player_hash($1)")
        .bind(player).fetch_optional(&mut *tx).await.map_err(|_| Failure::DatabaseUnavailable)?;
    if let Some(row) = existing {
        let state: String = row.get("state");
        let organization: Option<String> = row.get("organization_id");
        if state != "completed" && organization.as_deref() != Some(auth.organization_id()) {
            return Err(Failure::InstanceChanged);
        }
        let evidence: serde_json::Value = row.get("evidence");
        return Ok(Status {
            request_id: row.get("request_id"),
            state,
            rows_deleted: evidence
                .as_object()
                .map(|counts| counts.values().filter_map(serde_json::Value::as_u64).sum())
                .unwrap_or(0),
        });
    }
    if let Some(money) = money {
        match money.has_renewing_subscription(&player.to_string()).await {
            Ok(true) => return Err(Failure::CancelSubscriptionFirst),
            Err(_) => return Err(Failure::MoneyUnavailable),
            Ok(false) => {}
        }
    }
    let mut names: Vec<String> =
        sqlx::query_scalar("SELECT subject FROM auth_subjects WHERE user_id=$1 ORDER BY subject")
            .bind(player)
            .fetch_all(&mut *tx)
            .await
            .map_err(|_| Failure::SubjectLookupFailed)?;
    if names.is_empty() {
        names.push(format!("principal-{player}"));
    }
    let subjects: Vec<Subject> = names
        .into_iter()
        .map(|principal_id| Subject {
            idempotency_key: format!("puzzled-account-erasure-{principal_id}"),
            principal_id,
            request_id: None,
            state: None,
        })
        .collect();
    let request_id = Uuid::now_v7();
    sqlx::query("INSERT INTO erasure_requests(request_id,player_id,suppression_hash,organization_id,subjects) VALUES($1,$2,puzzled_erasure_player_hash($2),$3,$4)")
        .bind(request_id).bind(player).bind(auth.organization_id())
        .bind(serde_json::to_value(subjects).map_err(|_| Failure::SubjectLookupFailed)?)
        .execute(&mut *tx).await.map_err(|_| Failure::DatabaseUnavailable)?;
    tx.commit()
        .await
        .map_err(|_| Failure::DatabaseUnavailable)?;
    // Durable pending is honest acceptance, not erasure completion. No guessed
    // Money API is called and no Auth effect is allowed before real preparation.
    Ok(Status {
        request_id,
        state: "pending".into(),
        rows_deleted: 0,
    })
}

#[derive(Default)]
pub struct SweepCounts {
    pub attempted: u32,
    pub pending: u32,
    pub completed: u32,
}

/// Bounded claims run independently of Tryit's reporter configuration. The
/// lease pair survives crashes and is never unlocked by a stale token.
pub async fn sweep(pool: &PgPool, auth: Option<&AuthErasure>) -> Result<SweepCounts, Failure> {
    let claims = sqlx::query("WITH candidates AS (SELECT request_id FROM erasure_requests WHERE state <> 'completed' AND retry_due <= now() AND (lease_until IS NULL OR lease_until < now()) ORDER BY retry_due,request_id LIMIT $1 FOR UPDATE SKIP LOCKED) UPDATE erasure_requests e SET lease_token=$2,lease_until=now()+make_interval(secs=>$3),attempts=attempts+1,updated_at=now() FROM candidates c WHERE e.request_id=c.request_id RETURNING e.request_id,e.player_id,e.organization_id,e.lease_token")
        .bind(PAGE_SIZE).bind(Uuid::now_v7()).bind(LEASE_SECONDS as f64)
        .fetch_all(pool).await.map_err(|_| Failure::DatabaseUnavailable)?;
    let mut counts = SweepCounts::default();
    for claim in claims {
        let operation: Uuid = claim.get("request_id");
        let organization: Option<String> = claim.get("organization_id");
        counts.attempted += 1;
        // Real Money preparation has not been published. Never infer that
        // absence of a renewing subscription closes outstanding checkouts.
        let reason = match auth {
            None => Failure::ErasureUnconfigured,
            Some(auth) if organization.as_deref() != Some(auth.organization_id()) => {
                Failure::InstanceChanged
            }
            Some(_) => Failure::MoneyPreflightUnavailable,
        };
        // The RETURNING claim token, not a freshly minted replacement, fences
        // the retry bookkeeping against a replacement worker.
        let token: Uuid = claim.get("lease_token");
        sqlx::query("UPDATE erasure_requests SET last_reason=$3,retry_due=now()+interval '1 minute',lease_token=NULL,lease_until=NULL,updated_at=now() WHERE request_id=$1 AND lease_token=$2 AND lease_until>now()")
            .bind(operation).bind(token).bind(reason.stage()).execute(pool).await.map_err(|_| Failure::DatabaseUnavailable)?;
        counts.pending += 1;
    }
    Ok(counts)
}
