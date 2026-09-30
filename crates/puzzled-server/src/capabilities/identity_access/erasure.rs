//! Handling the platform's user-deletion fan-out (`end-user-principal.md`
//! section 9): when Sylphx Auth deletes a user, every row Puzzled holds about
//! them goes, by the SAME path a player's own account delete uses
//! ([`erase_in_transaction`]), and Puzzled reports evidence back.
//!
//! - The Auth user id is resolved to players through `auth_subjects` (every
//!   subject form, see [`players_for_subject`]).
//! - Erasure and the `erasure_requests` row commit in one transaction, keyed
//!   by the request id, so a redelivery erases nothing twice and answers with
//!   the stored evidence.
//! - The evidence (with its `completed_at`) is stored, posted before the
//!   delivery is acknowledged, and re-posted on every redelivery until Auth
//!   has it: Auth re-announces every 24 hours, so a replay answers the same
//!   evidence and the fan-out fails closed until Puzzled has reported.
//!
//! Unlike the player's own delete, this path does not file a privacy request
//! with Auth (Auth is the one asking) and does not wait for a subscription
//! to be cancelled: an erasure Auth has already accepted is not conditional.

use std::time::Duration;

use sqlx::PgPool;

use super::adapters::auth_subjects::players_for_subject;
use super::adapters::erasure_delivery::{
    DeletionRequested, ErasureTransport, Evidence, Kept, Store,
};
use crate::capabilities::billing::adapters::stripe::Stripe;
use crate::capabilities::billing::service as billing;
use crate::capabilities::preferences::adapters::account_deletion::{
    erase_in_transaction, ErasureReport,
};

