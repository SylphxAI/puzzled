//! Native Connect AnnouncementService: the public read behind the site banner.

use std::sync::Arc;

use connectrpc::{
    ConnectError, ErrorCode, RequestContext, Response, ServiceRequest, ServiceResult,
};
use tracing::warn;

use super::state::AppState;
use crate::capabilities::announcements::list_active;
use crate::proto::puzzled::v1::{
    ActiveAnnouncement, AnnouncementService, ListActiveAnnouncementsRequest,
    ListActiveAnnouncementsResponse,
};

#[derive(Clone)]
pub struct AnnouncementConnectService {
    state: AppState,
}

impl AnnouncementConnectService {
    pub fn new(state: AppState) -> Self {
        Self { state }
    }
}

#[allow(refining_impl_trait_internal, refining_impl_trait_reachable)]
impl AnnouncementService for AnnouncementConnectService {
    async fn list_active_announcements(
        &self,
        _ctx: RequestContext,
        _request: ServiceRequest<'_, ListActiveAnnouncementsRequest>,
    ) -> ServiceResult<ListActiveAnnouncementsResponse> {
        let Some(pool) = &self.state.pool else {
            return Err(ConnectError::new(
                ErrorCode::Unavailable,
                "announcements_unavailable",
            ));
        };
        let rows = list_active(pool, chrono::Utc::now().naive_utc())
            .await
            .map_err(|error| {
                warn!(%error, "list_active_announcements failed");
                ConnectError::new(ErrorCode::Internal, "announcements_read_failed")
            })?;
        Response::ok(ListActiveAnnouncementsResponse {
            announcements: rows
                .into_iter()
                .map(|row| ActiveAnnouncement {
                    id: row.id.to_string(),
                    title: row.title,
                    body: row.body,
                    r#type: row.kind,
                    dismissible: row.dismissible,
                    ends_at: row
                        .ends_at
                        .map(|t| t.and_utc().to_rfc3339())
                        .unwrap_or_default(),
                    ..Default::default()
                })
                .collect(),
            ..Default::default()
        })
    }
}

pub fn announcement_connect_service(state: AppState) -> Arc<AnnouncementConnectService> {
    Arc::new(AnnouncementConnectService::new(state))
}
