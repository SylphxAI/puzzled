import { describe, expect, test } from 'bun:test'
import { defaultLocale } from './config'
import { redirect } from './routing'

/**
 * The signed-out console guard redirects through `redirect` from this module,
 * so the target it emits is what the browser follows straight after /settings.
 *
 * The URL strategy is 'as-needed': the default locale (en-US) carries no
 * prefix, the other locales do. A redirect that prefixed the default locale
 * would cost a second round trip — the proxy answers /en-US/* with a 308 back
 * to the unprefixed path — so the default-locale target must be unprefixed.
 */
function redirectTarget(locale: string): string {
	try {
		redirect({ href: { pathname: '/login', query: { callbackUrl: '/settings' } }, locale })
	} catch (error) {
		// Next's redirect() throws `NEXT_REDIRECT;<mode>;<url>;<status>;`.
		const url = (error as { digest?: string }).digest?.split(';')[2]
		if (url) return url
		throw error
	}
	throw new Error('redirect() did not throw, so no target was emitted')
}

describe('locale-aware console redirect', () => {
	test('the default locale redirects to an unprefixed /login (one hop)', () => {
		expect(redirectTarget(defaultLocale)).toBe('/login?callbackUrl=%2Fsettings')
	})

	test('non-default locales keep their prefix', () => {
		expect(redirectTarget('en-GB')).toBe('/en-GB/login?callbackUrl=%2Fsettings')
		expect(redirectTarget('zh-HK')).toBe('/zh-HK/login?callbackUrl=%2Fsettings')
	})
})
