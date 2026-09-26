//! Application state composition root piece.

use std::time::Instant;

use sqlx::PgPool;

use crate::capabilities::billing::adapters::stripe::Stripe;

#[derive(Clone)]
pub struct AppState {
    started_at: Instant,
    pub pool: Option<PgPool>,
    /// Stripe, when Puzzled Plus is on sale. None: nothing is sold or locked.
    pub stripe: Option<Stripe>,
}

impl AppState {
    #[must_use]
    pub fn new(pool: Option<PgPool>) -> Self {
        Self {
            started_at: Instant::now(),
            pool,
            stripe: None,
        }
    }

    #[must_use]
    pub fn with_stripe(mut self, stripe: Option<Stripe>) -> Self {
        self.stripe = stripe;
        self
    }

    /// Puzzled Plus is on sale: Stripe and the database are configured and
    /// Stripe publishes at least one Puzzled Plus price (cached five minutes).
    /// A Stripe read that fails counts as on sale, so paid play fails closed;
    /// the free daily puzzle never asks.
    pub async fn sales_open(&self) -> bool {
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
