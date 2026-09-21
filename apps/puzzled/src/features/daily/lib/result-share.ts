/**
 * One result-share helper: catalogue-resolved module name + the shipped
 * non-spoiler share text + the share decision table.
 *
 * Before this module every result surface carried its own handleShare with a
 * gameName literal in it; 19 call sites resolved the same catalogue key
 * (games.<camel>.name, TD-02) by hand, and one literal had already drifted
 * (crossword shared as Crossword Mini while every served surface says
 * Mini Grid). Shares now resolve the name through the same readMessage
 * lookup the rest of the app uses, so a share can never carry a name no
 * other surface shows.
 */
import { readMessage } from '@/features/catalog/lib/catalog'
import { canonicalizeGameSlug, playerTitle, slugToCamelCase } from '@/lib/game-slug'
import { formatRitualShareText } from './share-text'

/** What every share call site knows about its own result. */
export type ResultShareFacts = {
	/** Canonical game slug, e.g. word-guess. */
	gameSlug: string
	/** YYYY-MM-DD product day when the surface knows it. */
	puzzleDate?: string
	status: 'won' | 'lost'
	attempts?: number | null
	/** Preformatted stat line (grid / timer). Never solution content. */
	statLine?: string
	difficultyLabel?: string | null
	currentStreak?: number
}

export type ResultShareOutcome = 'shared' | 'copied' | 'cancelled' | 'unavailable'

/** The games-namespace reader handed in by the hook (next-intl t). */
export type ModuleMessageLookup = ((key: string) => string) & {
	has(key: string): boolean
}

/**
 * The module name every surface serves: games.<camel>.name, falling back to
 * the registry player title (the TD-02 resolver, same pieces as the game page).
 */
export function resolveModuleDisplayName(messages: ModuleMessageLookup, slug: string): string {
	return readMessage(
		messages,
		`${slugToCamelCase(canonicalizeGameSlug(slug))}.name`,
		playerTitle(slug),
	)
}

/** The share text for one result: catalogue name + the shipped non-spoiler format. */
export function buildResultShareText(
	messages: ModuleMessageLookup,
	facts: ResultShareFacts,
	origin: string,
): string {
	return formatRitualShareText({
		origin,
		gameName: resolveModuleDisplayName(messages, facts.gameSlug),
		...facts,
	})
}

export interface ShareTextDeps {
	/** Defaults to globalThis.navigator; pass null to model a platform without one. */
	navigator?: Navigator | null
}

function isAbort(error: unknown): boolean {
	return (
		typeof error === 'object' &&
		error !== null &&
		(error as { name?: unknown }).name === 'AbortError'
	)
}

/**
 * Share one prepared text: the share sheet when the platform has one, the
 * clipboard otherwise (including after a share failure that is not a user
 * cancel). Never throws; the caller decides its own feedback from the outcome.
 */
export async function shareResultText(
	text: string,
	deps: ShareTextDeps = {},
): Promise<ResultShareOutcome> {
	const nav =
		deps.navigator !== undefined
			? deps.navigator
			: typeof globalThis.navigator === 'undefined'
				? null
				: globalThis.navigator
	if (nav && typeof nav.share === 'function') {
		try {
			await nav.share({ text })
			return 'shared'
		} catch (error) {
			if (isAbort(error)) return 'cancelled'
			// Anything else (NotAllowedError, oversized data...) falls through to
			// the clipboard so the tap still lands.
		}
	}
	const clipboard = nav?.clipboard
	if (text.length > 0 && clipboard && typeof clipboard.writeText === 'function') {
		try {
			await clipboard.writeText(text)
			return 'copied'
		} catch {
			// Fall through to unavailable.
		}
	}
	return 'unavailable'
}
