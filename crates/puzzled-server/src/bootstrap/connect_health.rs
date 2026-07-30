//! Native Connect HealthService — technology-stack-profile (buffa + connectrpc).
//! Replaces hand-JSON Connect cosplay for product contract stack conformance.

use std::sync::Arc;

use buffa::EnumValue;
use connectrpc::{RequestContext, Response, ServiceRequest, ServiceResult};

use super::lifecycle::shutting_down;
use super::state::AppState;
use crate::proto::puzzled::v1::{
    DependencyStatus, HealthRequest, HealthResponse, HealthService, ReadyRequest, ReadyResponse,
    ServingStatus,
};

#[derive(Clone)]
pub struct HealthConnectService {
    state: AppState,
}

impl HealthConnectService {
    pub fn new(state: AppState) -> Self {
        Self { state }
    }
}

#[allow(refining_impl_trait_internal, refining_impl_trait_reachable)]
impl HealthService for HealthConnectService {
    async fn health(
        &self,
        _ctx: RequestContext,
        _request: ServiceRequest<'_, HealthRequest>,
    ) -> ServiceResult<HealthResponse> {
        let status = if shutting_down() {
            ServingStatus::Unavailable
        } else {
            ServingStatus::Ok
        };
        Response::ok(HealthResponse {
            status: EnumValue::from(status),
            message: if matches!(status, ServingStatus::Ok) {
                "ok".to_string()
            } else {
                "shutting down".to_string()
            },
            ..Default::default()
        })
    }

    async fn ready(
        &self,
        _ctx: RequestContext,
        _request: ServiceRequest<'_, ReadyRequest>,
    ) -> ServiceResult<ReadyResponse> {
        // Pool presence matches prior hand-rolled Connect Ready semantics
        // (HTTP /readyz still does a live postgres ping).
        let ready = self.state.pool.is_some() && !shutting_down();
        let status = if ready {
            ServingStatus::Ok
        } else if shutting_down() {
            ServingStatus::Unavailable
        } else {
            ServingStatus::NotReady
        };
        Response::ok(ReadyResponse {
            status: EnumValue::from(status),
            message: if ready {
                "ok".to_string()
            } else if shutting_down() {
                "shutting down".to_string()
            } else {
                "not_ready".to_string()
            },
            uptime_s: self.state.uptime_secs(),
            slice: if self.state.pool.is_some() {
                "S1".to_string()
            } else {
                "S0".to_string()
            },
            dependencies: vec![DependencyStatus {
                name: "postgres".to_string(),
                ok: self.state.pool.is_some(),
                detail: "sqlx pool presence".to_string(),
                ..Default::default()
            }],
            stub: self.state.pool.is_none(),
            ..Default::default()
        })
    }
}

pub fn health_connect_service(state: AppState) -> Arc<HealthConnectService> {
    Arc::new(HealthConnectService::new(state))
}
