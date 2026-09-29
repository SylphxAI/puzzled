//! One-off: move every live Stripe subscriber onto Sylphx Money before the
//! Stripe code is deleted. Run in this order, each step a Compute tick
//! (`sylphx.toml`, paused schedules; unpause one, run it, pause it again):
//!
//! 1. `grants`: for each live `billing_subscriptions` row, create the Money
//!    grants (list first, skip what exists), set the Stripe subscription to
//!    cancel at period end (the Stripe client's last use), and queue one email.
//! 2. `verify`: readback, answering 200 only when every live row has its
//!    Money grants and is set to cancel at period end.
//! 3. `export`: the `billing_*` rows to the export directory, read back by
//!    count and checksum.
//! 4. Only then merge the deletion PR (Stripe code, webhook, tables).
//!
//! Every step is safe to rerun. Logs carry counts only.

pub mod export;
pub mod grants;

pub use grants::{run_grants, verify, Report, Verification};

#[cfg(test)]
mod tests;
