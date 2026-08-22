export type StreakInfo = {
	currentStreak: number
	maxStreak: number
	hasPlayedToday: boolean
	totalGamesPlayed: number
	freezesAvailable: number
	autoFreezeEnabled: boolean
}

export type StreakInfoPayload =
	| {
			currentStreak?: unknown
			maxStreak?: unknown
			hasPlayedToday?: unknown
			totalGamesPlayed?: unknown
			freezesAvailable?: unknown
			autoFreezeEnabled?: unknown
	  }
	| null
	| undefined

function requiredUint(value: unknown, field: string): number {
	if (typeof value !== 'number' && typeof value !== 'bigint' && typeof value !== 'string') {
		throw new Error(`streak_payload_unavailable:${field}`)
	}
	const n = Number(value)
	if (!Number.isFinite(n) || n < 0 || Math.floor(n) !== n) {
		throw new Error(`streak_payload_unavailable:${field}`)
	}
	return n
}

/**
 * Project GetStreakInfo.info. Missing or partial payloads fail closed.
 * Zero is a valid empty history, not a substitute for an absent envelope.
 */
export function projectStreakInfo(info: StreakInfoPayload): StreakInfo {
	if (!info) {
		throw new Error('streak_payload_unavailable')
	}
	if (typeof info.hasPlayedToday !== 'boolean') {
		throw new Error('streak_payload_unavailable:hasPlayedToday')
	}
	if (typeof info.autoFreezeEnabled !== 'boolean') {
		throw new Error('streak_payload_unavailable:autoFreezeEnabled')
	}
	return {
		currentStreak: requiredUint(info.currentStreak, 'currentStreak'),
		maxStreak: requiredUint(info.maxStreak, 'maxStreak'),
		hasPlayedToday: info.hasPlayedToday,
		totalGamesPlayed: requiredUint(info.totalGamesPlayed, 'totalGamesPlayed'),
		freezesAvailable: requiredUint(info.freezesAvailable, 'freezesAvailable'),
		autoFreezeEnabled: info.autoFreezeEnabled,
	}
}
