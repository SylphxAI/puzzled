/**
 * GamificationService generated client (sole Connect surface).
 *
 * Streaks are derived by puzzled-server from accepted daily sessions. This
 * client only reads that projection; it never records activity or computes a
 * replacement streak in the browser.
 */

import { create } from '@bufbuild/protobuf'
import { type Client, createClient } from '@connectrpc/connect'
import {
	GamificationService,
	GetStreakInfoRequestSchema,
	type StreakInfo as ProtoStreakInfo,
} from '@/gen/connect/puzzled/v1/gamification_pb'
import { getConnectTransport } from './transport'

export type GamificationServiceClient = Client<typeof GamificationService>

export type StreakInfo = {
	currentStreak: number
	maxStreak: number
	hasPlayedToday: boolean
	totalGamesPlayed: number
	freezesAvailable: number
	autoFreezeEnabled: boolean
}

export function createGamificationServiceClient(baseUrl?: string): GamificationServiceClient {
	return createClient(GamificationService, getConnectTransport(baseUrl))
}

/** Map the Rust-owned Connect projection without deriving any client state. */
export function mapStreakInfo(info?: ProtoStreakInfo): StreakInfo {
	return {
		currentStreak: info?.currentStreak ?? 0,
		maxStreak: info?.maxStreak ?? 0,
		hasPlayedToday: info?.hasPlayedToday ?? false,
		totalGamesPlayed: info?.totalGamesPlayed ?? 0,
		freezesAvailable: info?.freezesAvailable ?? 0,
		autoFreezeEnabled: info?.autoFreezeEnabled ?? false,
	}
}

/** Read the authenticated user's streak from Rust Connect. */
export async function getStreakInfo(client?: GamificationServiceClient): Promise<StreakInfo> {
	const c = client ?? createGamificationServiceClient()
	const res = await c.getStreakInfo(create(GetStreakInfoRequestSchema, {}))
	return mapStreakInfo(res.info)
}
