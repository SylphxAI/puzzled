//! Native Connect BillingService (Puzzled Plus), backed by Sylphx Money.
//!
//! Identity comes from the Platform JWT; guests can read the price list only.
//! Prices, checkout, portal, subscriptions and access are Money's; Puzzled
//! keeps the family membership list and the checkout consent.

use std::sync::Arc;

use connectrpc::{
    ConnectError, ErrorCode, RequestContext, Response, ServiceRequest, ServiceResult,
};
use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;
use sqlx::PgPool;
use tracing::warn;

use super::identity::{require_identity, require_purchase_allowed};
use super::state::AppState;
use crate::capabilities::billing::adapters::billing_db::{self, JoinRefused};
use crate::capabilities::billing::service;
use crate::capabilities::identity_access::adapters::{
    auth_session, auth_subjects, platform_jwt::VerifiedIdentity,
};
use crate::capabilities::money::{
    access as money_access, checkout as money_checkout, claim_cookie, client::Subscription,
    consent_db, pricing, CheckoutError, Money, MoneyError,
};
use crate::capabilities::preferences::adapters::attribution_db::attribution_for_user;
use crate::proto::puzzled::v1::{
    BillingService, CancelSubscriptionRequest, CancelSubscriptionResponse, ClaimCheckoutRequest,
    ClaimCheckoutResponse, CreateCheckoutAttemptRequest, CreateCheckoutAttemptResponse,
    CreateCheckoutRequest, CreateCheckoutResponse, CreatePortalRequest, CreatePortalResponse,
    Family, FamilyMember, GetCheckoutRequest, GetCheckoutResponse, GetSubscriptionRequest,
    GetSubscriptionResponse, JoinFamilyRequest, JoinFamilyResponse, LeaveFamilyRequest,
    LeaveFamilyResponse, ListPlansRequest, ListPlansResponse, Plan, PlanPrice,
    RemoveFamilyMemberRequest, RemoveFamilyMemberResponse, ResetFamilyInviteRequest,
    ResetFamilyInviteResponse, ResumeSubscriptionRequest, ResumeSubscriptionResponse,
};
use puzzled_core::attribution::Attribution;

// Family references are scoped to one owner and never contain an account id.
fn family_handle(secret: &str, owner: &str, member: &str) -> Result<String, ConnectError> {
    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes())
        .map_err(|_| ConnectError::new(ErrorCode::Unavailable, "family_unavailable"))?;
    mac.update(b"puzzled:family-member:v1\0");
    mac.update(owner.as_bytes());
    mac.update(b"\0");
    mac.update(member.as_bytes());
    let tag = mac.finalize().into_bytes();
    Ok(format!(
        "fm_{}",
        tag.iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>()
    ))
}

fn family_handle_key() -> Result<String, ConnectError> {
    // Existing product-scoped key; domain separation prevents token reuse.
    std::env::var("EMAIL_UNSUBSCRIBE_SECRET")
        .ok()
        .filter(|key| !key.is_empty())
        .ok_or_else(|| ConnectError::new(ErrorCode::Unavailable, "family_unavailable"))
}

fn resolve_family_handle<'a>(
    secret: &str,
    owner: &str,
    handle: &str,
    members: &'a [(String, Option<String>, i64)],
) -> Result<Option<&'a str>, ConnectError> {
    for (member, _, _) in members {
        if family_handle(secret, owner, member)? == handle {
            return Ok(Some(member.as_str()));
        }
    }
    Ok(None)
}

#[derive(Clone)]
pub struct BillingConnectService {
    state: AppState,
}

fn internal(context: &'static str) -> impl FnOnce(String) -> ConnectError {
    move |error| {
        warn!(%error, context, "billing failed");
        ConnectError::new(ErrorCode::Unavailable, context)
    }
}

/// A fresh family invite code: 10 characters, no look-alike letters.
fn new_invite_code() -> String {
    const ALPHABET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    uuid::Uuid::new_v4()
        .as_bytes()
        .iter()
        .take(10)
        .map(|b| ALPHABET[usize::from(*b) % ALPHABET.len()] as char)
        .collect()
}

impl BillingConnectService {
    pub fn new(state: AppState) -> Self {
        Self { state }
    }

    /// Money and the database, or `sales_closed`.
    fn store(&self) -> Result<(&PgPool, &Money), ConnectError> {
        match (&self.state.pool, &self.state.money) {
            (Some(pool), Some(money)) => Ok((pool, money)),
            _ => Err(ConnectError::new(
                ErrorCode::FailedPrecondition,
                "sales_closed",
            )),
        }
    }

    /// The database alone, for what needs no processor call (family, Money).
    fn pool(&self) -> Result<&PgPool, ConnectError> {
        self.state
            .pool
            .as_ref()
            .ok_or_else(|| ConnectError::new(ErrorCode::FailedPrecondition, "sales_closed"))
    }

    async fn player_subjects(&self, user_id: &str) -> Vec<String> {
        match &self.state.pool {
            Some(pool) => auth_subjects::money_subjects_for_player(pool, user_id).await,
            None => vec![user_id.to_string()],
        }
    }

