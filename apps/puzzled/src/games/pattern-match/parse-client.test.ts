import { describe, expect, test } from 'bun:test'
import fixtures from '../../../../../crates/puzzled-core/tests/fixtures/generate/pattern-match.json'
import { parsePatternMatchClientPayload } from './parse-client'
import { type Card, findAllSets, isValidSet } from './types'

type Case = {
	puzzleData: { cards: Card[]; totalSets: number }
	solution: { validSets: [number, number, number][]; totalSets: number }
}
const served = (fixtures as unknown as Case[])[0] as Case

describe('parsePatternMatchClientPayload', () => {
	test('accepts the GetDaily wire form (solution stripped)', () => {
		expect(parsePatternMatchClientPayload(served.puzzleData)).toEqual(served.puzzleData)
	})

	test('accepts the legacy wrapped form and drops the solution', () => {
		const parsed = parsePatternMatchClientPayload({
			puzzleData: served.puzzleData,
			solution: served.solution,
		})
		expect(JSON.stringify(parsed)).not.toContain('validSets')
		expect(parsed.cards).toEqual(served.puzzleData.cards)
	})

	test('rejects an unknown card attribute', () => {
		expect(() =>
			parsePatternMatchClientPayload({
				cards: [{ id: 0, shape: 'star', color: 'red', fill: 'solid', count: 1 }],
				totalSets: 1,
			}),
		).toThrow('shape')
	})
})

describe('the rules judge each set', () => {
	test('the rules find exactly the stored sets', () => {
		const sort = (sets: number[][]) =>
			sets.map((s) => [...s].sort((a, b) => a - b).join(',')).sort()
		expect(sort(findAllSets(served.puzzleData.cards))).toEqual(sort(served.solution.validSets))
		expect(served.solution.validSets.length).toBe(served.puzzleData.totalSets)
	})

	test('a stored set is valid and a non-set is not', () => {
		const byId = new Map(served.puzzleData.cards.map((card) => [card.id, card]))
		const [a, b, c] = served.solution.validSets[0] as [number, number, number]
		expect(isValidSet(byId.get(a) as Card, byId.get(b) as Card, byId.get(c) as Card)).toBe(true)
		const inSet = new Set(
			served.solution.validSets.map((s) => [...s].sort((x, y) => x - y).join(',')),
		)
		const ids = served.puzzleData.cards.map((card) => card.id)
		let nonSet: [number, number, number] | null = null
		for (const x of ids)
			for (const y of ids)
				for (const z of ids)
					if (x < y && y < z && !inSet.has(`${x},${y},${z}`)) nonSet ??= [x, y, z]
		const [x, y, z] = nonSet as [number, number, number]
		expect(isValidSet(byId.get(x) as Card, byId.get(y) as Card, byId.get(z) as Card)).toBe(false)
	})
})
