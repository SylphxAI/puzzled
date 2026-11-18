import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { DAILY_PICKS_KEY_PREFIX } from '@/lib/storage-keys'
import {
	DAILY_FREE_PICKS,
	parsePicks,
	picksLeft,
	readDailyPicks,
	recordDailyPick,
	subscribeDailyPicks,
} from './daily-picks'

class MemoryStorage {
	private map = new Map<string, string>()
	get length() {
		return this.map.size
	}
	key(index: number) {
		return [...this.map.keys()][index] ?? null
	}
	getItem(key: string) {
		return this.map.get(key) ?? null
	}
	setItem(key: string, value: string) {
		this.map.set(key, value)
	}
	removeItem(key: string) {
		this.map.delete(key)
	}
}

const original = globalThis.window
beforeEach(() => {
	const target = new EventTarget()
	;(globalThis as { window?: unknown }).window = Object.assign(target, {
		localStorage: new MemoryStorage(),
	})
})
afterEach(() => {
	;(globalThis as { window?: unknown }).window = original
})

describe('daily picks mirror', () => {
	test('mirrors the core free floor of three', () => {
		expect(DAILY_FREE_PICKS).toBe(3)
		expect(picksLeft(0)).toBe(3)
		expect(picksLeft(2)).toBe(1)
		expect(picksLeft(5)).toBe(0)
	})

	test('malformed storage reads as no picks, duplicates collapse', () => {
		expect(parsePicks(null)).toEqual([])
		expect(parsePicks('not json')).toEqual([])
		expect(parsePicks('{"a":1}')).toEqual([])
		expect(parsePicks('["sudoku","sudoku",3,"hive"]')).toEqual(['sudoku', 'hive'])
	})

	test('records each game once for the server day and drops older days', () => {
		const store = (window as unknown as { localStorage: MemoryStorage }).localStorage
		store.setItem(`${DAILY_PICKS_KEY_PREFIX}2026-11-17`, '["crossword"]')
		let changes = 0
		const unsubscribe = subscribeDailyPicks(() => {
			changes += 1
		})
		recordDailyPick('2026-11-18', 'word-groups')
		recordDailyPick('2026-11-18', 'word-groups')
		recordDailyPick('2026-11-18', 'sudoku')
		unsubscribe()
		expect(readDailyPicks('2026-11-18')).toEqual(['word-groups', 'sudoku'])
		expect(store.getItem(`${DAILY_PICKS_KEY_PREFIX}2026-11-17`)).toBeNull()
		expect(changes).toBe(2)
	})

	test('returns a stable reference while storage is unchanged', () => {
		recordDailyPick('2026-11-18', 'hive')
		expect(readDailyPicks('2026-11-18')).toBe(readDailyPicks('2026-11-18'))
	})
})