    async fn player_subscriptions(
        &self,
        money: &Money,
        user_id: &str,
    ) -> Result<Vec<(String, Subscription)>, MoneyError> {
        let mut out: Vec<(String, Subscription)> = Vec::new();
        for subj in self.player_subjects(user_id).await {
            for sub in money.subscriptions(&subj).await? {
                if !out.iter().any(|(_, existing)| existing.id == sub.id) {
                    out.push((subj.clone(), sub));
                }
            }
        }
        Ok(out)
    }

    /// Does `owner` hold a family plan now, in Money?
    async fn family_active(&self, owner: &str) -> bool {
        let Some(money) = &self.state.money else {
            return false;
        };
        for subj in self.player_subjects(owner).await {
            if money_access::family_active(money, &subj).await {
                return true;
            }
        }
        false
    }

    /// Seats on `owner`'s plan, from Money's `seats` limit. `Err`: Money could
    /// not answer (or the owner holds no `seats` limit), so nothing is decided
    /// from a guess.
    async fn max_members(&self, owner: &str) -> Result<u32, ConnectError> {
        let unavailable = || ConnectError::new(ErrorCode::Unavailable, "seats_unavailable");
        let money = self.state.money.as_ref().ok_or_else(unavailable)?;
        for subj in self.player_subjects(owner).await {
            if let Some(seats) = money_access::seats(money, &subj).await.ok().flatten() {
                return Ok(seats);
            }
        }
        Err(unavailable())
    }

    /// A Money checkout: the buyer's consent is recorded, then the server
    /// creates the session and the browser is sent to its hosted page.
    #[allow(clippy::too_many_arguments)]
    async fn money_checkout(
        &self,
        money: &Money,
        identity: &VerifiedIdentity,
        req: &CreateCheckoutRequest,
        landing: Option<&Attribution>,
        return_to: Option<&str>,
        request_id: Option<&str>,
    ) -> Result<String, CheckoutError> {
        let consent = money_checkout::Consent::require(req.immediate_supply_consent)?;
        let pool = self
            .state
            .pool
            .as_ref()
            .ok_or_else(|| CheckoutError::Failed("no database".into()))?;
        let plan_id = req.plan_id.trim();
        let locale = req.locale.trim();
        let catalog = money
            .catalog()
            .await
            .map_err(|e| CheckoutError::Failed(e.to_string()))?;
        let plan = pricing::plan(&catalog, plan_id).ok_or(CheckoutError::PlanNotOnSale)?;
        let stored = attribution_for_user(pool, &identity.user_id)
            .await
            .map_err(CheckoutError::Failed)?;
        consent_db::record(pool, &identity.user_id, plan_id, &plan.price_key, locale)
            .await
            .map_err(CheckoutError::Failed)?;
        if let Some(request_id) = request_id {
            return money_checkout::create_retained_session(
                pool,
                money,
                &catalog,
                &identity.user_id,
                request_id,
                plan_id,
                locale,
                &req.currency,
                Attribution::for_checkout(stored.as_ref(), landing).as_ref(),
                return_to,
                consent,
            )
            .await;
        }
        money_checkout::create_session(
            money,
            &catalog,
            &identity.user_id,
            plan_id,
            locale,
            &req.currency,
            Attribution::for_checkout(stored.as_ref(), landing).as_ref(),
            return_to,
            consent,
        )
        .await
    }

    async fn checkout_url(
        &self,
        ctx: RequestContext,
        req: CreateCheckoutRequest,
        request_id: Option<&str>,
    ) -> Result<String, ConnectError> {
        let identity = Self::account(&ctx)?;
        require_purchase_allowed(&identity)?;
        let cookie_attr = ctx
            .headers()
            .get_all(axum::http::header::COOKIE)
            .iter()
            .filter_map(|value| value.to_str().ok())
            .find_map(puzzled_core::attribution::from_cookie_header);
        let session_attr = ctx
            .headers()
            .get("x-puzzled-attribution")
            .and_then(|value| value.to_str().ok())
            .map(str::trim)
            .and_then(Attribution::from_cookie);
        let landing = merge_landing_attribution(cookie_attr, session_attr);
        let return_to = ctx
            .headers()
            .get("x-puzzled-return-to")
            .and_then(|value| value.to_str().ok())
            .and_then(money_checkout::safe_return_to);
        let (_, money) = self.store()?;
        let started = self
            .money_checkout(
                money,
                &identity,
                &req,
                landing.as_ref(),
                return_to.as_deref(),
                request_id,
            )
            .await;
        started.map_err(Self::map_checkout_error)
    }

