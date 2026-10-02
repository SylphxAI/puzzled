import { beforeEach, describe, expect, test } from 'bun:test'
import { bootstrapGuestIdentity } from './guest-identity-bootstrap'

let afterPaint: (() => void) | undefined
let cancelled = false
let refreshes = 0
let admissions = 0
let issued = true
let fails = false
const refreshed = { current: false }
const refresh = () => {
	refreshes += 1
}
const admit = async () => {
	admissions += 1
	if (fails) throw new Error('unavailable')
	return { issued }
}
const schedule = (callback: () => void) => {
	afterPaint = callback
	return () => {
		cancelled = true
	}
}
const start = () => bootstrapGuestIdentity(refreshed, refresh, admit, schedule)
const tick = async () => {
	await Promise.resolve()
	await Promise.resolve()
}

beforeEach(() => {
	afterPaint = undefined
	cancelled = false
	refreshes = 0
	admissions = 0
	issued = true
	fails = false
	refreshed.current = false
})

describe('deferred guest cookie bootstrap', () => {
	test('admission begins after first paint and newly issued cookie refreshes only once', async () => {
		start()
		expect(admissions).toBe(0)
		afterPaint!()
		await tick()
		expect(refreshes).toBe(1)
		start()
		afterPaint!()
		await tick()
		expect(refreshes).toBe(1)
	})

	test('existing cookie and failed admission do not refresh or loop', async () => {
		issued = false
		start()
		afterPaint!()
		await tick()
		expect(refreshes).toBe(0)
		fails = true
		start()
		afterPaint!()
		await tick()
		expect(refreshes).toBe(0)
		expect(admissions).toBe(2)
	})

	test('unmount fences a late admission completion and cancels scheduled paint work', async () => {
		const cleanup = start()
		afterPaint!()
		cleanup()
		await tick()
		expect(cancelled).toBe(true)
		expect(refreshes).toBe(0)
	})
})
