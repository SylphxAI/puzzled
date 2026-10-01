/**
 * GamificationService generated client: the player's streak auto-freeze control.
 */
import { create } from '@bufbuild/protobuf'
import { type Client, createClient } from '@connectrpc/connect'
import {
	GamificationService,
	ToggleAutoFreezeRequestSchema,
} from '@/gen/connect/puzzled/v1/gamification_pb'
import { projectStreakInfo } from '@/lib/streak-info'
import { getConnectTransport } from './transport'

export type GamificationServiceClient = Client<typeof GamificationService>

export function createGamificationServiceClient(baseUrl?: string): GamificationServiceClient {
	return createClient(GamificationService, getConnectTransport(baseUrl))
}

/**
 * Ask the server to turn auto-freeze on or off. The returned value is what the
 * server now holds (from the response's streak info), never the requested one.
 * A missing or partial payload throws, so the caller cannot show a state the
 * server did not confirm.
 */
export async function setAutoFreeze(
	enabled: boolean,
	client?: GamificationServiceClient,
): Promise<boolean> {
	const c = client ?? createGamificationServiceClient()
	const res = await c.toggleAutoFreeze(create(ToggleAutoFreezeRequestSchema, { enabled }))
	return projectStreakInfo(res.info).autoFreezeEnabled
}
