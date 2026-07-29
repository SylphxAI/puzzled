import { describe, expect, test } from 'bun:test'
import { healthQueryKeys } from './health-query'

describe('health query keys', () => {
	test('capability-scoped', () => {
		expect(healthQueryKeys.root[0]).toBeTruthy()
		expect(Array.isArray(healthQueryKeys.root)).toBe(true)
	})
})
