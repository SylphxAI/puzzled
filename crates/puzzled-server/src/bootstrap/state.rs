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

    /// Puzzled Plus is on sale: Stripe and the database are both configured.
    #[must_use]
    pub fn sales_open(&self) -> bool {
        self.stripe.is_some() && self.pool.is_some()
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
