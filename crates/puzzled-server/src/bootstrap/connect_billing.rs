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
use crate::capabilities::identity_access::adapters::platform_jwt::VerifiedIdentity;
use crate::capabilities::money::{
    access as money_access, checkout as money_checkout, consent_db, pricing, CheckoutError, Money,
};
use crate::capabilities::preferences::adapters::attribution_db::attribution_for_user;
use crate::proto::puzzled::v1::{
    BillingService, CancelSubscriptionRequest, CancelSubscriptionResponse, CreateCheckoutRequest,
    CreateCheckoutResponse, CreatePortalRequest, CreatePortalResponse, Family, FamilyMember,
    GetSubscriptionRequest, GetSubscriptionResponse, JoinFamilyRequest, JoinFamilyResponse,
    LeaveFamilyRequest, LeaveFamilyResponse, ListPlansRequest, ListPlansResponse, Plan, PlanPrice,
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

    /// Does `owner` hold a family plan now, in Money?
    async fn family_active(&self, owner: &str) -> bool {
        match &self.state.money {
            Some(money) => money_access::family_active(money, owner).await,
            None => false,
        }
    }

    /// Seats on `owner`'s plan, from Money's `seats` limit. `Err`: Money could
    /// not answer (or the owner holds no `seats` limit), so nothing is decided
    /// from a guess.
    async fn max_members(&self, owner: &str) -> Result<u32, ConnectError> {
        let unavailable = || ConnectError::new(ErrorCode::Unavailable, "seats_unavailable");
        let money = self.state.money.as_ref().ok_or_else(unavailable)?;
        money_access::seats(money, owner)
            .await
            .ok()
            .flatten()
            .ok_or_else(unavailable)
    }

    /// A Money checkout: the buyer's consent is recorded, then the server
    /// creates the session and the browser is sent to its hosted page.
    async fn money_checkout(
        &self,
        money: &Money,
        identity: &VerifiedIdentity,
        req: &CreateCheckoutRequest,
        landing: Option<&Attribution>,
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
        money_checkout::create_session(
            money,
            &catalog,
            &identity.user_id,
            plan_id,
            locale,
            &req.currency,
            stored.as_ref().or(landing),
            consent,
        )
        .await
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
        _request: ServiceRequest<'_, GetSubscriptionRequest>,
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
            if let Ok(subs) = money.subscriptions(&identity.user_id).await {
                if let Some(sub) = subs.iter().find(|s| s.live()) {
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
        Response::ok(response)
    }

    async fn create_checkout(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, CreateCheckoutRequest>,
    ) -> ServiceResult<CreateCheckoutResponse> {
        let identity = Self::account(&ctx)?;
        require_purchase_allowed(&identity)?;
        let req = request.to_owned_message();
        let landing = ctx
            .headers()
            .get_all(axum::http::header::COOKIE)
            .iter()
            .filter_map(|value| value.to_str().ok())
            .find_map(puzzled_core::attribution::from_cookie_header);
        let (_, money) = self.store()?;
        let started = self
            .money_checkout(money, &identity, &req, landing.as_ref())
            .await;
        match started {
            Ok(url) => Response::ok(CreateCheckoutResponse {
                url,
                ..Default::default()
            }),
            Err(CheckoutError::ConsentRequired) => Err(ConnectError::new(
                ErrorCode::FailedPrecondition,
                "consent_required",
            )),
            Err(CheckoutError::PlanNotOnSale) => Err(ConnectError::new(
                ErrorCode::FailedPrecondition,
                "plan_not_on_sale",
            )),
            Err(CheckoutError::AlreadySubscribed) => Err(ConnectError::new(
                ErrorCode::AlreadyExists,
                "already_subscribed",
            )),
            Err(CheckoutError::Failed(error)) => Err(internal("checkout_unavailable")(error)),
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
        let subs = money
            .subscriptions(&identity.user_id)
            .await
            .map_err(|e| internal("portal_unavailable")(e.to_string()))?;
        if subs.is_empty() {
            return Err(ConnectError::new(
                ErrorCode::FailedPrecondition,
                "no_billing_account",
            ));
        }
        let back = format!(
            "{}{}/settings/subscription",
            money.public_url(),
            money_checkout::locale_prefix(req.locale.trim())
        );
        let url = money
            .portal_url(&identity.user_id, &back)
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
        let subs = money
            .subscriptions(&identity.user_id)
            .await
            .map_err(|e| internal("cancel_unavailable")(e.to_string()))?;
        let Some(sub) = subs.iter().find(|s| s.renews()) else {
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
        let subs = money
            .subscriptions(&identity.user_id)
            .await
            .map_err(|e| internal("resume_unavailable")(e.to_string()))?;
        let Some(sub) = subs.iter().find(|s| s.live() && s.cancel_at_period_end) else {
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

#[cfg(test)]
mod tests {
    use super::new_invite_code;

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