/// Pauses between evidence attempts within one delivery.
pub const EVIDENCE_RETRY_DELAYS: [Duration; 3] = [
    Duration::from_millis(500),
    Duration::from_secs(2),
    Duration::from_secs(5),
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Handled {
    pub evidence: Evidence,
    /// True when this delivery was a repeat and erased nothing.
    pub replay: bool,
}

/// Rows in a kept table are anonymised in place and stay for the stated
/// reason (`kept.count` equals `anonymised`); every other table is deleted.
fn evidence_from(report: &ErasureReport) -> Evidence {
    let stores = report
        .rows
        .iter()
        .map(|(store, rows)| match report.kept.get(store) {
            Some(reason) => {
                let mut kept = Vec::new();
                if *rows > 0 {
                    kept.push(Kept {
                        reason: reason.clone(),
                        count: *rows,
                    });
                }
                if store == "billing_subscriptions" && report.cancelled_subscriptions > 0 {
                    kept.push(Kept {
                        reason: "subscription cancelled at erasure".to_string(),
                        count: report.cancelled_subscriptions,
                    });
                }
                Store {
                    store: store.clone(),
                    deleted: 0,
                    anonymised: *rows,
                    kept,
                }
            }
            None => Store {
                store: store.clone(),
                deleted: *rows,
                anonymised: 0,
                kept: Vec::new(),
            },
        })
        .collect();
    Evidence::new(stores, chrono::Utc::now())
}

/// Cancel every renewing own subscription of `players` through the billing
/// code the player's own cancel uses, so erasing never leaves a charge
/// running. Returns how many were cancelled; any failure (Stripe unreachable
/// or not configured) aborts before anything is erased.
async fn cancel_renewing_subscriptions(
    pool: &PgPool,
    stripe: Option<&Stripe>,
    players: &[uuid::Uuid],
) -> Result<u64, String> {
    let mut cancelled = 0;
    for player in players {
        let user = player.to_string();
        let entitlement = billing::entitlement(pool, stripe, &user).await?;
        if entitlement.own.is_some_and(|own| !own.cancel_at_period_end) {
            let stripe = stripe.ok_or("subscription renews but billing is not configured")?;
            billing::cancel(pool, stripe, &user)
                .await?
                .ok_or("subscription vanished during cancel")?;
            cancelled += 1;
        }
    }
    Ok(cancelled)
}

/// Erase (once) and report. `Err` means the delivery must not be
/// acknowledged, so the fan-out retries it.
pub async fn handle(
    pool: &PgPool,
    transport: &ErasureTransport,
    stripe: Option<&Stripe>,
    request: &DeletionRequested,
    retry_delays: &[Duration],
) -> Result<Handled, String> {
    let players = players_for_subject(pool, &request.user_id)
        .await
        .map_err(|error| format!("subject lookup failed: {error}"))?;
    // Money first, and only for a request not handled yet: a charge must not
    // outlive the erasure. A failure answers 502 with nothing erased.
    let handled: bool =
        sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM erasure_requests WHERE request_id = $1)")
            .bind(&request.request_id)
            .fetch_one(pool)
            .await
            .map_err(|error| format!("erasure request read failed: {error}"))?;
    let cancelled = if handled {
        0
    } else {
        cancel_renewing_subscriptions(pool, stripe, &players).await?
    };
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| format!("erasure begin failed: {error}"))?;
    // The primary key serialises concurrent deliveries of one request: the
    // second waits here for the first to commit, then sees the conflict.
    let first = sqlx::query(
        "INSERT INTO erasure_requests (request_id, evidence) VALUES ($1, '{}'::jsonb)
         ON CONFLICT (request_id) DO NOTHING",
    )
    .bind(&request.request_id)
    .execute(&mut *tx)
    .await
    .map_err(|error| format!("erasure request record failed: {error}"))?
    .rows_affected()
        == 1;
    let (evidence, replay) = if first {
        let mut report = ErasureReport {
            cancelled_subscriptions: cancelled,
            ..ErasureReport::default()
        };
        for player in players {
            report.merge(erase_in_transaction(&mut tx, player).await?);
        }
        // An unknown user still reports every store, with zero rows.
        let evidence = evidence_from(&report);
        sqlx::query("UPDATE erasure_requests SET evidence = $2 WHERE request_id = $1")
            .bind(&request.request_id)
            .bind(serde_json::to_value(&evidence).map_err(|error| error.to_string())?)
            .execute(&mut *tx)
            .await
            .map_err(|error| format!("erasure evidence record failed: {error}"))?;
        tx.commit()
            .await
            .map_err(|error| format!("erasure commit failed: {error}"))?;
        (evidence, false)
    } else {
        tx.rollback().await.ok();
        let stored: serde_json::Value =
            sqlx::query_scalar("SELECT evidence FROM erasure_requests WHERE request_id = $1")
                .bind(&request.request_id)
                .fetch_one(pool)
                .await
                .map_err(|error| format!("erasure evidence read failed: {error}"))?;
        (
            serde_json::from_value(stored).map_err(|error| error.to_string())?,
            true,
        )
    };
    report_evidence(
        pool,
        transport,
        &request.request_id,
        &evidence,
        retry_delays,
    )
    .await?;
    Ok(Handled { evidence, replay })
}

/// Post the evidence unless Auth already has it; retry with the given pauses.
async fn report_evidence(
    pool: &PgPool,
    transport: &ErasureTransport,
    request_id: &str,
    evidence: &Evidence,
    retry_delays: &[Duration],
) -> Result<(), String> {
    let posted: Option<chrono::NaiveDateTime> =
        sqlx::query_scalar("SELECT evidence_posted_at FROM erasure_requests WHERE request_id = $1")
            .bind(request_id)
            .fetch_one(pool)
            .await
            .map_err(|error| format!("erasure evidence state read failed: {error}"))?;
    if posted.is_some() {
        return Ok(());
    }
    let mut attempt = 0;
    loop {
        match transport.post_evidence(request_id, evidence).await {
            Ok(()) => break,
            Err(error) => match retry_delays.get(attempt) {
                Some(delay) => {
                    tracing::warn!(%error, request_id, "erasure evidence not accepted; retrying");
                    tokio::time::sleep(*delay).await;
                    attempt += 1;
                }
                None => return Err(error),
            },
        }
    }
    sqlx::query("UPDATE erasure_requests SET evidence_posted_at = now() WHERE request_id = $1")
        .bind(request_id)
        .execute(pool)
        .await
        .map_err(|error| format!("erasure evidence mark failed: {error}"))?;
    Ok(())
}
