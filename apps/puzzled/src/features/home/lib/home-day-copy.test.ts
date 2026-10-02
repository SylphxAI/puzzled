import { describe, expect, test } from 'bun:test'
import { isFreeGameDone } from '@/features/daily/lib/home-play-state'
import { homeDayCopy, lineupStatus } from './home-day-copy'

const base = {
	isMember: false,
	allDone: false,
	freeGameDone: false,
	currentStreak: 0,
	hasPlayedToday: false,
}

describe('home day copy', () => {
	test('guest done: done headline, See your result, no note', () => {
		expect(homeDayCopy({ ...base, freeGameDone: true })).toEqual({
			headlineKey: 'titleDone',
			cta: 'result',
			showsNote: false,
		})
	})
	test('guest not done: guest title, play, note', () => {
		expect(homeDayCopy(base)).toEqual({ headlineKey: 'guestTitle', cta: 'play', showsNote: true })
	})
	test('member all done: member done headline and See your result, not Play again', () => {
		const copy = homeDayCopy({ ...base, isMember: true, allDone: true, freeGameDone: true })
		expect(copy).toEqual({ headlineKey: 'titleMemberDone', cta: 'result', showsNote: false })
	})
	test('member free done only: done headline', () => {
		expect(homeDayCopy({ ...base, isMember: true, freeGameDone: true }).headlineKey).toBe(
			'titleDone',
		)
	})
	test('member streak waiting and not played', () => {
		const copy = homeDayCopy({ ...base, isMember: true, currentStreak: 4 })
		expect(copy).toEqual({ headlineKey: 'titleMemberStreak', cta: 'play', showsNote: false })
		expect(homeDayCopy({ ...base, isMember: true }).headlineKey).toBe('titleMemberReady')
	})
	test('an unverified read is not done', () => {
		const unknown = { crossword: { hasCompleted: true, statusAvailable: false } }
		const copy = homeDayCopy({ ...base, freeGameDone: isFreeGameDone(unknown, 'crossword') })
		expect(copy.headlineKey).toBe('guestTitle')
		expect(copy.cta).toBe('play')
	})
})

describe('lineup status', () => {
	test('completed is solved even for the free game', () => {
		expect(lineupStatus({ completed: true, isFreeToday: true })).toBe('solved')
		expect(lineupStatus({ completed: false, isFreeToday: true })).toBe('free')
		expect(lineupStatus({ completed: false, isFreeToday: false })).toBe('play')
	})
})
