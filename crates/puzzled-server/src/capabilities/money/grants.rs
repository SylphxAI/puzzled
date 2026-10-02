//! Operator entitlement grants: free or discounted access recorded in Money's
//! ledger, never a code path in Puzzled (owner `standards/commercial.md`).
//!
//! Money documents `EntitlementGrant` as "a manual or promotional grant with an
//! optional expiry, for support, comps, and migrations" (cloud
//! `docs/services/money/customer-payments.md` §4.6), but on 2026-10-02 it
//! serves only `Get`/`List`/`:check` for grants: no create. This client speaks
//! the shape that resource takes under Money's own conventions (AIP-133
//! client-chosen id, `Idempotency-Key`, `RESOURCE_ALREADY_EXISTS` on a
//! repeat), so it works the day Money serves it and, until then, fails closed
//! on the first call with Money's own refusal.

use chrono::{DateTime, SecondsFormat, Utc};
use serde_json::{json, Value};

use super::client::{Money, MoneyError};

/// One grant to record: who, which feature, until when, and on whose word.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OperatorGrant {
    /// The grant's resource id, chosen by the caller so a repeat names the
    /// same record (`[a-z0-9-]`, at most 63 characters).
    pub id: String,
    /// Money's `end_user` subject: the Puzzled account id.
    pub end_user: String,
    /// A catalogue feature key, e.g. `plus`.
    pub feature: String,
    pub expire_time: DateTime<Utc>,
    /// The campaign the grant belongs to, e.g. `operator_grants/plus-grace-20261002`.
    pub source: String,
    pub reason: String,
    /// Who approved it, e.g. `CEO 2026-10-02`.
    pub approver: String,
}

/// What Money holds after [`Money::ensure_operator_grant`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GrantOutcome {
    /// Money recorded the grant now.
    Created,
    /// Money already held this grant (a re-run); nothing was written.
    AlreadyHeld,
}

/// True for an id Money's AIP-122 resource ids accept.
#[must_use]
pub fn valid_grant_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 63
        && id
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
        && id.starts_with(|c: char| c.is_ascii_lowercase())
}

impl OperatorGrant {
    #[must_use]
    pub fn body(&self) -> Value {
        json!({
            "subject": {"end_user": self.end_user},
            "feature": self.feature,
            "expire_time": self.expire_time.to_rfc3339_opts(SecondsFormat::Secs, true),
            "source": self.source,
            "reason": self.reason,
            "approver": self.approver,
        })
    }

    /// A stored grant under this id must be this grant; anything else is a
    /// collision that must stop the run, not be counted as done.
    fn matches(&self, stored: &Value) -> Result<(), MoneyError> {
        let subject = stored.pointer("/subject/end_user").and_then(Value::as_str);
        let feature = stored.get("feature").and_then(Value::as_str);
        if subject.is_some_and(|s| s != self.end_user) || feature.is_some_and(|f| f != self.feature)
        {
            return Err(MoneyError::Refused {
                status: 409,
                code: "grant_id_names_another_grant".into(),
            });
        }
        Ok(())
    }
}

impl OperatorGrant {
    /// A transport error names the request URL, which holds the grant id and
    /// so the account; keep the account out of every error and log line.
    fn redact(&self, error: MoneyError) -> MoneyError {
        match error {
            MoneyError::Unavailable(why) => MoneyError::Unavailable(
                why.replace(&self.id, "{grant}")
                    .replace(&self.end_user, "{account}"),
            ),
            refused => refused,
        }
    }
}

impl Money {
    /// Record `grant` once. A grant already stored under the same id is a
    /// no-op; any Money error is returned (the caller stops: fail closed).
    pub async fn ensure_operator_grant(
        &self,
        grant: &OperatorGrant,
    ) -> Result<GrantOutcome, MoneyError> {
        if !valid_grant_id(&grant.id) {
            return Err(MoneyError::Refused {
                status: 400,
                code: "invalid_grant_id".into(),
            });
        }
        let base = self.env_url().await?.to_string();
        match self
            .call(
                self.http
                    .get(format!("{base}/entitlement_grants/{}", grant.id)),
            )
            .await
        {
            Ok(stored) => {
                grant.matches(&stored)?;
                return Ok(GrantOutcome::AlreadyHeld);
            }
            Err(MoneyError::Refused { status: 404, .. }) => {}
            Err(error) => return Err(grant.redact(error)),
        }
        match self
            .call(
                self.http
                    .post(format!("{base}/entitlement_grants"))
                    .query(&[("entitlement_grant_id", grant.id.as_str())])
                    .header("Idempotency-Key", grant.id.as_str())
                    .json(&grant.body()),
            )
            .await
        {
            Ok(created) => {
                grant.matches(&created)?;
                Ok(GrantOutcome::Created)
            }
            Err(MoneyError::Refused { status: 409, code }) if code == "RESOURCE_ALREADY_EXISTS" => {
                Ok(GrantOutcome::AlreadyHeld)
            }
            Err(error) => Err(grant.redact(error)),
        }
    }
}