    fn map_checkout_error(err: CheckoutError) -> ConnectError {
        match err {
            CheckoutError::ConsentRequired => {
                ConnectError::new(ErrorCode::FailedPrecondition, "consent_required")
            }
            CheckoutError::PlanNotOnSale => {
                ConnectError::new(ErrorCode::FailedPrecondition, "plan_not_on_sale")
            }
            CheckoutError::AlreadySubscribed => {
                ConnectError::new(ErrorCode::AlreadyExists, "already_subscribed")
            }
            CheckoutError::InvalidRequest => {
                ConnectError::new(ErrorCode::InvalidArgument, "request_id_invalid")
            }
            CheckoutError::AttemptChanged => {
                ConnectError::new(ErrorCode::AlreadyExists, "checkout_request_changed")
            }
            CheckoutError::AttemptPending => {
                ConnectError::new(ErrorCode::Unavailable, "checkout_pending")
            }
            CheckoutError::Failed(error) => internal("checkout_unavailable")(error),
        }
    }

    /// Signed-in account when present; `Ok(None)` for an unauthenticated cold guest;
    /// `Err` when an explicit invalid bearer/JWT credential was supplied.
    fn optional_account(ctx: &RequestContext) -> Result<Option<VerifiedIdentity>, ConnectError> {
        match super::identity::verify(ctx.headers()) {
            Ok(identity) if service::is_account_id(&identity.user_id) => Ok(Some(identity)),
            Ok(_) => Ok(None),
            Err(err) if err.message.as_deref() == Some("identity_required") => Ok(None),
            Err(err) => Err(err),
        }
    }

    async fn record_claimed_consent(
        pool: &PgPool,
        money: &Money,
        user_id: &str,
        plan_id: Option<String>,
        price_key: Option<String>,
        locale: &str,
    ) {
        let Some(pid) = plan_id.filter(|s| !s.is_empty()) else {
            return;
        };
        let resolved_price = match price_key.filter(|s| !s.is_empty()) {
            Some(pk) => Some(pk),
            None => money
                .catalog()
                .await
                .ok()
                .and_then(|c| pricing::plan(&c, &pid).map(|p| p.price_key)),
        };
        if let Some(pk) = resolved_price {
            let locale_val = if locale.is_empty() { "en-US" } else { locale };
            if let Err(error) = consent_db::record(pool, user_id, &pid, &pk, locale_val).await {
                warn!(%error, "post-claim consent audit insert failed");
            }
        }
    }

    /// A Platform account; a guest-day id cannot hold a subscription.
    fn account(ctx: &RequestContext) -> Result<VerifiedIdentity, ConnectError> {
        let identity = require_identity(ctx)?;
        if service::is_account_id(&identity.user_id) {
            Ok(identity)
        } else {
            Err(ConnectError::new(
                ErrorCode::Unauthenticated,
                "account_required",
            ))
        }
    }

    async fn family_view(
        &self,
        pool: &PgPool,
        owner: &str,
        viewer_is_owner: bool,
    ) -> Result<Family, ConnectError> {
        let mut invite_code = billing_db::family_invite_code(pool, owner)
            .await
            .map_err(internal("family_unavailable"))?;
        if viewer_is_owner && invite_code.is_none() {
            let code = new_invite_code();
            billing_db::set_family_invite_code(pool, owner, &code)
                .await
                .map_err(internal("family_unavailable"))?;
            invite_code = Some(code);
        }
        let owner_name = billing_db::display_name(pool, owner)
            .await
            .map_err(internal("family_unavailable"))?;
        let handle_key = family_handle_key()?;
        let mut members = vec![FamilyMember {
            user_id: family_handle(&handle_key, owner, owner)?,
            display_name: owner_name.unwrap_or_default(),
            owner: true,
            ..Default::default()
        }];
        for (user_id, name, joined_at_ms) in billing_db::family_members(pool, owner)
            .await
            .map_err(internal("family_unavailable"))?
        {
            members.push(FamilyMember {
                user_id: family_handle(&handle_key, owner, &user_id)?,
                display_name: name.unwrap_or_default(),
                owner: false,
                joined_at_ms,
                ..Default::default()
            });
        }
        Ok(Family {
            role: if viewer_is_owner { "owner" } else { "member" }.to_string(),
            members,
            // Shown only; 0 while Money cannot say.
            max_members: self.max_members(owner).await.unwrap_or(0),
            invite_code: if viewer_is_owner { invite_code } else { None },
            ..Default::default()
        })
    }
}

#[allow(refining_impl_trait_internal, refining_impl_trait_reachable)]
impl BillingService for BillingConnectService {
    async fn list_plans(
        &self,
        _ctx: RequestContext,
        _request: ServiceRequest<'_, ListPlansRequest>,
    ) -> ServiceResult<ListPlansResponse> {
        let mut response = ListPlansResponse {
            sales_open: false,
            ..Default::default()
        };
        let Some(money) = &self.state.money else {
            return Response::ok(response);
        };
        // Prices are Money's `catalogs/default`; nothing is priced here.
        // Money unreachable: no plans and sales closed ("Purchases open
        // shortly"), never an error page.
        let Ok(catalog) = money.catalog().await else {
            return Response::ok(response);
        };
        let sold = pricing::plans(&catalog);
        // The family size is the catalogue's `seats` limit, not a number
        // written here.
        response.family_max_members = sold
            .iter()
            .filter(|plan| plan.family)
            .map(|plan| plan.seats)
            .max()
            .unwrap_or(0);
        response.plans = sold
            .into_iter()
            .map(|plan| Plan {
                id: plan.plan_id,
                family: plan.family,
                interval: plan.interval,
                trial_days: i32::try_from(plan.trial_days).unwrap_or(0),
                access_days: i32::try_from(plan.access_days).unwrap_or(0),
                prices: plan
                    .prices
                    .into_iter()
                    .map(|(currency, unit_amount_minor)| PlanPrice {
                        currency,
                        unit_amount_minor,
                        ..Default::default()
                    })
                    .collect(),
                ..Default::default()
            })
            .collect();
        response.sales_open = !response.plans.is_empty();
        Response::ok(response)
    }

