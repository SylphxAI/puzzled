//! The commercial catalogue: Puzzled's products, price keys, amounts, features
//! (entitlements), family seats and cancellation window.
//!
//! The file is `config/commercial/catalogue.json` at the repository root — the
//! declaration input for Sylphx Money, and until the cutover the one authored
//! place for these facts. It is embedded here at compile time, so changing a
//! price is changing that file and rebuilding. The web pricing page reads the
//! same file directly (`apps/puzzled/src/lib/billing/catalogue.ts`) and the
//! Stripe setup script publishes it (`scripts/stripe-setup.ts`).
//!
//! Sales stay closed unless every declared plan is published at exactly these
//! amounts, intervals and tax behaviour ([`Catalogue::price_matches`]), so the
//! page's price, the declared price and the charged price cannot drift apart.
//!
//! At the Money cutover the runtime reads end: this module is replaced by a
//! Money catalogue client (`GET /v1/catalogs/default`) and entitlement checks
//! (`entitlement_grants:check`), no amount or seat count is read from this
//! repository, and the file stays as the record of what was declared.
//!
//! Pure facts and pure decisions: no HTTP, no database, no clock.

use std::collections::BTreeMap;
use std::sync::OnceLock;

use serde::Deserialize;

const CATALOGUE_JSON: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../config/commercial/catalogue.json"
));

/// Where the catalogue lives, for log lines and error messages.
pub const CATALOGUE_PATH: &str = "config/commercial/catalogue.json";

/// The catalogue, parsed once on first use.
///
/// A file that does not parse is a build defect: `cargo test -p puzzled-core`
/// parses this same constant, so the panic is never reached in a tested build.
#[must_use]
pub fn catalogue() -> &'static Catalogue {
    static CATALOGUE: OnceLock<Catalogue> = OnceLock::new();
    CATALOGUE.get_or_init(|| {
        serde_json::from_str(CATALOGUE_JSON)
            .unwrap_or_else(|error| panic!("{CATALOGUE_PATH} is invalid: {error}"))
    })
}

