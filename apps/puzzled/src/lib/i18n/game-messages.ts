/**
 * Per-game copy, resolved for the requested locale.
 *
 * A module's player-facing copy lives beside the module itself:
 * `games/<slug>/translations/<locale>.json`. English is the canonical, complete
 * set and the declared fallback for every locale (`localeFallbacks` in
 * `./config`), so a locale file may ship a partial translation: any key it does
 * not carry resolves to the English value — never a blank and never a raw key
 * path.
 *
 * Turbopack resolves no dynamic import that is built from a variable, so every
 * file is imported explicitly — the same pattern as the namespace registry in
 * `request.ts`. Adding a translation is therefore: drop in the JSON, add its
 * import, add it to `GAME_TRANSLATIONS_BY_LOCALE`. `game-messages.test.ts`
 * scans the tree and fails when a file on disk is not registered, so translated
 * copy can never be silently ignored.
 */

import { type Locale, localeFallbacks } from './config'

// ==========================================
// English — the canonical, complete copy
// ==========================================

import arithmoEn from '@/games/arithmo/translations/en.json'
import blockSlideEn from '@/games/block-slide/translations/en.json'
import crosswordEn from '@/games/crossword/translations/en.json'
import cryptogramEn from '@/games/cryptogram/translations/en.json'
import killerSudokuEn from '@/games/killer-sudoku/translations/en.json'
import nonogramEn from '@/games/nonogram/translations/en.json'
import numberPathEn from '@/games/number-path/translations/en.json'
import patternMatchEn from '@/games/pattern-match/translations/en.json'
import pipPlaceEn from '@/games/pip-place/translations/en.json'
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

// ==========================================
// Locale overlays — partial copy is allowed
// ==========================================

