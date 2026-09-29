//! The price list, read from Money's `catalogs/default`. Money is the one
//! source of prices and seats: no amount, currency, interval or seat number is
//! written in this repository. Only the mapping from Puzzled's plan ids to
//! Money price keys lives here (`plus_<plan id>`).

use puzzled_core::billing_access::policy::{is_family_plan, PLAN_IDS};

use super::client::{Catalog, CatalogPrice};

/// One plan as the pricing page shows it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlanPrices {
    pub plan_id: String,
    pub price_key: String,
    pub interval: String,
    pub family: bool,
    /// (lower-case currency, minor units); sorted by code.
    pub prices: Vec<(String, i64)>,
}

/// The Money price key for a plan id.
#[must_use]
pub fn price_key(plan_id: &str) -> String {
    format!("plus_{plan_id}")
}

/// The plan id for a Money price key, when it is one of ours.
#[must_use]
pub fn plan_id_from_price_key(key: &str) -> Option<&'static str> {
    let id = key.strip_prefix("plus_")?;
    PLAN_IDS.iter().copied().find(|plan| *plan == id)
}

/// The interval a plan id names (`..._monthly`, `..._yearly`).
fn interval_of(plan_id: &str) -> &'static str {
    if plan_id.ends_with("_yearly") {
        "year"
    } else {
        "month"
    }
}

/// A price checkout may sell: published, not archived, priced, and recurring
/// at the interval its plan id names.
fn on_sale<'a>(catalog: &'a Catalog, plan_id: &str) -> Option<&'a CatalogPrice> {
    let key = price_key(plan_id);
    let price = catalog.prices().find(|price| price.key == key)?;
    let interval_ok = price.recurring_interval.as_deref() == Some(interval_of(plan_id));
    (!price.archived && interval_ok && !price.unit_amounts.is_empty()).then_some(price)
}

/// The plans Money currently sells, in the pricing page's order, with
/// Money's amounts.
#[must_use]
pub fn plans(catalog: &Catalog) -> Vec<PlanPrices> {
    PLAN_IDS
        .iter()
        .filter_map(|plan_id| {
            let price = on_sale(catalog, plan_id)?;
            let prices: Vec<(String, i64)> = price
                .unit_amounts
                .iter()
                .filter_map(|(code, minor)| {
                    Some((code.to_ascii_lowercase(), minor.trim().parse().ok()?))
                })
                .collect();
            Some(PlanPrices {
                plan_id: (*plan_id).to_string(),
                price_key: price_key(plan_id),
                interval: interval_of(plan_id).to_string(),
                family: is_family_plan(plan_id),
                prices,
            })
        })
        .collect()
}

/// The plan's price when checkout may sell it.
#[must_use]
pub fn sellable<'a>(catalog: &'a Catalog, plan_id: &str) -> Option<&'a CatalogPrice> {
    on_sale(catalog, plan_id)
}
