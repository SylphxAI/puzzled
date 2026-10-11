//! `POST /v1/funnel/event`: the browser's side of the first-party funnel
//! counter (`capabilities::funnel`). Same-origin JSON only, 2 KB body, a
//! process-wide cap of 1200 rows a minute. Always 204 for an accepted or
//! ignored event, so a page never retries or waits.

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use axum::body::Bytes;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};

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

pub(crate) async fn funnel_event(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> StatusCode {
    let Ok(origin) = crate::shared::public_origin::public_origin() else {
        return StatusCode::SERVICE_UNAVAILABLE;
    };
    if !crate::shared::public_origin::admits_browser(&headers, &origin) || body.len() > 2048 {
        return StatusCode::FORBIDDEN;
    }
    let Some(pool) = &state.pool else {
        return StatusCode::NO_CONTENT;
    };
    let Some(row) = serde_json::from_slice::<Incoming>(&body)
        .ok()
        .and_then(|incoming| validate_browser(&incoming))
    else {
        return StatusCode::NO_CONTENT;
    };
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_secs());
    if !within_cap(now) {
        return StatusCode::NO_CONTENT;
    }
    if let Err(error) = insert(pool, &row).await {
        tracing::warn!(%error, "funnel event not recorded");
    }
    StatusCode::NO_CONTENT
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