import arithmoEs from '@/games/arithmo/translations/es.json'
import arithmoJa from '@/games/arithmo/translations/ja.json'
import arithmoPtBR from '@/games/arithmo/translations/pt-BR.json'
import arithmoZhCN from '@/games/arithmo/translations/zh-CN.json'
import arithmoZhHK from '@/games/arithmo/translations/zh-HK.json'
import arithmoZhTW from '@/games/arithmo/translations/zh-TW.json'
import blockSlideEs from '@/games/block-slide/translations/es.json'
import blockSlideJa from '@/games/block-slide/translations/ja.json'
import blockSlidePtBR from '@/games/block-slide/translations/pt-BR.json'
import blockSlideZhCN from '@/games/block-slide/translations/zh-CN.json'
import blockSlideZhHK from '@/games/block-slide/translations/zh-HK.json'
import blockSlideZhTW from '@/games/block-slide/translations/zh-TW.json'
import crosswordEs from '@/games/crossword/translations/es.json'
import crosswordJa from '@/games/crossword/translations/ja.json'
import crosswordPtBR from '@/games/crossword/translations/pt-BR.json'
import crosswordZhCN from '@/games/crossword/translations/zh-CN.json'
import crosswordZhHK from '@/games/crossword/translations/zh-HK.json'
import crosswordZhTW from '@/games/crossword/translations/zh-TW.json'
import cryptogramEs from '@/games/cryptogram/translations/es.json'
import cryptogramJa from '@/games/cryptogram/translations/ja.json'
import cryptogramPtBR from '@/games/cryptogram/translations/pt-BR.json'
import cryptogramZhCN from '@/games/cryptogram/translations/zh-CN.json'
import cryptogramZhHK from '@/games/cryptogram/translations/zh-HK.json'
import cryptogramZhTW from '@/games/cryptogram/translations/zh-TW.json'
import killerSudokuEs from '@/games/killer-sudoku/translations/es.json'
import killerSudokuJa from '@/games/killer-sudoku/translations/ja.json'
import killerSudokuPtBR from '@/games/killer-sudoku/translations/pt-BR.json'
import killerSudokuZhCN from '@/games/killer-sudoku/translations/zh-CN.json'
import killerSudokuZhHK from '@/games/killer-sudoku/translations/zh-HK.json'
import killerSudokuZhTW from '@/games/killer-sudoku/translations/zh-TW.json'
import nonogramEs from '@/games/nonogram/translations/es.json'
import nonogramJa from '@/games/nonogram/translations/ja.json'
import nonogramPtBR from '@/games/nonogram/translations/pt-BR.json'
import nonogramZhCN from '@/games/nonogram/translations/zh-CN.json'
import nonogramZhHK from '@/games/nonogram/translations/zh-HK.json'
import nonogramZhTW from '@/games/nonogram/translations/zh-TW.json'
import numberPathEs from '@/games/number-path/translations/es.json'
import numberPathJa from '@/games/number-path/translations/ja.json'
import numberPathPtBR from '@/games/number-path/translations/pt-BR.json'
import numberPathZhCN from '@/games/number-path/translations/zh-CN.json'
import numberPathZhHK from '@/games/number-path/translations/zh-HK.json'
import numberPathZhTW from '@/games/number-path/translations/zh-TW.json'
import patternMatchEs from '@/games/pattern-match/translations/es.json'
import patternMatchJa from '@/games/pattern-match/translations/ja.json'
import patternMatchPtBR from '@/games/pattern-match/translations/pt-BR.json'
import patternMatchZhCN from '@/games/pattern-match/translations/zh-CN.json'
import patternMatchZhHK from '@/games/pattern-match/translations/zh-HK.json'
import patternMatchZhTW from '@/games/pattern-match/translations/zh-TW.json'
import pipPlaceEs from '@/games/pip-place/translations/es.json'
import pipPlaceJa from '@/games/pip-place/translations/ja.json'
import pipPlacePtBR from '@/games/pip-place/translations/pt-BR.json'
import pipPlaceZhCN from '@/games/pip-place/translations/zh-CN.json'
import pipPlaceZhHK from '@/games/pip-place/translations/zh-HK.json'
import pipPlaceZhTW from '@/games/pip-place/translations/zh-TW.json'
import quadWordsEs from '@/games/quad-words/translations/es.json'
import quadWordsJa from '@/games/quad-words/translations/ja.json'
import quadWordsPtBR from '@/games/quad-words/translations/pt-BR.json'
import quadWordsZhCN from '@/games/quad-words/translations/zh-CN.json'
import quadWordsZhHK from '@/games/quad-words/translations/zh-HK.json'
import quadWordsZhTW from '@/games/quad-words/translations/zh-TW.json'
import queensEs from '@/games/queens/translations/es.json'
import queensJa from '@/games/queens/translations/ja.json'
import queensPtBR from '@/games/queens/translations/pt-BR.json'
import queensZhCN from '@/games/queens/translations/zh-CN.json'
import queensZhHK from '@/games/queens/translations/zh-HK.json'
import queensZhTW from '@/games/queens/translations/zh-TW.json'
import sudokuEs from '@/games/sudoku/translations/es.json'
import sudokuJa from '@/games/sudoku/translations/ja.json'
import sudokuPtBR from '@/games/sudoku/translations/pt-BR.json'
import sudokuZhCN from '@/games/sudoku/translations/zh-CN.json'
import sudokuZhHK from '@/games/sudoku/translations/zh-HK.json'
import sudokuZhTW from '@/games/sudoku/translations/zh-TW.json'
import tangoEs from '@/games/tango/translations/es.json'
import tangoJa from '@/games/tango/translations/ja.json'
import tangoPtBR from '@/games/tango/translations/pt-BR.json'
import tangoZhCN from '@/games/tango/translations/zh-CN.json'
import tangoZhHK from '@/games/tango/translations/zh-HK.json'
import tangoZhTW from '@/games/tango/translations/zh-TW.json'
import wordBoxEs from '@/games/word-box/translations/es.json'
import wordBoxJa from '@/games/word-box/translations/ja.json'
import wordBoxPtBR from '@/games/word-box/translations/pt-BR.json'
import wordBoxZhCN from '@/games/word-box/translations/zh-CN.json'
import wordBoxZhHK from '@/games/word-box/translations/zh-HK.json'
import wordBoxZhTW from '@/games/word-box/translations/zh-TW.json'
import wordGroupsEs from '@/games/word-groups/translations/es.json'
import wordGroupsJa from '@/games/word-groups/translations/ja.json'
import wordGroupsPtBR from '@/games/word-groups/translations/pt-BR.json'
import wordGroupsZhCN from '@/games/word-groups/translations/zh-CN.json'
import wordGroupsZhHK from '@/games/word-groups/translations/zh-HK.json'
import wordGroupsZhTW from '@/games/word-groups/translations/zh-TW.json'
import wordGuessEs from '@/games/word-guess/translations/es.json'
import wordGuessJa from '@/games/word-guess/translations/ja.json'
import wordGuessPtBR from '@/games/word-guess/translations/pt-BR.json'
import wordGuessZhCN from '@/games/word-guess/translations/zh-CN.json'
import wordGuessZhHK from '@/games/word-guess/translations/zh-HK.json'
import wordGuessZhTW from '@/games/word-guess/translations/zh-TW.json'
import wordHiveEs from '@/games/word-hive/translations/es.json'
import wordHiveJa from '@/games/word-hive/translations/ja.json'
import wordHivePtBR from '@/games/word-hive/translations/pt-BR.json'
import wordHiveZhCN from '@/games/word-hive/translations/zh-CN.json'
import wordHiveZhHK from '@/games/word-hive/translations/zh-HK.json'
import wordHiveZhTW from '@/games/word-hive/translations/zh-TW.json'
import wordLadderEs from '@/games/word-ladder/translations/es.json'
import wordLadderJa from '@/games/word-ladder/translations/ja.json'
import wordLadderPtBR from '@/games/word-ladder/translations/pt-BR.json'
import wordLadderZhCN from '@/games/word-ladder/translations/zh-CN.json'
import wordLadderZhHK from '@/games/word-ladder/translations/zh-HK.json'
import wordLadderZhTW from '@/games/word-ladder/translations/zh-TW.json'
import wordSearchEs from '@/games/word-search/translations/es.json'
import wordSearchJa from '@/games/word-search/translations/ja.json'
import wordSearchPtBR from '@/games/word-search/translations/pt-BR.json'
import wordSearchZhCN from '@/games/word-search/translations/zh-CN.json'
import wordSearchZhHK from '@/games/word-search/translations/zh-HK.json'
import wordSearchZhTW from '@/games/word-search/translations/zh-TW.json'

