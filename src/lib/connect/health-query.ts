/**
 * Connect-Query surface for HealthService (Protobuf SSOT).
 * Server state lives in TanStack Query — not Zustand.
 */

import { create } from '@bufbuild/protobuf'
import { useQuery } from '@connectrpc/connect-query'
import {
	HealthRequestSchema,
	HealthService,
	ReadyRequestSchema,
} from '../../gen/connect/puzzled/v1/health_pb'

export const healthQueryKeys = {
	root: ['puzzled', 'v1', 'HealthService'] as const,
	Health: () => [...healthQueryKeys.root, 'Health'] as const,
	Ready: () => [...healthQueryKeys.root, 'Ready'] as const,
}

export function useProtoHealthQuery(options?: { enabled?: boolean }) {
	return useQuery(HealthService.method.health, create(HealthRequestSchema, {}), {
		enabled: options?.enabled ?? true,
	})
}

export function useProtoReadyQuery(options?: { enabled?: boolean }) {
	return useQuery(HealthService.method.ready, create(ReadyRequestSchema, {}), {
		enabled: options?.enabled ?? true,
	})
}
