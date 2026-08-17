import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const sessionBackedGames = [
	'arithmo/arithmo-game.tsx',
	'block-slide/block-slide-game.tsx',
	'crossword/crossword-game.tsx',
	'cryptogram/cryptogram-game.tsx',
	'killer-sudoku/killer-sudoku-game.tsx',
	'nonogram/nonogram-game.tsx',
	'pattern-match/pattern-match-game.tsx',
	'quad-words/quad-words-game.tsx',
	'queens/queens-game.tsx',
	'sudoku/sudoku-game.tsx',
	'tango/tango-game.tsx',
	'word-box/word-box-game.tsx',
	'word-groups/word-groups-game.tsx',
	'word-guess/word-guess-game.tsx',
	'word-hive/word-hive-game.tsx',
	'word-ladder/word-ladder-game.tsx',
	'word-search/word-search-game.tsx',
]

describe('archive completion authority boundary', () => {
	test('every session-backed puzzle delegates archive validation to Rust', () => {
		for (const relativePath of sessionBackedGames) {
			const source = readFileSync(new URL(`../games/${relativePath}`, import.meta.url), 'utf8')
			expect(source, relativePath).toContain('validateArchive: true')
		}
	})
})