    async fn get_subscription(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, GetSubscriptionRequest>,
    ) -> ServiceResult<GetSubscriptionResponse> {
        let identity = require_identity(&ctx)?;
        let mut response = GetSubscriptionResponse {
            sales_open: self.state.sales_open().await,
            source: "none".to_string(),
            ..Default::default()
        };
        let (Some(pool), Some(money)) = (self.state.pool.as_ref(), self.state.money.as_ref())
        else {
            return Response::ok(response);
        };
        if !service::is_account_id(&identity.user_id) {
            return Response::ok(response);
        }
        if request.to_owned_message().refresh {
            for subj in self.player_subjects(&identity.user_id).await {
                money.refresh_grants(&subj);
            }
        }
        let entitlement = service::access(pool, Some(money), &identity.user_id)
            .await
            .map_err(internal("subscription_unavailable"))?;
        response.entitled = entitlement.entitled;
        if let Some(owner) = &entitlement.family_owner {
            response.source = "family".to_string();
            response.family = self.family_view(pool, owner, false).await?.into();
        } else if let Some(ends) = entitlement.trial_ends_ms {
            response.source = "trial".to_string();
            response.trial_ends_ms = Some(ends);
        } else if entitlement.entitled {
            response.source = "plus".to_string();
            // The subscription behind it, when there is one (a manual grant
            // has none). A read that fails leaves the access answer standing.
            if let Ok(subs) = self.player_subscriptions(money, &identity.user_id).await {
                if let Some((_, sub)) = subs.iter().find(|(_, s)| s.live()) {
                    // A Tryit-referred account's first paid subscription is
                    // queued for Tryit (one row per account and event, so
                    // this is idempotent). Money sends Puzzled no webhook,
                    // so the page the buyer returns to is where it is
                    // noticed. Failing to queue never fails the read.
                    if let Err(error) = crate::capabilities::tryit_conversions::enqueue_purchase(
                        pool,
                        &identity.user_id,
                    )
                    .await
                    {
                        tracing::warn!(%error, "tryit purchase not queued");
                    }
                    let catalog = money.catalog().await.ok();
                    let plan = catalog.as_deref().and_then(|c| {
                        pricing::plans(c)
                            .into_iter()
                            .find(|p| sub.price_keys.contains(&p.price_key))
                    });
                    response.status = Some(sub.status.clone());
                    response.cancel_at_period_end = sub.cancel_at_period_end;
                    response.current_period_end_ms =
                        sub.current_period_end.map(|t| t.timestamp_millis());
                    response.subscription_trial_end_ms =
                        sub.trial_end.map(|t| t.timestamp_millis());
                    if let Some(plan) = plan {
                        response.plan_id = Some(plan.plan_id.clone());
                        if plan.family {
                            response.family = self
                                .family_view(pool, &identity.user_id, true)
                                .await?
                                .into();
                        }
                    }
                }
            }
        }
        // An observation is not admission. Never make the response wait on
        // metric storage or another Money answer; unknown answers are excluded.
        let observed_pool = pool.clone();
        let observed_money = money.clone();
        let observed_user = identity.user_id.clone();
        let paid = matches!(response.source.as_str(), "plus" | "family");
        tokio::spawn(async move {
            if observed_money
                .try_check(
                    &observed_user,
                    crate::capabilities::money::access::FEATURE_PLUS,
                )
                .await
                .is_ok()
            {
                crate::capabilities::metrics::audience(&observed_pool, &observed_user, paid).await;
            }
        });
        Response::ok(response)
    }

