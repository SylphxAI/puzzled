//! Application state composition root piece.

use std::time::Instant;

use sqlx::PgPool;

use crate::capabilities::billing::adapters::stripe::Stripe;
use crate::capabilities::identity_access::adapters::auth_erasure::AuthErasure;
use crate::capabilities::identity_access::adapters::auth_session::AuthSessions;
use crate::capabilities::money::{pricing, Money};
use crate::capabilities::tryit_conversions::TryitReporter;
use crate::shared::tick_receipt::TickVerifier;

#[derive(Clone)]
pub struct AppState {
    started_at: Instant,
    pub pool: Option<PgPool>,
    /// Stripe, when Puzzled Plus is on sale. None: nothing is sold or locked.
    pub stripe: Option<Stripe>,
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
            auth: AuthSessions::from_env().with_pool(pool.clone()),
            erasure: AuthErasure::from_env(),
            pool,
            stripe: None,
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
    pub fn with_stripe(mut self, stripe: Option<Stripe>) -> Self {
        self.stripe = stripe;
        self
    }

    #[must_use]
    pub fn with_money(mut self, money: Option<Money>) -> Self {
        self.money = money;
        self
    }

    /// Puzzled Plus is on sale: Stripe and the database are configured and
    /// Stripe publishes at least one Puzzled Plus price (cached five minutes).
    /// A Stripe read that fails counts as on sale, so paid play fails closed;
    /// the free daily puzzle never asks.
    pub async fn sales_open(&self) -> bool {
        // With Money configured, sales are open when Money's catalogue sells
        // at least one Puzzled plan. A catalogue read that fails counts as not
        // on sale: nothing is locked and no purchase is offered until Money
        // answers (everything is free today, so an outage never locks it).
        if let Some(money) = &self.money {
            return match money.catalog().await {
                Ok(catalog) => !pricing::plans(&catalog).is_empty(),
                Err(error) => {
                    tracing::warn!(%error, "Money catalogue read failed; treating Plus as not on sale");
                    false
                }
            };
        }
        match (&self.pool, &self.stripe) {
            (Some(_), Some(stripe)) => match stripe.prices().await {
                Ok(prices) => !prices.is_empty(),
                Err(error) => {
                    tracing::warn!(%error, "Stripe price read failed; treating Plus as on sale");
                    true
                }
            },
            _ => false,
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
        let state = AppState::new(None).with_money(Some(money));
        assert!(!state.sales_open().await);
    }
}
