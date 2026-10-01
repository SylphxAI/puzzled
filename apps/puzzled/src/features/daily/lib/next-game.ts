/**
 * The game to suggest after a finish: the next one in catalogue order that the
 * player has not finished today, wrapping around. Null when there is nothing
 * left to suggest (every other game is finished).
 */
export function nextGameToPlay(
	current: string,
	slugs: readonly string[],
	finishedToday: ReadonlySet<string>,
): string | null {
	const start = slugs.indexOf(current)
	for (let step = 1; step < slugs.length; step++) {
		const candidate = slugs[(start + step + slugs.length) % slugs.length]
		if (candidate !== current && !finishedToday.has(candidate)) return candidate
	}
	return null
}