    async fn create_checkout(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, CreateCheckoutRequest>,
    ) -> ServiceResult<CreateCheckoutResponse> {
        let req = request.to_owned_message();
        if Self::optional_account(&ctx)?.is_some() {
            let url = self.checkout_url(ctx, req, None).await?;
            return Response::ok(CreateCheckoutResponse {
                url,
                ..Default::default()
            });
        }

        // Cold-guest checkout: record immediate-supply consent in Money's checkout
        // metadata, omit `subject` so Money allocates `guest:{id}`, and keep the
        // returned single-use `claim_secret` strictly in an HttpOnly cookie.
        let consent = money_checkout::Consent::require(req.immediate_supply_consent)
            .map_err(Self::map_checkout_error)?;
        let (_, money) = self.store()?;
        let cookie_attr = ctx
            .headers()
            .get_all(axum::http::header::COOKIE)
            .iter()
            .filter_map(|value| value.to_str().ok())
            .find_map(puzzled_core::attribution::from_cookie_header);
        let session_attr = ctx
            .headers()
            .get("x-puzzled-attribution")
            .and_then(|value| value.to_str().ok())
            .map(str::trim)
            .and_then(Attribution::from_cookie);
        let landing = merge_landing_attribution(cookie_attr, session_attr);
        let return_to = ctx
            .headers()
            .get("x-puzzled-return-to")
            .and_then(|value| value.to_str().ok())
            .and_then(money_checkout::safe_return_to);
        let catalog = money
            .catalog()
            .await
            .map_err(|e| internal("checkout_unavailable")(e.to_string()))?;
        let guest = money_checkout::create_guest_session(
            money,
            &catalog,
            req.plan_id.trim(),
            req.locale.trim(),
            &req.currency,
            landing.as_ref(),
            return_to.as_deref(),
            consent,
        )
        .await
        .map_err(Self::map_checkout_error)?;

        let reply = CreateCheckoutResponse {
            url: guest.created.url,
            ..Default::default()
        };
        if let Some(secret) = guest.created.claim_secret {
            let entries = claim_cookie::append_entry(
                claim_cookie::read_entries(ctx.headers()),
                claim_cookie::ClaimCookieEntry {
                    s: guest.created.processor_session_id,
                    chk: guest.created.session_id,
                    sec: secret,
                    plan: guest.plan_id,
                    price: guest.price_key,
                    loc: guest.locale,
                },
            );
            let secure = money.public_url().starts_with("https://");
            if let Ok(cookie_header) = claim_cookie::format_set_cookie(&entries, secure) {
                if let Ok(resp) = Response::new(reply.clone())
                    .try_with_header(axum::http::header::SET_COOKIE, cookie_header)
                {
                    return Ok(resp);
                }
            }
        }
        Response::ok(reply)
    }

    async fn create_checkout_attempt(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, CreateCheckoutAttemptRequest>,
    ) -> ServiceResult<CreateCheckoutAttemptResponse> {
        let req = request.to_owned_message();
        if uuid::Uuid::parse_str(&req.request_id).is_err() {
            return Err(ConnectError::new(
                ErrorCode::InvalidArgument,
                "request_id_invalid",
            ));
        }
        let url = self
            .checkout_url(
                ctx,
                CreateCheckoutRequest {
                    plan_id: req.plan_id,
                    locale: req.locale,
                    currency: req.currency,
                    immediate_supply_consent: req.immediate_supply_consent,
                    ..Default::default()
                },
                Some(&req.request_id),
            )
            .await?;
        Response::ok(CreateCheckoutAttemptResponse {
            url,
            ..Default::default()
        })
    }

    async fn get_checkout(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, GetCheckoutRequest>,
    ) -> ServiceResult<GetCheckoutResponse> {
        let identity = Self::account(&ctx)?;
        let (pool, money) = self.store()?;
        let req = request.to_owned_message();
        let fixture: Option<String> =
            sqlx::query_scalar("SELECT fixture_key FROM synthetic_fixtures WHERE user_id=$1::uuid")
                .bind(&identity.user_id)
                .fetch_optional(pool)
                .await
                .map_err(|_| ConnectError::new(ErrorCode::Unavailable, "checkout_unavailable"))?;
        let attempt = crate::capabilities::money::attempts::get(
            pool,
            money,
            &identity.user_id,
            (!req.request_id.is_empty()).then_some(req.request_id.as_str()),
        )
        .await
        .map_err(|error| {
            ConnectError::new(
                if matches!(
                    error,
                    crate::capabilities::money::attempts::Error::InvalidRequest
                ) {
                    ErrorCode::InvalidArgument
                } else {
                    ErrorCode::Unavailable
                },
                "checkout_unavailable",
            )
        })?;
        let mut response = GetCheckoutResponse {
            state: "absent".into(),
            synthetic_fixture: fixture.unwrap_or_default(),
            ..Default::default()
        };
        if let Some(attempt) = attempt {
            response.request_id = attempt.request_id;
            response.state = attempt.state;
            if let Some(session) = attempt.session {
                let text = |key| {
                    session
                        .get(key)
                        .and_then(serde_json::Value::as_str)
                        .unwrap_or_default()
                        .to_owned()
                };
                response.money_session_name = text("name");
                response.url = text("url");
                response.processor_session_id = text("processor_session_id");
                response.session_state = text("state");
            }
        }
        Response::ok(response)
    }

