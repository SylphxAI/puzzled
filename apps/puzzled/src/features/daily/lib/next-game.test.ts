import { describe, expect, test } from 'bun:test'
import { nextGameToPlay } from './next-game'

const slugs = ['a', 'b', 'c', 'd']

describe('nextGameToPlay', () => {
	test('takes the next game in order and wraps around', () => {
		expect(nextGameToPlay('a', slugs, new Set())).toBe('b')
		expect(nextGameToPlay('d', slugs, new Set())).toBe('a')
	})
	test('skips games already finished today', () => {
		expect(nextGameToPlay('a', slugs, new Set(['b', 'c']))).toBe('d')
	})
	test('offers nothing when every other game is finished or the game is unknown to an empty list', () => {
		expect(nextGameToPlay('a', slugs, new Set(['b', 'c', 'd']))).toBeNull()
		expect(nextGameToPlay('a', [], new Set())).toBeNull()
	})
})
