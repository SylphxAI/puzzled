/**
 * Rust API proxy resolver tests (ADR-168 S2 authority cutover).
 */
import { afterEach, describe, expect, it } from 'bun:test'
import {
	resolveRustApiBaseUrl,
	shouldProxyHealthToRust,
	shouldProxyLeaderboardToRust,
	shouldProxyPuzzleGridToRust,
	shouldProxyPuzzleSubmitToRust,
	shouldProxyToRustInProd,
} from './rust-api-proxy'

describe('resolveRustApiBaseUrl', () => {
	const originalApiUrl = process.env.API_INTERNAL_URL

	afterEach(() => {
		if (originalApiUrl === undefined) delete process.env.API_INTERNAL_URL
		else process.env.API_INTERNAL_URL = originalApiUrl
	})

	it('prefers API_INTERNAL_URL without trailing slash', () => {
		process.env.API_INTERNAL_URL = 'http://api.puzzled.internal:8080/'
		expect(resolveRustApiBaseUrl()).toBe('http://api.puzzled.internal:8080')
	})

	it('falls back to local dev port when unset', () => {
		delete process.env.API_INTERNAL_URL
		expect(resolveRustApiBaseUrl()).toBe('http://127.0.0.1:8080')
	})
})

describe('shouldProxyToRustInProd', () => {
	const originalApiUrl = process.env.API_INTERNAL_URL

	afterEach(() => {
		if (originalApiUrl === undefined) delete process.env.API_INTERNAL_URL
		else process.env.API_INTERNAL_URL = originalApiUrl
	})

	it('is true when API_INTERNAL_URL is configured', () => {
		process.env.API_INTERNAL_URL = 'http://api.puzzled.internal:8080'
		expect(shouldProxyToRustInProd()).toBe(true)
	})

	it('is false when API_INTERNAL_URL is unset', () => {
		delete process.env.API_INTERNAL_URL
		expect(shouldProxyToRustInProd()).toBe(false)
	})
})

describe('shouldProxyHealthToRust', () => {
	const originalApiUrl = process.env.API_INTERNAL_URL
	const originalHealthFlag = process.env.PUZZLED_USE_RUST_HEALTH

	afterEach(() => {
		if (originalApiUrl === undefined) delete process.env.API_INTERNAL_URL
		else process.env.API_INTERNAL_URL = originalApiUrl
		if (originalHealthFlag === undefined) delete process.env.PUZZLED_USE_RUST_HEALTH
		else process.env.PUZZLED_USE_RUST_HEALTH = originalHealthFlag
	})

	it('proxies when API_INTERNAL_URL is configured', () => {
		process.env.API_INTERNAL_URL = 'http://api.puzzled.internal:8080'
		delete process.env.PUZZLED_USE_RUST_HEALTH
		expect(shouldProxyHealthToRust()).toBe(true)
	})

	it('proxies when PUZZLED_USE_RUST_HEALTH=1 for local dev', () => {
		delete process.env.API_INTERNAL_URL
		process.env.PUZZLED_USE_RUST_HEALTH = '1'
		expect(shouldProxyHealthToRust()).toBe(true)
	})

	it('keeps TS fallback when neither prod connect nor dev flag is set', () => {
		delete process.env.API_INTERNAL_URL
		delete process.env.PUZZLED_USE_RUST_HEALTH
		expect(shouldProxyHealthToRust()).toBe(false)
	})
})

