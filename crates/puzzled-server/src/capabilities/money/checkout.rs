//! Checkout: the server creates a Money `checkout_session` and the browser is
//! redirected to its hosted page. The success page grants nothing; access
//! arrives through Money's entitlement check once the processor confirms.

use puzzled_core::attribution::Attribution;
use serde_json::{json, Map, Value};

use super::access::{FEATURE_FAMILY, FEATURE_PLUS};
use super::client::{Catalog, Money, MoneyError};
use super::pricing::{plan, price_of};
use crate::capabilities::billing::service::locale_prefix;
pub use crate::capabilities::billing::service::CheckoutError;

/// Proof the buyer gave the immediate-supply consent. It can only be made
/// from a ticked box, so no session is created without one.
#[derive(Debug, Clone, Copy)]
pub struct Consent(());

impl Consent {
    pub fn require(given: bool) -> Result<Self, CheckoutError> {
        given
            .then_some(Self(()))
            .ok_or(CheckoutError::ConsentRequired)
    }
}

/// The `checkout_sessions` request body for one plan (pure).
#[must_use]
pub fn session_body(
    money: &Money,
    user_id: &str,
    plan_id: &str,
    price_key: &str,
    locale: &str,
    currency: Option<&str>,
    attribution: Option<&Attribution>,
) -> Value {
    let base = format!("{}{}", money.public_url(), locale_prefix(locale));
    let mut metadata = Map::new();
    metadata.insert("plan_id".into(), json!(plan_id));
    metadata.insert("immediate_supply_consent".into(), json!("true"));
    if let Some(tags) = attribution {
        for (key, value) in tags.metadata_pairs() {
            metadata.insert(key.into(), json!(value));
        }
    }
    let mut body = json!({
        "subject": {"end_user": user_id},
        "line_items": [{"price": price_key, "quantity": 1}],
        "success_url": format!("{base}/settings/subscription?checkout=success&s={{CHECKOUT_SESSION_ID}}"),
        "cancel_url": format!("{base}/pricing?checkout=cancelled"),
        "metadata": metadata,
    });
    if !locale.is_empty() {
        body["locale"] = json!(locale);
    }
    if let Some(code) = currency {
        body["currency_code"] = json!(code.to_ascii_uppercase());
    }
    body
}

/// Create the session and return the hosted page's URL. `_consent` is the
/// proof the buyer consented (recorded by the caller before this call).
#[allow(clippy::too_many_arguments)]
pub async fn create_session(
    money: &Money,
    catalog: &Catalog,
    user_id: &str,
    plan_id: &str,
    locale: &str,
    currency: &str,
    attribution: Option<&Attribution>,
    _consent: Consent,
) -> Result<String, CheckoutError> {
    let plan = plan(catalog, plan_id).ok_or(CheckoutError::PlanNotOnSale)?;
    let price = price_of(catalog, &plan).ok_or(CheckoutError::PlanNotOnSale)?;
    let feature = if plan.family {
        FEATURE_FAMILY
    } else {
        FEATURE_PLUS
    };
    if money.check(user_id, feature).await.entitled {
        return Err(CheckoutError::AlreadySubscribed);
    }
    let currency = currency.trim().to_ascii_uppercase();
    let currency = price
        .unit_amounts
        .contains_key(&currency)
        .then_some(currency);
    let body = session_body(
        money,
        user_id,
        plan_id,
        &plan.price_key,
        locale,
        currency.as_deref(),
        attribution,
    );
    money
        .create_checkout_session(&body)
        .await
        .map_err(|e: MoneyError| CheckoutError::Failed(e.to_string()))
}
