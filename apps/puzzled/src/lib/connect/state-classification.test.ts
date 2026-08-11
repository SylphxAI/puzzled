import { describe, expect, test } from 'bun:test'
import { classifyClientState, zustandForbiddenForServerState } from './state-classification'

describe('client state classification (arch §6)', () => {
	test('server authoritative → tanstack', () => {
		const d = classifyClientState({
			crossComponent: true,
			clientOwned: false,
			serverAuthoritative: true,
		})
		expect(d.classification).toBe('tanstack_server')
		expect(zustandForbiddenForServerState(true)).toBe(true)
	})
	test('client-owned cross-component → zustand ok', () => {
		const d = classifyClientState({
			crossComponent: true,
			clientOwned: true,
			serverAuthoritative: false,
		})
		expect(d.classification).toBe('zustand_client_owned')
	})
	test('local UI → react local', () => {
		const d = classifyClientState({
			crossComponent: false,
			clientOwned: true,
			serverAuthoritative: false,
		})
		expect(d.classification).toBe('react_local')
	})
})
