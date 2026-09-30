//! The price list, read from Money's `catalogs/default`. Money is the one
//! source of prices, plans and seats: nothing here names a price key, an
//! amount, a currency or a seat count. A plan is derived from the catalogue:
//! a product whose `features` contain `plus`, ranked by its `seats` limit
//! (`1` is individual, above `1` is family), sold at a price picked by
//! `recurring_interval`. Adding a plan is a catalogue change only.

use super::access::{FEATURE_PLUS, FEATURE_SEATS};
use super::client::{Catalog, CatalogPrice, CatalogProduct};

/// One plan as the pricing page shows it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlanPrices {
    /// `individual_monthly`, `family_yearly`, ...: derived from the seats
    /// limit and the interval, and only used between the page and this api.
    pub plan_id: String,
    /// The catalogue price key checkout sells.
    pub price_key: String,
    pub interval: String,
    pub family: bool,
    pub seats: u32,
    /// (lower-case currency, minor units); sorted by code.
    pub prices: Vec<(String, i64)>,
}

fn seats_of(product: &CatalogProduct) -> u32 {
    product
        .features
        .get(FEATURE_SEATS)
        .and_then(|seats| seats.trim().parse().ok())
        .unwrap_or(1)
}

fn sold(price: &CatalogPrice) -> Option<&'static str> {
    if price.archived || price.unit_amounts.is_empty() {
        return None;
    }
    match price.recurring_interval.as_deref() {
        Some("month") => Some("monthly"),
        Some("year") => Some("yearly"),
        _ => None,
    }
}

fn amounts(price: &CatalogPrice) -> Vec<(String, i64)> {
    price
        .unit_amounts
        .iter()
        .filter_map(|(code, minor)| Some((code.to_ascii_lowercase(), minor.trim().parse().ok()?)))
        .collect()
}

/// The plans Money currently sells: individual before family, month before
/// year. Where two products share a kind and interval, the smaller seats
/// limit wins.
#[must_use]
pub fn plans(catalog: &Catalog) -> Vec<PlanPrices> {
    let mut found: Vec<PlanPrices> = Vec::new();
    for product in catalog
        .spec
        .products
        .iter()
        .filter(|p| p.features.contains_key(FEATURE_PLUS))
    {
        let seats = seats_of(product);
        let family = seats > 1;
        for price in &product.prices {
            let Some(word) = sold(price) else { continue };
            let kind = if family { "family" } else { "individual" };
            found.push(PlanPrices {
                plan_id: format!("{kind}_{word}"),
                price_key: price.key.clone(),
                interval: price.recurring_interval.clone().unwrap_or_default(),
                family,
                seats,
                prices: amounts(price),
            });
        }
    }
    found.sort_by(|a, b| {
        (a.family, a.interval == "year", a.seats).cmp(&(b.family, b.interval == "year", b.seats))
    });
    found.dedup_by(|later, first| later.plan_id == first.plan_id);
    found
}

/// The plan `plan_id` names, when Money sells it.
#[must_use]
pub fn plan(catalog: &Catalog, plan_id: &str) -> Option<PlanPrices> {
    plans(catalog).into_iter().find(|p| p.plan_id == plan_id)
}

/// The catalogue price behind a plan.
#[must_use]
pub fn price_of<'a>(catalog: &'a Catalog, plan: &PlanPrices) -> Option<&'a CatalogPrice> {
    catalog.prices().find(|price| price.key == plan.price_key)
}
