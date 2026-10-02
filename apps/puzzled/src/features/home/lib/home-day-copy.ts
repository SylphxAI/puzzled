export type HomeDayCopyInput = {
	isMember: boolean
	/** Every playable module is finished (members only see this state). */
	allDone: boolean
	/** The server proved today's free module is finished. */
	freeGameDone: boolean
	currentStreak: number
	hasPlayedToday: boolean
}

export type HomeDayCopy = {
	headlineKey:
		| 'titleMemberDone'
		| 'titleDone'
		| 'titleMemberStreak'
		| 'titleMemberReady'
		| 'guestTitle'
	/** `result` opens the finished result, `play` starts today's board. */
	cta: 'result' | 'play'
	/** The no-account reassurance, for first-time visitors who have not played. */
	showsNote: boolean
}

/** Which headline, action and note the home day shows. Pure; no copy lives here. */
export function homeDayCopy(input: HomeDayCopyInput): HomeDayCopy {
	const done = input.freeGameDone || (input.isMember && input.allDone)
	const headlineKey: HomeDayCopy['headlineKey'] =
		input.isMember && input.allDone
			? 'titleMemberDone'
			: input.freeGameDone
				? 'titleDone'
				: input.isMember
					? input.currentStreak > 0 && !input.hasPlayedToday
						? 'titleMemberStreak'
						: 'titleMemberReady'
					: 'guestTitle'
	return {
		headlineKey,
		cta: done ? 'result' : 'play',
		showsNote: !input.isMember && !done,
	}
}

/** A proved finish outranks the free badge on a lineup tile. */
export function lineupStatus(game: {
	completed: boolean
	isFreeToday: boolean
}): 'solved' | 'free' | 'play' {
	return game.completed ? 'solved' : game.isFreeToday ? 'free' : 'play'
}
