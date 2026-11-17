//! Checkout: the server creates a Money `checkout_session` and the browser is
//! redirected to its hosted page. The success page grants nothing; access
//! arrives through Money's entitlement check once the processor confirms.

use puzzled_core::attribution::Attribution;
use serde_json::{json, Map, Value};

use super::access::{FEATURE_FAMILY, FEATURE_PLUS};
use super::client::{Catalog, CreatedCheckout, Money, MoneyError};
use super::pricing::{plan, price_of};

/// A cold-guest checkout session created without a pre-existing account subject.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GuestCheckoutSession {
    pub created: CreatedCheckout,
    pub plan_id: String,
    pub price_key: String,
    pub locale: String,
}

/// Why a checkout could not be started.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CheckoutError {
    /// The immediate-supply consent was not given.
    ConsentRequired,
    PlanNotOnSale,
    AlreadySubscribed,
    AttemptPending,
    AttemptChanged,
    InvalidRequest,
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

const MAX_RETURN_TO_LENGTH: usize = 200;

/// Accept only a plain same-origin path for post-checkout navigation.
#[must_use]
pub fn safe_return_to(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed.len() > MAX_RETURN_TO_LENGTH {
        return None;
    }
    if !trimmed.starts_with('/') || trimmed.starts_with("//") {
        return None;
    }
    if trimmed.contains('\\') || trimmed.chars().any(char::is_control) {
        return None;
    }
    Some(trimmed.to_string())
}

fn percent_encode_component(raw: &str) -> String {
    use std::fmt::Write;
    let mut out = String::with_capacity(raw.len());
    for byte in raw.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~') {
            out.push(byte as char);
        } else {
            let _ = write!(out, "%{byte:02X}");
        }
    }
    out
}

#[allow(clippy::too_many_arguments)]
fn build_session_body(
    money: &Money,
    user_id: Option<&str>,
    plan_id: &str,
    price_key: &str,
    locale: &str,
    currency: Option<&str>,
    attribution: Option<&Attribution>,
    return_to: Option<&str>,
) -> Value {
    let base = format!("{}{}", money.public_url(), locale_prefix(locale));
    let encoded_return = return_to
        .and_then(safe_return_to)
        .map(|path| percent_encode_component(&path));
    let success_url = match &encoded_return {
        Some(encoded) => format!(
            "{base}/settings/subscription?checkout=success&s={{CHECKOUT_SESSION_ID}}&callbackUrl={encoded}"
        ),
        None => format!("{base}/settings/subscription?checkout=success&s={{CHECKOUT_SESSION_ID}}"),
    };
    let cancel_url = match &encoded_return {
        Some(encoded) => format!("{base}/pricing?checkout=cancelled&callbackUrl={encoded}"),
        None => format!("{base}/pricing?checkout=cancelled"),
    };
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
        "line_items": [{"price": price_key, "quantity": 1}],
        "success_url": success_url,
        "cancel_url": cancel_url,
        "metadata": metadata,
    });
    if let Some(uid) = user_id {
        body["subject"] = json!({"end_user": uid});
    }
    if let Some(code) = checkout_locale(locale) {
        body["locale"] = json!(code);
    }
    if let Some(code) = currency {
        body["currency_code"] = json!(code.to_ascii_uppercase());
    }
    body
}

/// The `checkout_sessions` request body for an authenticated account (pure).
#[must_use]
#[allow(clippy::too_many_arguments)]
pub fn session_body(
    money: &Money,
    user_id: &str,
    plan_id: &str,
    price_key: &str,
    locale: &str,
    currency: Option<&str>,
    attribution: Option<&Attribution>,
    return_to: Option<&str>,
) -> Value {
    build_session_body(
        money,
        Some(user_id),
        plan_id,
        price_key,
        locale,
        currency,
        attribution,
        return_to,
    )
}

