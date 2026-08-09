/**
 * technology-stack-profile: generated HealthService client (not hand-rolled fetch).
 */
import { create } from '@bufbuild/protobuf'
import { type Client, createClient } from '@connectrpc/connect'
import {
	HealthRequestSchema,
	HealthService,
	ReadyRequestSchema,
} from '../../gen/connect/puzzled/v1/health_pb'
import { getConnectTransport } from './transport'

export type HealthServiceClient = Client<typeof HealthService>

export function createHealthServiceClient(baseUrl?: string): HealthServiceClient {
	return createClient(HealthService, getConnectTransport(baseUrl))
}

export async function fetchProtoHealth(client?: HealthServiceClient) {
	const c = client ?? createHealthServiceClient()
	return c.health(create(HealthRequestSchema, {}))
}

export async function fetchProtoReady(client?: HealthServiceClient) {
	const c = client ?? createHealthServiceClient()
	return c.ready(create(ReadyRequestSchema, {}))
}