/** One module's copy: nested objects of strings, keyed as the module reads them. */
export type GameCopy = Record<string, unknown>

/** The `games` namespace: module key -> that module's copy. */
export type GameMessages = Record<string, GameCopy>

/**
 * Module key -> the directory that holds its copy.
 *
 * `crowns` and `duo` are player-facing aliases of `queens` and `tango`, so two
 * keys deliberately share one directory (and one file set).
 */
export const GAME_COPY_SOURCES: Record<string, string> = {
	arithmo: 'arithmo',
	blockSlide: 'block-slide',
	crossword: 'crossword',
	cryptogram: 'cryptogram',
	killerSudoku: 'killer-sudoku',
	nonogram: 'nonogram',
	numberPath: 'number-path',
	patternMatch: 'pattern-match',
	pipPlace: 'pip-place',
	quadWords: 'quad-words',
	queens: 'queens',
	crowns: 'queens',
	sudoku: 'sudoku',
	tango: 'tango',
	duo: 'tango',
	wordBox: 'word-box',
	wordGroups: 'word-groups',
	wordGuess: 'word-guess',
	wordHive: 'word-hive',
	wordLadder: 'word-ladder',
	wordSearch: 'word-search',
}

/** Canonical copy. This object decides which modules the app exposes. */
export const GAME_TRANSLATIONS_EN: GameMessages = {
	arithmo: arithmoEn,
	blockSlide: blockSlideEn,
	crossword: crosswordEn,
	cryptogram: cryptogramEn,
	killerSudoku: killerSudokuEn,
	nonogram: nonogramEn,
	numberPath: numberPathEn,
	patternMatch: patternMatchEn,
	pipPlace: pipPlaceEn,
	quadWords: quadWordsEn,
	queens: queensEn,
	crowns: queensEn,
	sudoku: sudokuEn,
	tango: tangoEn,
	duo: tangoEn,
	wordBox: wordBoxEn,
	wordGroups: wordGroupsEn,
	wordGuess: wordGuessEn,
	wordHive: wordHiveEn,
	wordLadder: wordLadderEn,
	wordSearch: wordSearchEn,
}