    async fn claim_checkout(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, ClaimCheckoutRequest>,
    ) -> ServiceResult<ClaimCheckoutResponse> {
        let identity = Self::account(&ctx)?;
        require_purchase_allowed(&identity)?;
        let (pool, money) = self.store()?;
        let req = request.to_owned_message();
        let requested_id = req.checkout_session_id.trim().to_string();
        let req_locale = req.locale.trim().to_string();
        let entries = claim_cookie::read_entries(ctx.headers());
        let session_tok = auth_session::session_token(ctx.headers());
        let secure = money.public_url().starts_with("https://");

        if requested_id.is_empty() {
            if entries.is_empty() {
                return Response::ok(ClaimCheckoutResponse {
                    claimed: false,
                    ..Default::default()
                });
            }
            let mut remaining = Vec::new();
            let mut any_claimed = false;
            for entry in &entries {
                let lookup_id = entry.lookup_id();
                if lookup_id.is_empty() {
                    continue;
                }
                match money
                    .claim_checkout_session(
                        lookup_id,
                        &identity.user_id,
                        Some(entry.sec.as_str()),
                        session_tok.as_deref(),
                    )
                    .await
                {
                    Ok(claimed) => {
                        any_claimed = true;
                        let loc = if !entry.loc.is_empty() {
                            entry.loc.as_str()
                        } else {
                            req_locale.as_str()
                        };
                        Self::record_claimed_consent(
                            pool,
                            money,
                            &identity.user_id,
                            (!entry.plan.is_empty())
                                .then(|| entry.plan.clone())
                                .or(claimed.plan_id),
                            (!entry.price.is_empty()).then(|| entry.price.clone()),
                            loc,
                        )
                        .await;
                    }
                    Err(MoneyError::Refused {
                        status: 403 | 404 | 409,
                        ..
                    }) => {
                        // Terminal for this secret (consumed, expired, or bound elsewhere): prune it.
                    }
                    Err(MoneyError::Refused { .. } | MoneyError::Unavailable(_)) => {
                        remaining.push(entry.clone());
                    }
                }
            }
            let reply = ClaimCheckoutResponse {
                claimed: any_claimed,
                ..Default::default()
            };
            if remaining.len() != entries.len() {
                if let Ok(cookie_header) = claim_cookie::format_set_cookie(&remaining, secure) {
                    if let Ok(resp) = Response::new(reply.clone())
                        .try_with_header(axum::http::header::SET_COOKIE, cookie_header)
                    {
                        return Ok(resp);
                    }
                }
            }
            return Response::ok(reply);
        }

        if requested_id.len() > 128
            || !requested_id
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
        {
            return Err(ConnectError::new(
                ErrorCode::InvalidArgument,
                "checkout_session_invalid",
            ));
        }

        let matched = claim_cookie::find_entry(&entries, &requested_id).cloned();
        let outcome = money
            .claim_checkout_session(
                &requested_id,
                &identity.user_id,
                matched.as_ref().map(|e| e.sec.as_str()),
                session_tok.as_deref(),
            )
            .await;

        match outcome {
            Ok(claimed) => {
                let loc = matched
                    .as_ref()
                    .map(|e| e.loc.as_str())
                    .filter(|s| !s.is_empty())
                    .unwrap_or(req_locale.as_str());
                Self::record_claimed_consent(
                    pool,
                    money,
                    &identity.user_id,
                    matched
                        .as_ref()
                        .and_then(|e| (!e.plan.is_empty()).then(|| e.plan.clone()))
                        .or(claimed.plan_id),
                    matched
                        .as_ref()
                        .and_then(|e| (!e.price.is_empty()).then(|| e.price.clone())),
                    loc,
                )
                .await;
                let reply = ClaimCheckoutResponse {
                    claimed: true,
                    ..Default::default()
                };
                if matched.is_some() {
                    let updated = claim_cookie::remove_entry(entries, &requested_id);
                    if let Ok(cookie_header) = claim_cookie::format_set_cookie(&updated, secure) {
                        if let Ok(resp) = Response::new(reply.clone())
                            .try_with_header(axum::http::header::SET_COOKIE, cookie_header)
                        {
                            return Ok(resp);
                        }
                    }
                }
                Response::ok(reply)
            }
            Err(MoneyError::Refused { status: 409, .. }) => Err(ConnectError::new(
                ErrorCode::AlreadyExists,
                "checkout_already_claimed",
            )),
            Err(MoneyError::Refused { status: 404, .. }) => {
                Err(ConnectError::new(ErrorCode::NotFound, "checkout_not_found"))
            }
            Err(MoneyError::Refused {
                status: 401 | 403, ..
            }) => Err(ConnectError::new(
                ErrorCode::PermissionDenied,
                "claim_denied",
            )),
            Err(MoneyError::Refused {
                status: 400 | 422, ..
            }) => Err(ConnectError::new(
                ErrorCode::InvalidArgument,
                "checkout_session_invalid",
            )),
            Err(error) => Err(internal("claim_unavailable")(error.to_string())),
        }
    }

    async fn create_portal(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, CreatePortalRequest>,
    ) -> ServiceResult<CreatePortalResponse> {
        let identity = Self::account(&ctx)?;
        require_purchase_allowed(&identity)?;
        let (_, money) = self.store()?;
        let req = request.to_owned_message();
        let subs = self
            .player_subscriptions(money, &identity.user_id)
            .await
            .map_err(|e| internal("portal_unavailable")(e.to_string()))?;
        let Some((subj, sub)) = subs.iter().find(|(_, s)| s.live()).or_else(|| subs.first()) else {
            return Err(ConnectError::new(
                ErrorCode::FailedPrecondition,
                "no_billing_account",
            ));
        };
        let back = format!(
            "{}{}/settings/subscription",
            money.public_url(),
            money_checkout::locale_prefix(req.locale.trim())
        );
        let url = money
            .portal_url_for_subscription(subj, Some(&sub.id), &back)
            .await
            .map_err(|e| internal("portal_unavailable")(e.to_string()))?;
        Response::ok(CreatePortalResponse {
            url,
            ..Default::default()
        })
    }

