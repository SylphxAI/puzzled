export type DailyCompletionReader = (gameSlug: string) => Promise<boolean>

export type DailyCompletionMapInput = {
	gameSlugs: readonly string[]
	isGuest: boolean
	isPremium: boolean
	freeGameSlug: string
	read: DailyCompletionReader
}

/**
 * Read personal daily completion state without mistaking public aggregate
 * counts for a user's own finishes.
 *
 * Guests use the browser projection after an accepted SubmitGuess. Anonymous
 * server reads therefore make no completion requests. Non-premium accounts
 * only need the free rotation; premium accounts can read the full suite.
 */
export async function loadDailyCompletionMap(
	input: DailyCompletionMapInput,
): Promise<Record<string, boolean>> {
	const gameSlugs = [...new Set(input.gameSlugs)]
	const targets = input.isGuest
		? []
		: input.isPremium
			? gameSlugs
			: gameSlugs.filter((slug) => slug === input.freeGameSlug)

	const entries = await Promise.all(
		targets.map(async (slug) => {
			try {
				return [slug, await input.read(slug)] as const
			} catch {
				// A status read must fail closed: lack of proof is not completion.
				return [slug, false] as const
			}
		}),
	)

	return Object.fromEntries([...gameSlugs.map((slug) => [slug, false] as const), ...entries])
}
