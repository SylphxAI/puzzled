//! Application state composition root piece.

use std::time::Instant;

use sqlx::PgPool;

use crate::capabilities::identity_access::adapters::auth_erasure::AuthErasure;
use crate::capabilities::identity_access::adapters::auth_session::AuthSessions;
use crate::capabilities::money::{pricing, Money};
use crate::capabilities::preferences::unsubscribe::UnsubscribeTokens;
use crate::capabilities::tryit_conversions::TryitReporter;
use crate::shared::tick_receipt::TickVerifier;

#[derive(Clone)]
pub struct AppState {
    started_at: Instant,
    pub pool: Option<PgPool>,
    /// Dedicated signed-link verifier; missing key refuses unsubscribe.
    pub unsubscribe: Option<UnsubscribeTokens>,
    /// Sylphx Money, when configured: entitlements, checkout and prices.
    pub money: Option<Money>,
    /// Sylphx Auth end-user session checks.
    pub auth: AuthSessions,
    /// Deleting a player's Sylphx Auth sign-in (privacy request). None until
    /// Enable Auth binds the instance keys: account erasure then refuses,
    /// rather than leaving a live sign-in behind.
    pub erasure: Option<AuthErasure>,
    /// Admission for Compute schedule ticks (signed receipts).
    pub ticks: TickVerifier,
    /// Reports Tryit-referred sign-ups and purchases back to Tryit. None
    /// without `SYLPHX_API_KEY`: conversions are then queued and wait.
    pub tryit: Option<TryitReporter>,
}

impl AppState {
    #[must_use]
    pub fn new(pool: Option<PgPool>) -> Self {
        Self {
            started_at: Instant::now(),
            unsubscribe: UnsubscribeTokens::from_env(),
            auth: AuthSessions::from_env().with_pool(pool.clone()),
            erasure: AuthErasure::from_env(),
            pool,
            money: None,
            ticks: TickVerifier::from_env(),
            tryit: TryitReporter::from_env(),
        }
    }

    #[must_use]
    pub fn with_ticks(mut self, ticks: TickVerifier) -> Self {
        self.ticks = ticks;
        self
    }

    #[must_use]
    pub fn with_tryit(mut self, tryit: Option<TryitReporter>) -> Self {
        self.tryit = tryit;
        self
    }

    #[must_use]
    pub fn with_auth(mut self, auth: AuthSessions) -> Self {
        self.auth = auth;
        self
    }

    #[must_use]
    pub fn with_erasure(mut self, erasure: Option<AuthErasure>) -> Self {
        self.erasure = erasure;
        self
    }

    #[must_use]
    pub fn with_money(mut self, money: Option<Money>) -> Self {
        self.money = money;
        self
    }

    /// Puzzled Plus is on sale: Money is configured and its catalogue is
    /// checkout-ready (synced to the processor) for at least one Puzzled plan.
    /// A catalogue read that fails counts as not on sale: nothing is locked and
    /// no purchase is offered until Money answers.
    pub async fn sales_open(&self) -> bool {
        let (Some(_), Some(money)) = (&self.pool, &self.money) else {
            return false;
        };
        match money.catalog().await {
            Ok(catalog) => !pricing::plans(&catalog).is_empty(),
            Err(error) => {
                tracing::warn!(%error, "Money catalogue read failed; treating Plus as not on sale");
                false
            }
        }
    }

    #[must_use]
    pub fn uptime_secs(&self) -> u64 {
        self.started_at.elapsed().as_secs()
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Money down: sales read as closed, so nothing free today is locked and
    /// no purchase is offered.
    #[tokio::test]
    async fn money_unreachable_means_sales_closed() {
        let money = Money::new("http://127.0.0.1:9/env", "sk_test", "https://puzzled.test");
        let state = AppState::new(Some(
            PgPool::connect_lazy("postgres://u@127.0.0.1:9/d").unwrap(),
        ))
        .with_money(Some(money));
        assert!(!state.sales_open().await);
    }
}