/**
 * Locale overlays. A locale that has no file for a module simply has no entry
 * here, and every key of that module stays English.
 */
export const GAME_TRANSLATIONS_BY_LOCALE: Partial<Record<Locale, GameMessages>> = {
	'zh-CN': {
		arithmo: arithmoZhCN,
		blockSlide: blockSlideZhCN,
		crossword: crosswordZhCN,
		cryptogram: cryptogramZhCN,
		killerSudoku: killerSudokuZhCN,
		nonogram: nonogramZhCN,
		numberPath: numberPathZhCN,
		patternMatch: patternMatchZhCN,
		pipPlace: pipPlaceZhCN,
		quadWords: quadWordsZhCN,
		queens: queensZhCN,
		crowns: queensZhCN,
		sudoku: sudokuZhCN,
		tango: tangoZhCN,
		duo: tangoZhCN,
		wordBox: wordBoxZhCN,
		wordGroups: wordGroupsZhCN,
		wordGuess: wordGuessZhCN,
		wordHive: wordHiveZhCN,
		wordLadder: wordLadderZhCN,
		wordSearch: wordSearchZhCN,
	},
	'zh-HK': {
		arithmo: arithmoZhHK,
		blockSlide: blockSlideZhHK,
		crossword: crosswordZhHK,
		cryptogram: cryptogramZhHK,
		killerSudoku: killerSudokuZhHK,
		nonogram: nonogramZhHK,
		numberPath: numberPathZhHK,
		patternMatch: patternMatchZhHK,
		pipPlace: pipPlaceZhHK,
		quadWords: quadWordsZhHK,
		queens: queensZhHK,
		crowns: queensZhHK,
		sudoku: sudokuZhHK,
		tango: tangoZhHK,
		duo: tangoZhHK,
		wordBox: wordBoxZhHK,
		wordGroups: wordGroupsZhHK,
		wordGuess: wordGuessZhHK,
		wordHive: wordHiveZhHK,
		wordLadder: wordLadderZhHK,
		wordSearch: wordSearchZhHK,
	},
	'zh-TW': {
		arithmo: arithmoZhTW,
		blockSlide: blockSlideZhTW,
		crossword: crosswordZhTW,
		cryptogram: cryptogramZhTW,
		killerSudoku: killerSudokuZhTW,
		nonogram: nonogramZhTW,
		numberPath: numberPathZhTW,
		patternMatch: patternMatchZhTW,
		pipPlace: pipPlaceZhTW,
		quadWords: quadWordsZhTW,
		queens: queensZhTW,
		crowns: queensZhTW,
		sudoku: sudokuZhTW,
		tango: tangoZhTW,
		duo: tangoZhTW,
		wordBox: wordBoxZhTW,
		wordGroups: wordGroupsZhTW,
		wordGuess: wordGuessZhTW,
		wordHive: wordHiveZhTW,
		wordLadder: wordLadderZhTW,
		wordSearch: wordSearchZhTW,
	},
	ja: {
		arithmo: arithmoJa,
		blockSlide: blockSlideJa,
		crossword: crosswordJa,
		cryptogram: cryptogramJa,
		killerSudoku: killerSudokuJa,
		nonogram: nonogramJa,
		numberPath: numberPathJa,
		patternMatch: patternMatchJa,
		pipPlace: pipPlaceJa,
		quadWords: quadWordsJa,
		queens: queensJa,
		crowns: queensJa,
		sudoku: sudokuJa,
		tango: tangoJa,
		duo: tangoJa,
		wordBox: wordBoxJa,
		wordGroups: wordGroupsJa,
		wordGuess: wordGuessJa,
		wordHive: wordHiveJa,
		wordLadder: wordLadderJa,
		wordSearch: wordSearchJa,
	},
	es: {
		arithmo: arithmoEs,
		blockSlide: blockSlideEs,
		crossword: crosswordEs,
		cryptogram: cryptogramEs,
		killerSudoku: killerSudokuEs,
		nonogram: nonogramEs,
		numberPath: numberPathEs,
		patternMatch: patternMatchEs,
		pipPlace: pipPlaceEs,
		quadWords: quadWordsEs,
		queens: queensEs,
		crowns: queensEs,
		sudoku: sudokuEs,
		tango: tangoEs,
		duo: tangoEs,
		wordBox: wordBoxEs,
		wordGroups: wordGroupsEs,
		wordGuess: wordGuessEs,
		wordHive: wordHiveEs,
		wordLadder: wordLadderEs,
		wordSearch: wordSearchEs,
	},
	'pt-BR': {
		arithmo: arithmoPtBR,
		blockSlide: blockSlidePtBR,
		crossword: crosswordPtBR,
		cryptogram: cryptogramPtBR,
		killerSudoku: killerSudokuPtBR,
		nonogram: nonogramPtBR,
		numberPath: numberPathPtBR,
		patternMatch: patternMatchPtBR,
		pipPlace: pipPlacePtBR,
		quadWords: quadWordsPtBR,
		queens: queensPtBR,
		crowns: queensPtBR,
		sudoku: sudokuPtBR,
		tango: tangoPtBR,
		duo: tangoPtBR,
		wordBox: wordBoxPtBR,
		wordGroups: wordGroupsPtBR,
		wordGuess: wordGuessPtBR,
		wordHive: wordHivePtBR,
		wordLadder: wordLadderPtBR,
		wordSearch: wordSearchPtBR,
	},
}

