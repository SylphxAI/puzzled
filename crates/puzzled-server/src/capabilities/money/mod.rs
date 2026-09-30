//! Sylphx Money: the one payments owner (owner standard). Puzzled holds no
//! price, no processor key and no entitlement rule of its own once it runs
//! here: access is Money's `entitlement_grants:check`, checkout is a Money
//! `checkout_sessions` the browser is redirected to, and the price list is
//! Money's `price_catalogs/default`.

pub mod access;
pub mod checkout;
pub mod client;
pub mod consent_db;
pub mod pricing;

#[cfg(test)]
mod tests;

pub use client::{Money, MoneyError};
