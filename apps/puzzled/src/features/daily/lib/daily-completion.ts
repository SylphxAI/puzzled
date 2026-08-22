export type DailyCompletionReader = (gameSlug: string) => Promise<boolean>

export type DailyCompletionMapInput = {
	gameSlugs: readonly string[]
	isGuest: boolean
	isPremium: boolean
	freeGameSlug: string
	read: DailyCompletionReader
}

/**
 * Read personal daily completion from Connect GetDaily.
 *
 * Guests and accounts use the same server records. Anonymous server reads
 * still go through GetDaily when a guest cookie is present; missing proof
 * is not treated as completion. Non-premium identities only need the free
 * rotation; premium accounts can read the full suite.
 */
export async function loadDailyCompletionMap(
	input: DailyCompletionMapInput,
): Promise<Record<string, boolean>> {
	const gameSlugs = [...new Set(input.gameSlugs)]
	const targets = input.isPremium
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
