import { describe, expect, test } from 'bun:test'
import { canonicalizeGameSlug, playerTitle } from './game-slug'

describe('canonicalizeGameSlug', () => {
	test('maps LinkedIn leftovers to CATALOG slugs', () => {
		expect(canonicalizeGameSlug('queens')).toBe('crowns')
		expect(canonicalizeGameSlug('tango')).toBe('duo')
		expect(canonicalizeGameSlug('crowns')).toBe('crowns')
		expect(canonicalizeGameSlug('crossword')).toBe('crossword')
	})
})

describe('playerTitle', () => {
	test('never uses LinkedIn or NYT product marks', () => {
		expect(playerTitle('queens')).toBe('Crowns')
		expect(playerTitle('tango')).toBe('Duo')
		expect(playerTitle('word-guess')).toBe('Five')
		expect(playerTitle('word-groups')).toBe('Threads')
		expect(playerTitle('quad-words')).toBe('Quad')
		expect(playerTitle('word-hive')).toBe('Hive')
		expect(playerTitle('word-box')).toBe('Frame')
		for (const title of [playerTitle('queens'), playerTitle('tango'), playerTitle('word-guess')]) {
			expect(title.toLowerCase()).not.toMatch(/queens|tango|wordle/)
		}
	})
})