    async fn cancel_subscription(
        &self,
        ctx: RequestContext,
        _request: ServiceRequest<'_, CancelSubscriptionRequest>,
    ) -> ServiceResult<CancelSubscriptionResponse> {
        let identity = Self::account(&ctx)?;
        let (_, money) = self.store()?;
        let subs = self
            .player_subscriptions(money, &identity.user_id)
            .await
            .map_err(|e| internal("cancel_unavailable")(e.to_string()))?;
        let Some((_, sub)) = subs.iter().find(|(_, s)| s.renews()) else {
            return Err(ConnectError::new(
                ErrorCode::FailedPrecondition,
                "no_subscription",
            ));
        };
        // Access runs to the end of the paid period; no refund is promised.
        money
            .cancel_at_period_end(&sub.id)
            .await
            .map_err(|e| internal("cancel_unavailable")(e.to_string()))?;
        Response::ok(CancelSubscriptionResponse {
            access_ends_at_ms: sub.current_period_end.map_or(0, |t| t.timestamp_millis()),
            ..Default::default()
        })
    }

    async fn resume_subscription(
        &self,
        ctx: RequestContext,
        _request: ServiceRequest<'_, ResumeSubscriptionRequest>,
    ) -> ServiceResult<ResumeSubscriptionResponse> {
        let identity = Self::account(&ctx)?;
        require_purchase_allowed(&identity)?;
        let (_, money) = self.store()?;
        let subs = self
            .player_subscriptions(money, &identity.user_id)
            .await
            .map_err(|e| internal("resume_unavailable")(e.to_string()))?;
        let Some((_, sub)) = subs
            .iter()
            .find(|(_, s)| s.live() && s.cancel_at_period_end)
        else {
            return Err(ConnectError::new(
                ErrorCode::FailedPrecondition,
                "nothing_to_resume",
            ));
        };
        money
            .resume(&sub.id)
            .await
            .map_err(|e| internal("resume_unavailable")(e.to_string()))?;
        Response::ok(ResumeSubscriptionResponse::default())
    }

    async fn join_family(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, JoinFamilyRequest>,
    ) -> ServiceResult<JoinFamilyResponse> {
        let identity = Self::account(&ctx)?;
        let pool = self.pool()?;
        let code = request
            .to_owned_message()
            .invite_code
            .trim()
            .to_ascii_uppercase();
        let not_found = || ConnectError::new(ErrorCode::NotFound, "invite_not_found");
        if code.is_empty() || code.len() > 32 {
            return Err(not_found());
        }
        let owner = billing_db::family_owner_by_code(pool, &code)
            .await
            .map_err(internal("family_unavailable"))?
            .ok_or_else(not_found)?;
        if owner == identity.user_id {
            return Err(ConnectError::new(
                ErrorCode::FailedPrecondition,
                "family_owner",
            ));
        }
        if !self.family_active(&owner).await {
            return Err(ConnectError::new(
                ErrorCode::FailedPrecondition,
                "family_plan_inactive",
            ));
        }
        match billing_db::join_family(
            pool,
            &owner,
            &identity.user_id,
            self.max_members(&owner).await?,
        )
        .await
        .map_err(internal("family_unavailable"))?
        {
            Ok(()) => Response::ok(JoinFamilyResponse::default()),
            Err(JoinRefused::Full) => Err(ConnectError::new(
                ErrorCode::ResourceExhausted,
                "family_full",
            )),
            Err(JoinRefused::AlreadyInFamily) => Err(ConnectError::new(
                ErrorCode::AlreadyExists,
                "already_in_family",
            )),
        }
    }

    async fn leave_family(
        &self,
        ctx: RequestContext,
        _request: ServiceRequest<'_, LeaveFamilyRequest>,
    ) -> ServiceResult<LeaveFamilyResponse> {
        let identity = Self::account(&ctx)?;
        let pool = self.pool()?;
        billing_db::remove_family_member(pool, None, &identity.user_id)
            .await
            .map_err(internal("family_unavailable"))?;
        Response::ok(LeaveFamilyResponse::default())
    }

    async fn remove_family_member(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, RemoveFamilyMemberRequest>,
    ) -> ServiceResult<RemoveFamilyMemberResponse> {
        let identity = Self::account(&ctx)?;
        let pool = self.pool()?;
        let handle = request.to_owned_message().user_id;
        let handle_key = family_handle_key()?;
        let members = billing_db::family_members(pool, &identity.user_id)
            .await
            .map_err(internal("family_unavailable"))?;
        let member = resolve_family_handle(&handle_key, &identity.user_id, &handle, &members)?
            .ok_or_else(|| ConnectError::new(ErrorCode::NotFound, "member_not_found"))?;
        if billing_db::remove_family_member(pool, Some(&identity.user_id), member)
            .await
            .map_err(internal("family_unavailable"))?
        {
            Response::ok(RemoveFamilyMemberResponse::default())
        } else {
            Err(ConnectError::new(ErrorCode::NotFound, "member_not_found"))
        }
    }

