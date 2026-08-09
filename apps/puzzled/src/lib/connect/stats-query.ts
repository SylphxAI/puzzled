import { create } from '@bufbuild/protobuf'
import { useQuery } from '@connectrpc/connect-query'
import {
	GetLeaderboardRequestSchema,
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

export function useGetLeaderboardQuery(
	input: GetLeaderboardInput,
	options?: { enabled?: boolean },
) {
	const valid = validateGetLeaderboardInput(input) === null
	return useQuery(
		StatsService.method.getLeaderboard,
		create(GetLeaderboardRequestSchema, {
			gameSlug: input.gameSlug.trim(),
			type: toType(input.type),
			period: toPeriod(input.period),
			limit: clampLeaderboardLimit(input.limit),
		}),
		{ enabled: (options?.enabled ?? true) && valid },
	)
}