#[derive(Debug, Clone, Deserialize)]
pub struct Catalogue {
    pub base_currency: String,
    pub products: Vec<Product>,
    /// The features (entitlements) a plan may grant, keyed by feature id.
    pub features: BTreeMap<String, Feature>,
    pub plans: Vec<Plan>,
    pub policy: Policy,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Product {
    pub id: String,
}

/// A feature as the code reads it. The catalogue describes each one further
/// (name per locale, what it unlocks, where it is gated); the ids, their kind
/// and their implications are what the app acts on.
#[derive(Debug, Clone, Deserialize)]
pub struct Feature {
    /// `boolean` (granted as `"true"`) or `limit` (granted as a decimal
    /// string, like `seats`). This is how Sylphx Money's entitlement grants
    /// carry the value, so the declaration and the check read the same way.
    pub kind: String,
    /// Features this one includes; `family` implies `plus`.
    #[serde(default)]
    pub implies: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Plan {
    /// The stable key Sylphx Money declares this price under.
    pub price_key: String,
    /// The app's plan id (`individual_monthly`, ...). This is also the suffix
    /// of the payment processor's lookup key while Stripe is the processor.
    pub plan_id: String,
    /// The payment processor's price lookup key (Stripe). It retires with the
    /// processor; `price_key` is the stable one.
    pub provider_lookup_key: String,
    pub product: String,
    /// `month` or `year`.
    pub interval: String,
    /// Currency (lowercase) to amount in minor units, tax included.
    pub unit_amounts: BTreeMap<String, i64>,
    /// `inclusive`: the amount is what the customer pays, VAT included.
    pub tax_behavior: String,
    /// What this price grants, feature id to value: a boolean feature is
    /// `"true"`, the `seats` limit is a decimal string. The shape Sylphx
    /// Money's `entitlement_grants:check` answers in.
    pub grants: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Policy {
    pub cancellation: Cancellation,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Cancellation {
    pub days: u32,
}

impl Catalogue {
    #[must_use]
    pub fn plan(&self, plan_id: &str) -> Option<&Plan> {
        self.plans.iter().find(|plan| plan.plan_id == plan_id)
    }

    #[must_use]
    pub fn product(&self, product_id: &str) -> Option<&Product> {
        self.products
            .iter()
            .find(|product| product.id == product_id)
    }

    #[must_use]
    pub fn feature(&self, feature_id: &str) -> Option<&Feature> {
        self.features.get(feature_id)
    }

    /// Plan ids in the catalogue's order (the order the pricing page shows).
    pub fn plan_ids(&'static self) -> impl Iterator<Item = &'static str> {
        self.plans.iter().map(|plan| plan.plan_id.as_str())
    }

    /// Price lookup keys for every plan, for querying the processor.
    pub fn plan_lookup_keys(&'static self) -> impl Iterator<Item = &'static str> {
        self.plans
            .iter()
            .map(|plan| plan.provider_lookup_key.as_str())
    }

    /// Plan id for a price lookup key, when it is one of ours.
    #[must_use]
    pub fn plan_id_from_lookup_key(&self, lookup_key: &str) -> Option<&str> {
        self.plans
            .iter()
            .find(|plan| plan.provider_lookup_key == lookup_key)
            .map(|plan| plan.plan_id.as_str())
    }

    /// Where a plan sits in the catalogue's order.
    #[must_use]
    pub fn plan_rank(&self, plan_id: &str) -> Option<usize> {
        self.plans.iter().position(|plan| plan.plan_id == plan_id)
    }

    /// The declared amount for a plan in a currency, in minor units.
    #[must_use]
    pub fn declared_amount(&self, plan_id: &str, currency: &str) -> Option<i64> {
        self.plan(plan_id)?.declared_amount(currency)
    }

    /// The declared amounts for a plan, base currency first (the order the
    /// price list is served and shown in). Empty for an unknown plan.
    #[must_use]
    pub fn declared_prices(&self, plan_id: &str) -> Vec<(&str, i64)> {
        let Some(plan) = self.plan(plan_id) else {
            return Vec::new();
        };
        let mut entries: Vec<(&str, i64)> = plan
            .unit_amounts
            .iter()
            .map(|(currency, amount)| (currency.as_str(), *amount))
            .collect();
        entries.sort_by_key(|(currency, _)| *currency != self.base_currency);
        entries
    }

    /// Does a price the processor publishes match the plan's declaration?
    ///
    /// Interval, tax behaviour, currencies and every amount must be exactly as
    /// declared: a price the catalogue does not declare must never be the
    /// price charged.
    #[must_use]
    pub fn price_matches(
        &self,
        plan_id: &str,
        interval: &str,
        tax_behavior: &str,
        amounts: &[(String, i64)],
    ) -> bool {
        self.plan(plan_id)
            .is_some_and(|plan| plan.matches(interval, tax_behavior, amounts))
    }

    /// A family plan shares its access: it grants the `family` feature.
    #[must_use]
    pub fn is_family_plan(&self, plan_id: &str) -> bool {
        self.plan(plan_id)
            .is_some_and(|plan| plan.has_grant("family"))
    }

    /// People on one family plan, the owner included: the largest `seats`
    /// limit any price grants.
    ///
    /// At the Money cutover this value comes from
    /// `entitlement_grants:check {feature: "seats"}` for the subscriber's own
    /// price, not from this file.
    #[must_use]
    pub fn family_max_members(&self) -> u32 {
        self.plans
            .iter()
            .filter_map(Plan::seats)
            .filter(|seats| *seats > 1)
            .max()
            .unwrap_or(1)
    }

    /// Days after the first subscription starts in which cancelling refunds it
    /// in full (UK Consumer Contracts Regulations 2013 cancellation period).
    #[must_use]
    pub fn cancellation_days(&self) -> u32 {
        self.policy.cancellation.days
    }
}

impl Plan {
    /// The value this price grants a feature, when it grants one.
    #[must_use]
    pub fn grant(&self, feature: &str) -> Option<&str> {
        self.grants.get(feature).map(String::as_str)
    }

    /// Does this price grant the named boolean feature?
    #[must_use]
    pub fn has_grant(&self, feature: &str) -> bool {
        self.grant(feature) == Some("true")
    }

    /// People this price covers, the plan owner included: the `seats` limit
    /// grant, as a decimal string in the file.
    ///
    /// Money serves the same number at cutover; nothing in the app holds it.
    #[must_use]
    pub fn seats(&self) -> Option<u32> {
        self.grant("seats")?.parse().ok()
    }

    /// The declared amount in a currency, in minor units.
    #[must_use]
    pub fn declared_amount(&self, currency: &str) -> Option<i64> {
        self.unit_amounts
            .get(&currency.to_ascii_lowercase())
            .copied()
    }

    /// Does a published price (interval, tax behaviour and amounts) match this
    /// declaration?
    ///
    /// Every declared currency must be published at the declared amount, no
    /// other currency may tag along, and the price must be tax inclusive, so
    /// the price a customer is charged in any currency is a price the
    /// catalogue declares.
    #[must_use]
    pub fn matches(&self, interval: &str, tax_behavior: &str, amounts: &[(String, i64)]) -> bool {
        self.interval == interval
            && self.tax_behavior == tax_behavior
            && amounts.len() == self.unit_amounts.len()
            && amounts
                .iter()
                .all(|(currency, amount)| self.declared_amount(currency) == Some(*amount))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn plan(id: &str) -> &'static Plan {
        catalogue().plan(id).unwrap()
    }

    #[test]
    fn the_embedded_file_parses_and_declares_the_shipped_plans() {
        let catalogue = catalogue();
        assert_eq!(catalogue.base_currency, "usd");
        assert_eq!(
            catalogue.plan_ids().collect::<Vec<_>>(),
            vec![
                "individual_monthly",
                "individual_yearly",
                "family_monthly",
                "family_yearly"
            ]
        );
        for plan in &catalogue.plans {
            assert!(
                catalogue.product(&plan.product).is_some(),
                "{}",
                plan.plan_id
            );
            assert!(plan.price_key.starts_with("plus_"), "{}", plan.plan_id);
            assert!(
                plan.provider_lookup_key.ends_with(&plan.plan_id),
                "{}",
                plan.plan_id
            );
            assert!(
                plan.seats().is_some_and(|seats| seats >= 1),
                "{}",
                plan.plan_id
            );
            assert!(!plan.grants.is_empty(), "{}", plan.plan_id);
            // Every grant names a declared feature and carries the value its
            // kind promises: a boolean is "true", a limit is a decimal string.
            for (feature_id, value) in &plan.grants {
                let feature = catalogue
                    .feature(feature_id)
                    .unwrap_or_else(|| panic!("{} grants undeclared {feature_id}", plan.plan_id));
                match feature.kind.as_str() {
                    "boolean" => assert_eq!(value, "true", "{} {feature_id}", plan.plan_id),
                    "limit" => assert!(
                        !value.is_empty() && value.bytes().all(|byte| byte.is_ascii_digit()),
                        "{} {feature_id} = {value}",
                        plan.plan_id
                    ),
                    other => panic!("{feature_id} has unknown kind {other}"),
                }
            }
            for currency in ["usd", "gbp"] {
                let amount = plan
                    .declared_amount(currency)
                    .unwrap_or_else(|| panic!("{} has no {currency} amount", plan.plan_id));
                assert!(amount > 0, "{} {currency}", plan.plan_id);
            }
            assert_eq!(plan.tax_behavior, "inclusive", "{}", plan.plan_id);
        }
        assert_eq!(
            catalogue.plans.len(),
            catalogue
                .plans
                .iter()
                .map(|plan| plan.price_key.as_str())
                .collect::<std::collections::HashSet<_>>()
                .len(),
            "price keys must be unique"
        );
        assert_eq!(catalogue.cancellation_days(), 14);
        // The family price covers four people; the code reads that number from
        // the file's `seats` grant and holds none of its own.
        assert_eq!(plan("family_monthly").seats(), Some(4));
        assert_eq!(catalogue.family_max_members(), 4);
        // The base currency leads every price list, and every declared amount
        // comes back out of it.
        for plan in &catalogue.plans {
            let prices = catalogue.declared_prices(&plan.plan_id);
            assert_eq!(prices.len(), plan.unit_amounts.len(), "{}", plan.plan_id);
            assert_eq!(
                prices.first().map(|(currency, _)| *currency),
                Some(catalogue.base_currency.as_str()),
                "{}",
                plan.plan_id
            );
            for (currency, amount) in prices {
                assert_eq!(plan.declared_amount(currency), Some(amount), "{currency}");
            }
        }
        assert!(catalogue.declared_prices("lifetime").is_empty());
    }

    #[test]
    fn lookup_keys_round_trip_and_foreign_prices_are_rejected() {
        let catalogue = catalogue();
        for plan in &catalogue.plans {
            assert_eq!(
                catalogue.plan_id_from_lookup_key(&plan.provider_lookup_key),
                Some(plan.plan_id.as_str())
            );
        }
        assert_eq!(catalogue.plan_id_from_lookup_key("puzzled_lifetime"), None);
        assert_eq!(
            catalogue.plan_id_from_lookup_key("individual_monthly"),
            None
        );
        assert_eq!(
            catalogue.plan_lookup_keys().collect::<Vec<_>>(),
            vec![
                "puzzled_individual_monthly",
                "puzzled_individual_yearly",
                "puzzled_family_monthly",
                "puzzled_family_yearly"
            ]
        );
    }

    #[test]
    fn family_plans_are_the_multi_seat_ones_and_grant_the_family_feature() {
        let catalogue = catalogue();
        assert!(catalogue.is_family_plan("family_yearly"));
        assert!(!catalogue.is_family_plan("individual_yearly"));
        assert!(!catalogue.is_family_plan("lifetime"));
        assert_eq!(plan("family_monthly").seats(), Some(4));
        assert_eq!(plan("individual_monthly").seats(), Some(1));
        for plan in &catalogue.plans {
            assert!(plan.has_grant("plus"), "{}", plan.plan_id);
            for feature_id in plan.grants.keys() {
                let declared = catalogue
                    .feature(feature_id)
                    .unwrap_or_else(|| panic!("{} grants undeclared {feature_id}", plan.plan_id));
                for implied in &declared.implies {
                    assert!(
                        plan.has_grant(implied),
                        "{} grants {feature_id} but not {implied}",
                        plan.plan_id
                    );
                }
            }
            assert_eq!(
                plan.has_grant("family"),
                plan.seats().is_some_and(|seats| seats > 1),
                "{}: the family feature is exactly what a shared price grants",
                plan.plan_id
            );
        }
    }

    #[test]
    fn a_published_price_matches_only_at_the_declared_interval_amounts_and_tax() {
        let catalogue = catalogue();
        let declared = |id: &str| -> Vec<(String, i64)> {
            plan(id)
                .unit_amounts
                .iter()
                .map(|(currency, amount)| (currency.clone(), *amount))
                .collect()
        };
        let amounts = declared("individual_monthly");
        assert!(catalogue.price_matches("individual_monthly", "month", "inclusive", &amounts));
        // A different interval, tax behaviour, amount, a missing currency or an
        // extra one all read as drift.
        assert!(!catalogue.price_matches("individual_monthly", "year", "inclusive", &amounts));
        assert!(!catalogue.price_matches("individual_monthly", "month", "exclusive", &amounts));
        assert!(!catalogue.price_matches("individual_monthly", "month", "", &amounts));
        let mut cheaper = amounts.clone();
        cheaper[0].1 -= 1;
        assert!(!catalogue.price_matches("individual_monthly", "month", "inclusive", &cheaper));
        let mut fewer = amounts.clone();
        fewer.pop();
        assert!(!catalogue.price_matches("individual_monthly", "month", "inclusive", &fewer));
        let mut extra = amounts;
        extra.push(("eur".to_string(), 499));
        assert!(!catalogue.price_matches("individual_monthly", "month", "inclusive", &extra));
        assert!(!catalogue.price_matches("lifetime", "month", "inclusive", &[]));
    }
}
