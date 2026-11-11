import { describe, expect, test } from 'bun:test'
import { cellGridStyle } from './pip-place-game'

describe('pip-place cells keep an explicit grid position', () => {
	test('every cell maps to its own row and column, whatever tiles are placed', () => {
		const seen = new Set<string>()
		for (let row = 0; row < 4; row++) {
			for (let col = 0; col < 5; col++) {
				const style = cellGridStyle({ row, col })
				expect(style).toEqual({ gridRow: row + 1, gridColumn: col + 1 })
				seen.add(`${style.gridRow}/${style.gridColumn}`)
			}
		}
		expect(seen.size).toBe(20)
	})
})