describe('shouldProxyLeaderboardToRust', () => {
	const originalApiUrl = process.env.API_INTERNAL_URL
	const originalLeaderboardFlag = process.env.PUZZLED_USE_RUST_LEADERBOARD

	afterEach(() => {
		if (originalApiUrl === undefined) delete process.env.API_INTERNAL_URL
		else process.env.API_INTERNAL_URL = originalApiUrl
		if (originalLeaderboardFlag === undefined) delete process.env.PUZZLED_USE_RUST_LEADERBOARD
		else process.env.PUZZLED_USE_RUST_LEADERBOARD = originalLeaderboardFlag
	})

	it('proxies when API_INTERNAL_URL is configured', () => {
		process.env.API_INTERNAL_URL = 'http://api.puzzled.internal:8080'
		delete process.env.PUZZLED_USE_RUST_LEADERBOARD
		expect(shouldProxyLeaderboardToRust()).toBe(true)
	})

	it('proxies when PUZZLED_USE_RUST_LEADERBOARD=1 for local dev', () => {
		delete process.env.API_INTERNAL_URL
		process.env.PUZZLED_USE_RUST_LEADERBOARD = '1'
		expect(shouldProxyLeaderboardToRust()).toBe(true)
	})

	it('keeps TS fallback when neither prod connect nor dev flag is set', () => {
		delete process.env.API_INTERNAL_URL
		delete process.env.PUZZLED_USE_RUST_LEADERBOARD
		expect(shouldProxyLeaderboardToRust()).toBe(false)
	})
})

describe('shouldProxyPuzzleGridToRust', () => {
	const originalApiUrl = process.env.API_INTERNAL_URL
	const originalPuzzleGridFlag = process.env.PUZZLED_USE_RUST_PUZZLE_GRID

	afterEach(() => {
		if (originalApiUrl === undefined) delete process.env.API_INTERNAL_URL
		else process.env.API_INTERNAL_URL = originalApiUrl
		if (originalPuzzleGridFlag === undefined) delete process.env.PUZZLED_USE_RUST_PUZZLE_GRID
		else process.env.PUZZLED_USE_RUST_PUZZLE_GRID = originalPuzzleGridFlag
	})

	it('proxies when API_INTERNAL_URL is configured', () => {
		process.env.API_INTERNAL_URL = 'http://api.puzzled.internal:8080'
		delete process.env.PUZZLED_USE_RUST_PUZZLE_GRID
		expect(shouldProxyPuzzleGridToRust()).toBe(true)
	})

	it('proxies when PUZZLED_USE_RUST_PUZZLE_GRID=1 for local dev', () => {
		delete process.env.API_INTERNAL_URL
		process.env.PUZZLED_USE_RUST_PUZZLE_GRID = '1'
		expect(shouldProxyPuzzleGridToRust()).toBe(true)
	})

	it('keeps TS fallback when neither prod connect nor dev flag is set', () => {
		delete process.env.API_INTERNAL_URL
		delete process.env.PUZZLED_USE_RUST_PUZZLE_GRID
		expect(shouldProxyPuzzleGridToRust()).toBe(false)
	})
})

describe('shouldProxyPuzzleSubmitToRust', () => {
	const originalApiUrl = process.env.API_INTERNAL_URL
	const originalSubmitFlag = process.env.PUZZLED_USE_RUST_PUZZLE_SUBMIT

	afterEach(() => {
		if (originalApiUrl === undefined) delete process.env.API_INTERNAL_URL
		else process.env.API_INTERNAL_URL = originalApiUrl
		if (originalSubmitFlag === undefined) delete process.env.PUZZLED_USE_RUST_PUZZLE_SUBMIT
		else process.env.PUZZLED_USE_RUST_PUZZLE_SUBMIT = originalSubmitFlag
	})

	it('proxies when API_INTERNAL_URL is configured', () => {
		process.env.API_INTERNAL_URL = 'http://api.puzzled.internal:8080'
		delete process.env.PUZZLED_USE_RUST_PUZZLE_SUBMIT
		expect(shouldProxyPuzzleSubmitToRust()).toBe(true)
	})

	it('proxies when PUZZLED_USE_RUST_PUZZLE_SUBMIT=1 for local dev', () => {
		delete process.env.API_INTERNAL_URL
		process.env.PUZZLED_USE_RUST_PUZZLE_SUBMIT = '1'
		expect(shouldProxyPuzzleSubmitToRust()).toBe(true)
	})

	it('keeps TS fallback when neither prod connect nor dev flag is set', () => {
		delete process.env.API_INTERNAL_URL
		delete process.env.PUZZLED_USE_RUST_PUZZLE_SUBMIT
		expect(shouldProxyPuzzleSubmitToRust()).toBe(false)
	})
})