/// The `checkout_sessions` request body for an unauthenticated cold guest (omits `subject`).
#[must_use]
pub fn guest_session_body(
    money: &Money,
    plan_id: &str,
    price_key: &str,
    locale: &str,
    currency: Option<&str>,
    attribution: Option<&Attribution>,
    return_to: Option<&str>,
) -> Value {
    build_session_body(
        money,
        None,
        plan_id,
        price_key,
        locale,
        currency,
        attribution,
        return_to,
    )
}

/// Create an unclaimed guest checkout session (omitting `subject` on the wire so Money
/// allocates `guest:{id}` and returns a single-use `claim_secret`).
#[allow(clippy::too_many_arguments)]
pub async fn create_guest_session(
    money: &Money,
    catalog: &Catalog,
    plan_id: &str,
    locale: &str,
    currency: &str,
    attribution: Option<&Attribution>,
    return_to: Option<&str>,
    _consent: Consent,
) -> Result<GuestCheckoutSession, CheckoutError> {
    let found_plan = plan(catalog, plan_id).ok_or(CheckoutError::PlanNotOnSale)?;
    let price = price_of(catalog, &found_plan).ok_or(CheckoutError::PlanNotOnSale)?;
    let upper = currency.trim().to_ascii_uppercase();
    let chosen_currency = price.unit_amounts.contains_key(&upper).then_some(upper);
    let body = guest_session_body(
        money,
        plan_id,
        &found_plan.price_key,
        locale,
        chosen_currency.as_deref(),
        attribution,
        return_to,
    );
    let created = money
        .create_checkout_session_full(&body)
        .await
        .map_err(|e: MoneyError| CheckoutError::Failed(e.to_string()))?;
    Ok(GuestCheckoutSession {
        created,
        plan_id: found_plan.plan_id,
        price_key: found_plan.price_key,
        locale: locale.to_string(),
    })
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
    return_to: Option<&str>,
    _consent: Consent,
) -> Result<String, CheckoutError> {
    let body = prepare_session(
        money,
        catalog,
        user_id,
        plan_id,
        locale,
        currency,
        attribution,
        return_to,
    )
    .await?;
    money
        .create_checkout_session(&body)
        .await
        .map_err(|e: MoneyError| CheckoutError::Failed(e.to_string()))
}

#[allow(clippy::too_many_arguments)]
pub async fn create_retained_session(
    pool: &sqlx::PgPool,
    money: &Money,
    catalog: &Catalog,
    user_id: &str,
    request_id: &str,
    plan_id: &str,
    locale: &str,
    currency: &str,
    attribution: Option<&Attribution>,
    return_to: Option<&str>,
    _consent: Consent,
) -> Result<String, CheckoutError> {
    let body = prepare_session(
        money,
        catalog,
        user_id,
        plan_id,
        locale,
        currency,
        attribution,
        return_to,
    )
    .await?;
    let session = super::attempts::create(pool, money, user_id, request_id, &body)
        .await
        .map_err(|error| match error {
            super::attempts::Error::InvalidRequest => CheckoutError::InvalidRequest,
            super::attempts::Error::RequestChanged => CheckoutError::AttemptChanged,
            super::attempts::Error::Pending => CheckoutError::AttemptPending,
            _ => CheckoutError::Failed("checkout_unavailable".into()),
        })?;
    session
        .get("url")
        .and_then(Value::as_str)
        .filter(|url| !url.is_empty())
        .map(str::to_owned)
        .ok_or_else(|| CheckoutError::Failed("checkout_unavailable".into()))
}

#[allow(clippy::too_many_arguments)]
async fn prepare_session(
    money: &Money,
    catalog: &Catalog,
    user_id: &str,
    plan_id: &str,
    locale: &str,
    currency: &str,
    attribution: Option<&Attribution>,
    return_to: Option<&str>,
) -> Result<Value, CheckoutError> {
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
    Ok(session_body(
        money,
        user_id,
        plan_id,
        &plan.price_key,
        locale,
        currency.as_deref(),
        attribution,
        return_to,
    ))
}
