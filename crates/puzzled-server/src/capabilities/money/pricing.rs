//! The price list, read from Money's `catalogs/default`. The declaration in
//! `config/commercial/catalogue.json` names which plans exist and their price
//! keys; no amount is read from it here.

use puzzled_core::billing_access::catalogue::Catalogue;
use puzzled_core::billing_access::policy::is_family_plan;

use super::client::{Catalog, CatalogPrice};

/// One plan as the pricing page shows it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlanPrices {
    pub plan_id: String,
    pub price_key: String,
    pub interval: String,
    pub family: bool,
    /// (lower-case currency, minor units); the base currency first.
    pub prices: Vec<(String, i64)>,
}

fn find<'a>(catalog: &'a Catalog, key: &str) -> Option<&'a CatalogPrice> {
    catalog.prices().find(|price| price.key == key)
}

/// A price checkout may sell: published, not archived, and shaped as the
/// declaration says (interval and tax behaviour; the amount is Money's).
fn on_sale<'a>(
    catalog: &'a Catalog,
    plan: &puzzled_core::billing_access::catalogue::Plan,
) -> Option<&'a CatalogPrice> {
    let price = find(catalog, &plan.price_key)?;
    let interval_ok = price.recurring_interval.as_deref() == Some(plan.interval.as_str());
    let tax_ok = price
        .tax_behavior
        .as_deref()
        .is_none_or(|tax| tax == plan.tax_behavior);
    (!price.archived && interval_ok && tax_ok && !price.unit_amounts.is_empty()).then_some(price)
}

/// The declared plans Money currently sells, with Money's amounts.
#[must_use]
pub fn plans(catalog: &Catalog, declared: &Catalogue) -> Vec<PlanPrices> {
    declared
        .plans
        .iter()
        .filter_map(|plan| {
            let price = on_sale(catalog, plan)?;
            let mut prices: Vec<(String, i64)> = price
                .unit_amounts
                .iter()
                .filter_map(|(code, minor)| {
                    Some((code.to_ascii_lowercase(), minor.trim().parse().ok()?))
                })
                .collect();
            prices.sort_by(|a, b| {
                (a.0 != declared.base_currency, &a.0).cmp(&(b.0 != declared.base_currency, &b.0))
            });
            Some(PlanPrices {
                plan_id: plan.plan_id.clone(),
                price_key: plan.price_key.clone(),
                interval: plan.interval.clone(),
                family: is_family_plan(&plan.plan_id),
                prices,
            })
        })
        .collect()
}

/// Sales are open only when every declared plan is on sale.
#[must_use]
pub fn all_on_sale(catalog: &Catalog, declared: &Catalogue) -> bool {
    declared
        .plans
        .iter()
        .all(|plan| on_sale(catalog, plan).is_some())
}

/// The plan's price when checkout may sell it.
#[must_use]
pub fn sellable<'a>(
    catalog: &'a Catalog,
    declared: &Catalogue,
    plan_id: &str,
) -> Option<&'a CatalogPrice> {
    on_sale(catalog, declared.plan(plan_id)?)
}