/** Deep merge where `source` wins; arrays and scalars are replaced, not merged. */
function deepMerge(target: GameCopy, source: GameCopy): GameCopy {
	const merged: GameCopy = { ...target }

	for (const [key, value] of Object.entries(source)) {
		const current = merged[key]
		const bothObjects =
			value !== null &&
			typeof value === 'object' &&
			!Array.isArray(value) &&
			current !== null &&
			typeof current === 'object' &&
			!Array.isArray(current)

		merged[key] = bothObjects ? deepMerge(current as GameCopy, value as GameCopy) : value
	}

	return merged
}

/**
 * Base-first locale chain: the declared fallback chain, always ending at
 * English. `zh-TW` therefore reads `en` -> `zh-HK` -> `zh-TW`.
 */
export function gameCopyFallbackChain(locale: Locale): Locale[] {
	const chain: Locale[] = [locale]
	let current: Locale | null = localeFallbacks[locale]

	while (current) {
		chain.unshift(current)
		current = localeFallbacks[current]
	}

	if (chain[0] !== 'en-US') chain.unshift('en-US')

	return chain
}

/**
 * Resolve the `games` namespace for one locale.
 *
 * English defines the module set and every key; each overlay on the locale's
 * fallback chain layers on top of it, so a partial translation shows translated
 * values where it has them and English everywhere else.
 */
export function resolveGameMessages(
	locale: Locale,
	english: GameMessages = GAME_TRANSLATIONS_EN,
	overlays: Partial<Record<Locale, GameMessages>> = GAME_TRANSLATIONS_BY_LOCALE,
): GameMessages {
	const resolved: GameMessages = { ...english }

	for (const chainLocale of gameCopyFallbackChain(locale)) {
		const overlay = overlays[chainLocale]
		if (!overlay) continue

		for (const [gameKey, patch] of Object.entries(overlay)) {
			const base = resolved[gameKey]
			if (!base) continue
			resolved[gameKey] = deepMerge(base, patch)
		}
	}

	return resolved
}
