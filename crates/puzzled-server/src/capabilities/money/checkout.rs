//! Checkout: the server creates a Money `checkout_session` and the browser is
//! redirected to its hosted page. The success page grants nothing; access
//! arrives through Money's entitlement check once the processor confirms.

use puzzled_core::attribution::Attribution;
use serde_json::{json, Map, Value};

use super::access::{FEATURE_FAMILY, FEATURE_PLUS};
use super::client::{Catalog, Money, MoneyError};
use super::pricing::{plan, price_of};

/// Why a checkout could not be started.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CheckoutError {
    /// The immediate-supply consent was not given.
    ConsentRequired,
    PlanNotOnSale,
    AlreadySubscribed,
    Failed(String),
}

/// Return-URL path prefix for a locale: en-US has none, the others use the
/// canonical tag (`/en-GB`, `/zh-HK`), matching the web routing.
#[must_use]
pub fn locale_prefix(locale: &str) -> &'static str {
    match locale.to_ascii_lowercase().as_str() {
        "en-gb" => "/en-GB",
        "zh-cn" => "/zh-CN",
        "zh-hk" => "/zh-HK",
        "zh-tw" => "/zh-TW",
        "ja" => "/ja",
        "es" => "/es",
        "pt-br" => "/pt-BR",
        _ => "",
    }
}

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

/// The hosted checkout's language for a Puzzled locale. Stripe accepts only its
/// own list (it refuses `en-US` and `zh-Hant` with `invalid_request_error`), so
/// each Puzzled locale maps onto that list and anything else asks Stripe for
/// `auto` (the buyer's browser language).
#[must_use]
pub fn checkout_locale(locale: &str) -> Option<&'static str> {
    match locale.trim() {
        "" => None,
        "en-US" | "en" => Some("en"),
        "en-GB" => Some("en-GB"),
        "zh-HK" => Some("zh-HK"),
        "zh-TW" | "zh-Hant" => Some("zh-TW"),
        "zh-CN" | "zh-Hans" | "zh" => Some("zh"),
        "ja" => Some("ja"),
        "es" => Some("es"),
        "pt-BR" => Some("pt-BR"),
        _ => Some("auto"),
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
        for (key, value) in tags
            .metadata_pairs()
            .into_iter()
            .chain(tags.click_id_pairs())
        {
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
    if let Some(code) = checkout_locale(locale) {
        body["locale"] = json!(code);
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
