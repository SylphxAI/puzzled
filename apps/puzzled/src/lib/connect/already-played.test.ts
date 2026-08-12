import { describe, expect, test } from 'bun:test'
import { Code, ConnectError } from '@connectrpc/connect'
import { isAlreadyPlayedError } from './already-played'

describe('isAlreadyPlayedError', () => {
	test('Connect AlreadyExists', () => {
		expect(isAlreadyPlayedError(new ConnectError('already_played', Code.AlreadyExists))).toBe(true)
	})

	test('message fallback', () => {
		expect(isAlreadyPlayedError(new Error('[already_exists] already_played'))).toBe(true)
		expect(isAlreadyPlayedError(new Error('network'))).toBe(false)
	})
})
