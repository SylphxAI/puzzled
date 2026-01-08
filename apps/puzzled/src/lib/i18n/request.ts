import { getRequestConfig } from 'next-intl/server'
// Per-game translations - explicit imports required for Turbopack
// Turbopack doesn't support dynamic imports with template literals
import arithmoEn from '@/games/arithmo/translations/en.json'
import blockSlideEn from '@/games/block-slide/translations/en.json'
import crosswordEn from '@/games/crossword/translations/en.json'
import cryptogramEn from '@/games/cryptogram/translations/en.json'
import killerSudokuEn from '@/games/killer-sudoku/translations/en.json'
import nonogramEn from '@/games/nonogram/translations/en.json'
import patternMatchEn from '@/games/pattern-match/translations/en.json'
import quadWordsEn from '@/games/quad-words/translations/en.json'
import queensEn from '@/games/queens/translations/en.json'
import sudokuEn from '@/games/sudoku/translations/en.json'
import tangoEn from '@/games/tango/translations/en.json'
import wordBoxEn from '@/games/word-box/translations/en.json'
import wordGroupsEn from '@/games/word-groups/translations/en.json'
import wordGuessEn from '@/games/word-guess/translations/en.json'
import wordHiveEn from '@/games/word-hive/translations/en.json'
import wordLadderEn from '@/games/word-ladder/translations/en.json'
import wordSearchEn from '@/games/word-search/translations/en.json'
import { routing } from './routing'

/** Per-game translations by camelCase key */
const GAME_TRANSLATIONS_EN: Record<string, Record<string, unknown>> = {
	arithmo: arithmoEn,
	blockSlide: blockSlideEn,
	crossword: crosswordEn,
	cryptogram: cryptogramEn,
	killerSudoku: killerSudokuEn,
	nonogram: nonogramEn,
	patternMatch: patternMatchEn,
	quadWords: quadWordsEn,
	queens: queensEn,
	sudoku: sudokuEn,
	tango: tangoEn,
	wordBox: wordBoxEn,
	wordGroups: wordGroupsEn,
	wordGuess: wordGuessEn,
	wordHive: wordHiveEn,
	wordLadder: wordLadderEn,
	wordSearch: wordSearchEn,
}

type Messages = Record<string, unknown>

/**
 * Load base messages and merge per-game translations
 */
async function loadMessages(locale: string): Promise<Messages> {
	const base = (await import(`@/messages/${locale}.json`)).default as Messages

	// Ensure games namespace exists
	if (!base.games || typeof base.games !== 'object') {
		base.games = {}
	}
	const games = base.games as Record<string, unknown>

	// Merge per-game translations
	if (locale === 'en') {
		for (const [key, translations] of Object.entries(GAME_TRANSLATIONS_EN)) {
			games[key] = { ...((games[key] as object) || {}), ...translations }
		}
	}

	return base
}

export default getRequestConfig(async ({ requestLocale }) => {
	let locale = await requestLocale

	// Validate that the incoming locale is valid
	if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
		locale = routing.defaultLocale
	}

	return {
		locale,
		messages: await loadMessages(locale),
	}
})
