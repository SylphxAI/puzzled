//! Anonymous first-party counters over native Connect RPC, with same-origin validation
//! and a process-wide cap of 1200 browser rows per minute.

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::proto::puzzled::v1::{FunnelService, RecordEventRequest, RecordEventResponse};
use connectrpc::{
    ConnectError, ErrorCode, RequestContext, Response, ServiceRequest, ServiceResult,
};
use std::sync::Arc;

use super::state::AppState;
use crate::capabilities::funnel::{insert, validate_browser, Incoming};

const PER_MINUTE: u64 = 1200;
/// Packed `minute << 20 | count`.
static WINDOW: AtomicU64 = AtomicU64::new(0);

fn within_cap(now_secs: u64) -> bool {
    let minute = now_secs / 60;
    loop {
        let cur = WINDOW.load(Ordering::Relaxed);
        let (m, n) = (cur >> 20, cur & 0xF_FFFF);
        let next = if m == minute {
            (m << 20) | (n + 1)
        } else {
            (minute << 20) | 1
        };
        if m == minute && n >= PER_MINUTE {
            return false;
        }
        if WINDOW
            .compare_exchange(cur, next, Ordering::Relaxed, Ordering::Relaxed)
            .is_ok()
        {
            return true;
        }
    }
}

pub struct FunnelConnectService {
    state: AppState,
}

#[allow(refining_impl_trait_internal, refining_impl_trait_reachable)]
impl FunnelService for FunnelConnectService {
    async fn record_event(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, RecordEventRequest>,
    ) -> ServiceResult<RecordEventResponse> {
        let origin = crate::shared::public_origin::public_origin()
            .map_err(|_| ConnectError::new(ErrorCode::Unavailable, "public_origin_unavailable"))?;
        if !crate::shared::public_origin::admits_browser(ctx.headers(), &origin) {
            return Err(ConnectError::new(
                ErrorCode::PermissionDenied,
                "same_origin_required",
            ));
        }
        let input = request.to_owned_message();
        // Bound retained data as well as the router's shared request-body cap.
        if [
            &input.event,
            &input.path,
            &input.game_slug,
            &input.metric,
            &input.rating,
        ]
        .iter()
        .map(|s| s.len())
        .sum::<usize>()
            > 2048
        {
            return Err(ConnectError::new(
                ErrorCode::InvalidArgument,
                "event_too_large",
            ));
        }
        let incoming = Incoming {
            event: input.event,
            path: Some(input.path),
            game_slug: Some(input.game_slug),
            metric: Some(input.metric),
            value: input.value,
            rating: Some(input.rating),
        };
        let Some(row) = validate_browser(&incoming) else {
            return Response::ok(RecordEventResponse::default());
        };
        let Some(pool) = &self.state.pool else {
            return Err(ConnectError::new(
                ErrorCode::Unavailable,
                "funnel_unavailable",
            ));
        };
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_or(0, |d| d.as_secs());
        if within_cap(now) {
            insert(pool, &row).await.map_err(|error| {
                tracing::warn!(%error, "funnel event not recorded");
                ConnectError::new(ErrorCode::Unavailable, "funnel_unavailable")
            })?;
        }
        Response::ok(RecordEventResponse::default())
    }
}

pub fn funnel_connect_service(state: AppState) -> Arc<FunnelConnectService> {
    Arc::new(FunnelConnectService { state })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_cap_holds_within_a_minute_and_resets_in_the_next() {
        let t = 6_000_000_000;
        assert!((0..PER_MINUTE).all(|_| within_cap(t)));
        assert!(!within_cap(t + 1));
        assert!(within_cap(t + 60));
    }
}
