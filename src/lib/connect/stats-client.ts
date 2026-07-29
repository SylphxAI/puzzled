import { create } from '@bufbuild/protobuf'
import { type Client, createClient } from '@connectrpc/connect'
import {
	GetLeaderboardRequestSchema,
	type GetLeaderboardResponse,
	LeaderboardPeriod,
	LeaderboardType,
	StatsService,
} from '../../gen/connect/puzzled/v1/stats_pb'
import {
	clampLeaderboardLimit,
	type GetLeaderboardInput,
	type LeaderboardPeriodInput,
	type LeaderboardTypeInput,
	validateGetLeaderboardInput,
} from './stats-domain'
import { getConnectTransport } from './transport'

export type StatsServiceClient = Client<typeof StatsService>

export const statsQueryKeys = {
	root: ['puzzled', 'v1', 'StatsService'] as const,
	leaderboard: (input: GetLeaderboardInput) =>
		[
			...statsQueryKeys.root,
			'GetLeaderboard',
			input.gameSlug,
			input.type,
			input.period,
			input.limit,
		] as const,
}

function toType(t: LeaderboardTypeInput): LeaderboardType {
	switch (t) {
		case 'streak':
			return LeaderboardType.STREAK
		case 'score':
			return LeaderboardType.SCORE
		default:
			return LeaderboardType.UNSPECIFIED
	}
}

function toPeriod(p: LeaderboardPeriodInput): LeaderboardPeriod {
	switch (p) {
		case 'today':
			return LeaderboardPeriod.TODAY
		case 'week':
			return LeaderboardPeriod.WEEK
		case 'all':
			return LeaderboardPeriod.ALL
		default:
			return LeaderboardPeriod.UNSPECIFIED
	}
}

export function createStatsServiceClient(baseUrl?: string): StatsServiceClient {
	return createClient(StatsService, getConnectTransport(baseUrl))
}

export async function getLeaderboard(
	input: GetLeaderboardInput,
	client?: StatsServiceClient,
): Promise<GetLeaderboardResponse> {
	const err = validateGetLeaderboardInput(input)
	if (err) throw new Error(err)
	const c = client ?? createStatsServiceClient()
	return c.getLeaderboard(
		create(GetLeaderboardRequestSchema, {
			gameSlug: input.gameSlug.trim(),
			type: toType(input.type),
			period: toPeriod(input.period),
			limit: clampLeaderboardLimit(input.limit),
		}),
	)
}
