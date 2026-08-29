export type EngagementLeaderboardResult = {
	entries: Array<{
		userId: string
		score: number
		rank: number
		displayName?: string
		value: number
		isCurrentUser?: boolean
	}>
	currentUserEntry?: {
		userId: string
		score: number
		rank: number
		displayName?: string
		value: number
		isCurrentUser?: boolean
	} | null
}

export async function getLeaderboard(
	_config: unknown,
	_board: string,
	_userId?: string | null,
	_opts?: { limit?: number },
): Promise<EngagementLeaderboardResult> {
	return { entries: [] }
}

export async function getSubscription(
	_config: unknown,
	_userId?: string,
): Promise<{ planSlug?: string; status?: string } | null> {
	return null
}

export function createConfig(opts: { secretKey?: string; platformUrl?: string }) {
	return opts
}

export type SylphxConfig = ReturnType<typeof createConfig>

export function createSylphxMiddleware(_opts: Record<string, unknown>) {
	return async () => {
		const { NextResponse } = await import('next/server')
		return NextResponse.next()
	}
}
