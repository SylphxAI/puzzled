import { describe, expect, test } from 'bun:test'
import { AD_CSP_HOSTS, adScriptSrc, adsConfig, adsFor } from './ads'
import { buildCsp } from './csp'

const configured = { ADS_ADSENSE_CLIENT_ID: 'ca-pub-1234567890123456', ADS_SLOT_ID: '9876543210' }

function directive(csp: string, name: string): string {
	return csp.split('; ').find((part) => part.startsWith(`${name} `)) ?? ''
}

describe('ads config', () => {
	test('is off until both ids are set', () => {
		expect(adsConfig({})).toBeNull()
		expect(adsConfig({ ADS_ADSENSE_CLIENT_ID: configured.ADS_ADSENSE_CLIENT_ID })).toBeNull()
		expect(adsConfig({ ADS_SLOT_ID: configured.ADS_SLOT_ID })).toBeNull()
	})

	test('rejects malformed ids so a typo never reaches the page', () => {
		expect(adsConfig({ ADS_ADSENSE_CLIENT_ID: 'pub-123', ADS_SLOT_ID: '9876543210' })).toBeNull()
		expect(
			adsConfig({ ADS_ADSENSE_CLIENT_ID: configured.ADS_ADSENSE_CLIENT_ID, ADS_SLOT_ID: '"><x' }),
		).toBeNull()
	})

	test('reads a configured account', () => {
		expect(adsConfig(configured)).toEqual({
			clientId: 'ca-pub-1234567890123456',
			slotId: '9876543210',
		})
	})

	test('Puzzled Plus removes the ad', () => {
		const config = adsConfig(configured)
		expect(adsFor(config, true)).toBeNull()
		expect(adsFor(config, false)).toEqual(config)
		expect(adsFor(null, false)).toBeNull()
	})

	test('loader script is the publisher-scoped AdSense URL', () => {
		expect(adScriptSrc('ca-pub-1234567890123456')).toBe(
			'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1234567890123456',
		)
	})
})

describe('ads in the content security policy', () => {
	test('unconfigured: no ad host is allowed anywhere', () => {
		const csp = buildCsp('abc')
		expect(csp).not.toContain('google')
		expect(csp).not.toContain('doubleclick')
	})

	test('configured: hosts join frame-src and connect-src, script-src is unchanged', () => {
		const csp = buildCsp('abc', { ads: true })
		for (const host of AD_CSP_HOSTS.frame) expect(directive(csp, 'frame-src')).toContain(host)
		for (const host of AD_CSP_HOSTS.connect) expect(directive(csp, 'connect-src')).toContain(host)
		expect(directive(csp, 'script-src')).toBe(directive(buildCsp('abc'), 'script-src'))
	})
})
