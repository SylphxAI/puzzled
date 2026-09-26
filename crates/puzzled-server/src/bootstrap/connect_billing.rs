//! Native Connect BillingService (Puzzled Plus) and the Stripe webhook route.
//!
//! Identity comes from the Platform JWT; guests can read the price list only.
//! The webhook is the one non-Connect route: Stripe posts to it, the signature
//! is verified over the raw body, and each event is read back from Stripe.

use std::sync::Arc;

use axum::body::Bytes;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use chrono::Utc;
use connectrpc::{
    ConnectError, ErrorCode, RequestContext, Response, ServiceRequest, ServiceResult,
};
use sqlx::PgPool;
use tracing::warn;

use puzzled_core::billing_access::policy::{is_family_plan, CANCELLATION_DAYS, FAMILY_MAX_MEMBERS};

use super::identity::require_identity;
use super::state::AppState;
use crate::capabilities::billing::adapters::billing_db::{self, JoinRefused};
use crate::capabilities::billing::adapters::stripe::Stripe;
use crate::capabilities::billing::service::{self, CheckoutError};
use crate::capabilities::identity_access::adapters::platform_jwt::VerifiedIdentity;
use crate::proto::puzzled::v1::{
    BillingService, CancelSubscriptionRequest, CancelSubscriptionResponse, CreateCheckoutRequest,
    CreateCheckoutResponse, CreatePortalRequest, CreatePortalResponse, Family, FamilyMember,
    GetSubscriptionRequest, GetSubscriptionResponse, JoinFamilyRequest, JoinFamilyResponse,
    LeaveFamilyRequest, LeaveFamilyResponse, ListPlansRequest, ListPlansResponse, Plan, PlanPrice,
    RemoveFamilyMemberRequest, RemoveFamilyMemberResponse, ResetFamilyInviteRequest,
    ResetFamilyInviteResponse, ResumeSubscriptionRequest, ResumeSubscriptionResponse,
};

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

    /// Stripe and the database, or `sales_closed`.
    fn store(&self) -> Result<(&PgPool, &Stripe), ConnectError> {
        match (&self.state.pool, &self.state.stripe) {
            (Some(pool), Some(stripe)) => Ok((pool, stripe)),
            _ => Err(ConnectError::new(
                ErrorCode::FailedPrecondition,
                "sales_closed",
            )),
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
        let mut members = vec![FamilyMember {
            user_id: owner.to_string(),
            display_name: owner_name.unwrap_or_default(),
            owner: true,
            ..Default::default()
        }];
        for (user_id, name, joined_at_ms) in billing_db::family_members(pool, owner)
            .await
            .map_err(internal("family_unavailable"))?
        {
            members.push(FamilyMember {
                user_id,
                display_name: name.unwrap_or_default(),
                owner: false,
                joined_at_ms,
                ..Default::default()
            });
        }
        Ok(Family {
            role: if viewer_is_owner { "owner" } else { "member" }.to_string(),
            members,
            max_members: FAMILY_MAX_MEMBERS,
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
            family_max_members: FAMILY_MAX_MEMBERS,
            cancellation_days: CANCELLATION_DAYS,
            ..Default::default()
        };
        let Ok((_, stripe)) = self.store() else {
            return Response::ok(response);
        };
        let prices = stripe
            .prices()
            .await
            .map_err(internal("plans_unavailable"))?;
        response.sales_open = !prices.is_empty();
        response.plans = prices
            .into_iter()
            .map(|price| Plan {
                id: price.plan_id.to_string(),
                family: is_family_plan(price.plan_id),
                interval: price.interval,
                prices: price
                    .amounts
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
        Response::ok(response)
    }

    async fn get_subscription(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, GetSubscriptionRequest>,
    ) -> ServiceResult<GetSubscriptionResponse> {
        let identity = require_identity(&ctx)?;
        let req = request.to_owned_message();
        let mut response = GetSubscriptionResponse {
            sales_open: self.state.sales_open().await,
            source: "none".to_string(),
            ..Default::default()
        };
        let Ok((pool, stripe)) = self.store() else {
            return Response::ok(response);
        };
        if !service::is_account_id(&identity.user_id) {
            return Response::ok(response);
        }
        if req.refresh {
            service::sync_user(pool, stripe, &identity.user_id)
                .await
                .map_err(internal("subscription_unavailable"))?;
        }
        let entitlement = service::entitlement(pool, Some(stripe), &identity.user_id)
            .await
            .map_err(internal("subscription_unavailable"))?;
        response.entitled = entitlement.entitled;
        if let Some(own) = &entitlement.own {
            response.source = "plus".to_string();
            response.plan_id = Some(own.plan_id.clone());
            response.status = Some(own.status.clone());
            response.current_period_end_ms = Some(own.current_period_end_ms);
            response.cancel_at_period_end = own.cancel_at_period_end;
            response.refund_until_ms = entitlement
                .refund_until_ms
                .filter(|until| *until > Utc::now().timestamp_millis());
            if is_family_plan(&own.plan_id) {
                response.family = self
                    .family_view(pool, &identity.user_id, true)
                    .await?
                    .into();
            }
        } else if let Some(owner) = &entitlement.family_owner {
            response.source = "family".to_string();
            response.family = self.family_view(pool, owner, false).await?.into();
        }
        Response::ok(response)
    }

    async fn create_checkout(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, CreateCheckoutRequest>,
    ) -> ServiceResult<CreateCheckoutResponse> {
        let identity = Self::account(&ctx)?;
        let (pool, stripe) = self.store()?;
        let req = request.to_owned_message();
        match service::create_checkout(
            pool,
            stripe,
            &identity.user_id,
            identity.email.as_deref(),
            identity.display_name.as_deref(),
            req.plan_id.trim(),
            req.locale.trim(),
            &req.currency,
        )
        .await
        {
            Ok(url) => Response::ok(CreateCheckoutResponse {
                url,
                ..Default::default()
            }),
            Err(CheckoutError::UnknownPlan) => Err(ConnectError::new(
                ErrorCode::InvalidArgument,
                "unknown_plan",
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
        let (pool, stripe) = self.store()?;
        let req = request.to_owned_message();
        match service::create_portal(pool, stripe, &identity.user_id, req.locale.trim())
            .await
            .map_err(internal("portal_unavailable"))?
        {
            Some(url) => Response::ok(CreatePortalResponse {
                url,
                ..Default::default()
            }),
            None => Err(ConnectError::new(
                ErrorCode::FailedPrecondition,
                "no_billing_account",
            )),
        }
    }

    async fn cancel_subscription(
        &self,
        ctx: RequestContext,
        _request: ServiceRequest<'_, CancelSubscriptionRequest>,
    ) -> ServiceResult<CancelSubscriptionResponse> {
        let identity = Self::account(&ctx)?;
        let (pool, stripe) = self.store()?;
        match service::cancel(pool, stripe, &identity.user_id)
            .await
            .map_err(internal("cancel_unavailable"))?
        {
            Some(done) => Response::ok(CancelSubscriptionResponse {
                refunded: done.refunded,
                access_ends_at_ms: done.access_ends_at_ms,
                ..Default::default()
            }),
            None => Err(ConnectError::new(
                ErrorCode::FailedPrecondition,
                "no_subscription",
            )),
        }
    }

    async fn resume_subscription(
        &self,
        ctx: RequestContext,
        _request: ServiceRequest<'_, ResumeSubscriptionRequest>,
    ) -> ServiceResult<ResumeSubscriptionResponse> {
        let identity = Self::account(&ctx)?;
        let (pool, stripe) = self.store()?;
        if service::resume(pool, stripe, &identity.user_id)
            .await
            .map_err(internal("resume_unavailable"))?
        {
            Response::ok(ResumeSubscriptionResponse::default())
        } else {
            Err(ConnectError::new(
                ErrorCode::FailedPrecondition,
                "nothing_to_resume",
            ))
        }
    }

    async fn join_family(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, JoinFamilyRequest>,
    ) -> ServiceResult<JoinFamilyResponse> {
        let identity = Self::account(&ctx)?;
        let (pool, stripe) = self.store()?;
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
        if !service::family_plan_active(pool, Some(stripe), &owner)
            .await
            .map_err(internal("family_unavailable"))?
        {
            return Err(ConnectError::new(
                ErrorCode::FailedPrecondition,
                "family_plan_inactive",
            ));
        }
        match billing_db::join_family(pool, &owner, &identity.user_id, FAMILY_MAX_MEMBERS)
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
        let (pool, _) = self.store()?;
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
        let (pool, _) = self.store()?;
        let member = request.to_owned_message().user_id;
        if !service::is_account_id(&member) {
            return Err(ConnectError::new(
                ErrorCode::InvalidArgument,
                "invalid_member",
            ));
        }
        if billing_db::remove_family_member(pool, Some(&identity.user_id), &member)
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
        let (pool, stripe) = self.store()?;
        if !service::family_plan_active(pool, Some(stripe), &identity.user_id)
            .await
            .map_err(internal("family_unavailable"))?
        {
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

/// `POST /webhooks/stripe`: verify, then read the named objects back from Stripe.
///
/// 400 for a bad signature or body, 503 while sales are closed, 500 when
/// processing failed (Stripe retries), 200 once applied.
pub async fn stripe_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> StatusCode {
    let (Some(pool), Some(stripe)) = (&state.pool, &state.stripe) else {
        return StatusCode::SERVICE_UNAVAILABLE;
    };
    let Some(signature) = headers
        .get("stripe-signature")
        .and_then(|value| value.to_str().ok())
    else {
        return StatusCode::BAD_REQUEST;
    };
    if !stripe.verify_webhook(&body, signature, Utc::now().timestamp()) {
        return StatusCode::BAD_REQUEST;
    }
    let Ok(event) = serde_json::from_slice::<serde_json::Value>(&body) else {
        return StatusCode::BAD_REQUEST;
    };
    match service::handle_event(pool, stripe, &event).await {
        Ok(()) => StatusCode::OK,
        Err(error) => {
            warn!(%error, "stripe webhook processing failed");
            StatusCode::INTERNAL_SERVER_ERROR
        }
    }
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
