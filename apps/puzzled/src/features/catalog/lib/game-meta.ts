/**
 * Search metadata for a game landing page.
 *
 * The title states the task ("free daily word puzzle") and the description
 * says what the game is, in the module's own words. Only the featured puzzle
 * of the day is free for guests, so the copy says exactly that - it stays true
 * before and after Puzzled Plus is on sale.
 */

/** Add the closing full stop a module rule may lack, without doubling any. */
export function withTerminalStop(text: string, stop: string): string {
	const trimmed = text.trim()
	return /[.!?。！？]$/.test(trimmed) ? trimmed : `${trimmed}${stop}`
}

type Reader = (key: string, values?: Record<string, string>) => string

export function gameMetaTitle(t: Reader, game: string, category: string): string {
	return t('gamePage.metaTitle', { game, genre: t(`gamePage.genre.${category}`) })
}

export function gameMetaDescription(
	t: Reader,
	game: string,
	category: string,
	rule: string,
	stop: string,
): string {
	return t('gamePage.metaDescription', {
		game,
		genre: t(`gamePage.genre.${category}`),
		rule: withTerminalStop(rule, stop),
	})
}