    async fn reset_family_invite(
        &self,
        ctx: RequestContext,
        _request: ServiceRequest<'_, ResetFamilyInviteRequest>,
    ) -> ServiceResult<ResetFamilyInviteResponse> {
        let identity = Self::account(&ctx)?;
        let pool = self.pool()?;
        if !self.family_active(&identity.user_id).await {
            return Err(ConnectError::new(
                ErrorCode::FailedPrecondition,
                "family_plan_inactive",
            ));
        }
        let code = new_invite_code();
        billing_db::set_family_invite_code(pool, &identity.user_id, &code)
            .await
            .map_err(internal("family_unavailable"))?;
        Response::ok(ResetFamilyInviteResponse {
            invite_code: code,
            ..Default::default()
        })
    }
}

pub fn billing_connect_service(state: AppState) -> Arc<BillingConnectService> {
    Arc::new(BillingConnectService::new(state))
}

/// Merge the durable attribution cookie with same-tab session attribution
/// (`x-puzzled-attribution`) so ad click ids and UTMs survive sign-in even
/// before optional marketing cookie consent is settled.
fn merge_landing_attribution(
    cookie_attr: Option<Attribution>,
    session_attr: Option<Attribution>,
) -> Option<Attribution> {
    match (cookie_attr, session_attr) {
        (None, None) => None,
        (Some(cookie), None) => Some(cookie),
        (None, Some(session)) => Some(session),
        (Some(mut cookie), Some(session)) => {
            let session_has_click = session.has_click_id();
            if cookie.source.is_none() {
                cookie.source = session.source;
            }
            if cookie.medium.is_none() {
                cookie.medium = session.medium;
            }
            if cookie.campaign.is_none() {
                cookie.campaign = session.campaign;
            }
            if cookie.term.is_none() {
                cookie.term = session.term;
            }
            if cookie.content.is_none() {
                cookie.content = session.content;
            }
            if cookie.referral.is_none() {
                cookie.referral = session.referral;
            }
            if !cookie.has_click_id() && session_has_click {
                cookie.gclid = session.gclid;
                cookie.gbraid = session.gbraid;
                cookie.wbraid = session.wbraid;
                cookie.fbclid = session.fbclid;
            }
            Some(cookie)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::new_invite_code;

    use super::merge_landing_attribution;
    use puzzled_core::attribution::Attribution;

    #[test]
    fn invite_codes_are_ten_unambiguous_characters() {
        let code = new_invite_code();
        assert_eq!(code.len(), 10);
        assert!(code
            .chars()
            .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit()));
        assert!(!code.contains(['O', '0', 'I', '1']));
        assert_ne!(code, new_invite_code());
    }

    #[test]
    fn session_attribution_forwards_click_ids_when_cookie_is_absent_or_partial() {
        let session =
            Attribution::from_cookie("s%3Dgoogle%26m%3Dcpc%26g%3DCj0_session%26fb%3Dfb_1");
        let from_session_only = merge_landing_attribution(None, session.clone()).expect("session");
        assert_eq!(from_session_only.source.as_deref(), Some("google"));
        assert_eq!(from_session_only.gclid.as_deref(), Some("Cj0_session"));
        assert_eq!(from_session_only.fbclid.as_deref(), Some("fb_1"));

        let analytics_only_cookie = Attribution::from_cookie("s=tryit&m=referral");
        let merged = merge_landing_attribution(analytics_only_cookie, session).expect("merged");
        assert_eq!(merged.source.as_deref(), Some("tryit"));
        assert_eq!(merged.gclid.as_deref(), Some("Cj0_session"));
    }
}

#[cfg(test)]
mod family_reference_tests {
    use super::*;
    #[test]
    fn family_references_are_scoped_and_actions_accept_only_owned_handles(
    ) -> Result<(), ConnectError> {
        let rows = vec![("member-a".into(), Some("Player".into()), 0)];
        let handle = family_handle("test-key", "owner-a", "member-a")?;
        assert!(!handle.contains("member-a"));
        assert_eq!(
            resolve_family_handle("test-key", "owner-a", &handle, &rows)?,
            Some("member-a")
        );
        assert_eq!(
            resolve_family_handle("test-key", "owner-b", &handle, &rows)?,
            None
        );
        assert_eq!(
            resolve_family_handle("test-key", "owner-a", "member-a", &rows)?,
            None
        );
        assert_eq!(
            resolve_family_handle("test-key", "owner-a", "unknown", &rows)?,
            None
        );
        assert_eq!(
            resolve_family_handle("other-key", "owner-a", &handle, &rows)?,
            None
        );
        Ok(())
    }
}
