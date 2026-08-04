'use client'

/**
 * Connect-Query primary product probe for Stats.GetLeaderboard.
 * Complements server admitLeaderboardViaConnect densify path.
 */
import { useGetLeaderboardQuery } from '@/lib/connect/stats-query'

export function ConnectLeaderboardProbe({
	gameSlug,
	period,
}: {
	gameSlug: string
	period: 'today' | 'week' | 'all'
}) {
	const q = useGetLeaderboardQuery(
		{ gameSlug, type: 'score', period, limit: 5 },
		{ enabled: Boolean(gameSlug) },
	)
	if (q.isLoading) {
		return (
			<p className="text-xs text-muted-foreground" data-connect-query="loading">
				Connect-Query GetLeaderboard…
			</p>
		)
	}
	if (q.isError || !q.data) {
		return (
			<p className="text-xs text-muted-foreground" data-connect-query="residual">
				Connect-Query residual (server admit remains densify authority)
			</p>
		)
	}
	const n = q.data.entries?.length ?? 0
	return (
		<p
			className="text-xs text-muted-foreground"
			data-connect-query="ok"
			data-connect-entries={n}
			title="Connect-Query StatsService.GetLeaderboard product read"
		>
			Connect-Query · {n} entries · {gameSlug}
		</p>
	)
}
