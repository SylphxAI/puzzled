import { describe, expect, test } from 'bun:test'
import { CLIENT_NAMESPACES, pickMessages } from './client-messages'

describe('pickMessages', () => {
	const messages = { common: { ok: 'OK' }, settings: { title: 'Settings' }, legal: { x: 'y' } }

	test('keeps only the named namespaces', () => {
		expect(pickMessages(messages, ['common', 'settings'])).toEqual({
			common: { ok: 'OK' },
			settings: { title: 'Settings' },
		})
	})

	test('ignores namespaces the catalogue does not carry', () => {
		expect(pickMessages(messages, ['common', 'missing'])).toEqual({ common: { ok: 'OK' } })
	})

	test('the shared client set leaves route-only namespaces out', () => {
		expect(CLIENT_NAMESPACES).not.toContain('settings')
		expect(CLIENT_NAMESPACES).not.toContain('admin')
	})
})
