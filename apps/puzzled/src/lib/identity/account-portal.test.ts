import { describe, expect, test } from 'bun:test'
import { accountPortalAnchor, accountPortalLink } from './account-portal'

describe('accountPortalLink', () => {
	test('uses the configured Account Portal on the app domain', () => {
		expect(accountPortalLink('https://account.puzzled.gg')).toEqual({
			href: 'https://account.puzzled.gg/',
			external: true,
		})
	})

	test('falls back to the in-app support page when unset or invalid', () => {
		for (const value of [undefined, '', '  ', 'not a url', 'http://account.puzzled.gg']) {
			expect(accountPortalLink(value)).toEqual({ href: '/support', external: false })
		}
	})

	test('opens a new tab only for the external portal', () => {
		expect(accountPortalAnchor({ href: '/support', external: false })).toEqual({
			href: '/support',
		})
		expect(accountPortalAnchor({ href: 'https://account.puzzled.gg/', external: true })).toEqual({
			href: 'https://account.puzzled.gg/',
			target: '_blank',
			rel: 'noopener noreferrer',
		})
	})
})
