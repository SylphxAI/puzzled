import { describe, expect, test } from 'bun:test'
import { solvedChipLabel, tileLinkHint } from './game-tile'

const labels = { play: 'Play', seeResult: 'See your result', freeToday: "Today's pick" }

describe('game tile result labels', () => {
	test('a solved tile shows its proved score, else says it opens the result', () => {
		expect(solvedChipLabel('820', labels)).toBe('820')
		expect(solvedChipLabel(null, labels)).toBe('See your result')
		expect(solvedChipLabel(undefined, labels)).toBe('See your result')
	})

	test('only a solved tile announces the result; others announce play', () => {
		expect(tileLinkHint('solved', labels)).toBe('See your result')
		expect(tileLinkHint('play', labels)).toBe('Play')
		expect(tileLinkHint('free', labels)).toBe('Play')
	})
})
