/**
 * Untranslated player-facing copy guard.
 *
 * A full (non-overlay) locale must not ship a player-facing string that is
 * byte-identical to en-US: it means a key was added in English and copied across
 * untranslated. The `admin` namespace (staff-only) and `games` (resolved from the
 * game catalogue, checked by its own test) are excluded. A value that is
 * legitimately the same in the target language - a brand, a provider name, a
 * format-only template, a loanword - is listed below with the reason.
 */
import { describe, expect, test } from 'bun:test'
import { resolveLocale } from '../../../scripts/i18n-resolved-catalogue'
import { type Locale, localeFallbacks, locales } from './config'

type Json = Record<string, unknown>

const EXCLUDED_NAMESPACES = new Set(['admin', 'games'])

/** Same in every language: product names, sign-in provider names, format-only strings. */
const SHARED_KEYS = new Set([
	'common.appName',
	'nav.plus',
	'nav.plusShort',
	'plus.name',
	'auth.google',
	'auth.apple',
	'settings.profile.bioCharacters',
	'settings.privacy.deleteAccount.confirmWord', // the word the player types; matches the English prompt
	'settings.account.providers.',
	'settings.connectedAccounts.providers.',
])

/** Loanwords and cognates that are the ordinary word in that language. */
const LOCALE_KEYS: Partial<Record<Locale, string[]>> = {
	ja: ['footer.copyright', 'share.text'], // legal entity line; share text is brand + placeholders
	es: [
		'footer.legalHeading',
		'footer.cookies',
		'leaderboard.moduleLabel',
		'legal.privacy.eyebrow',
		'legal.privacy.sections.cookies.title',
		'legal.terms.eyebrow',
		'settings.overview.badges.beta',
		'settings.overview.quickNotifications.push',
		'settings.notifications.overview.push',
		'settings.securityScore.points',
		'settings.securityScore.totalPoints',
		'settings.securityScore.levels.needsWork',
		'settings.streakFreeze.autoUsed',
		'settings.streakFreeze.manualUsed',
		'share.text',
		'share.card.altTemplate',
		'share.card.altDetailsTemplate',
		'stats.modules.title',
		'stats.modules.module',
		'stats.history.module',
	],
	'pt-BR': [
		'common.admin',
		'footer.legalHeading',
		'footer.cookies',
		'gameResult.status',
		'legal.privacy.eyebrow',
		'legal.privacy.sections.cookies.title',
		'legal.terms.eyebrow',
		'nav.menuTitle',
		'settings.overview.badges.beta',
		'settings.overview.quickNotifications.push',
		'settings.notifications.overview.push',
		'settings.securityScore.points',
		'settings.securityScore.totalPoints',
		'settings.streakFreeze.autoUsed',
		'settings.streakFreeze.manualUsed',
		'settings.profile.bio',
		'settings.sessions.tablet',
		'share.text',
		'share.card.altTemplate',
		'share.card.altDetailsTemplate',
		'stats.tier.bronze',
	],
}

function flatten(
	value: unknown,
	path = '',
	out: Record<string, string> = {},
): Record<string, string> {
	if (typeof value === 'string') out[path] = value
	else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
		for (const [key, child] of Object.entries(value as Json)) {
			flatten(child, path ? `${path}.${key}` : key, out)
		}
	}
	return out
}

function isAllowed(locale: Locale, key: string): boolean {
	const allowed = [...SHARED_KEYS, ...(LOCALE_KEYS[locale] ?? [])]
	return allowed.some((entry) => (entry.endsWith('.') ? key.startsWith(entry) : key === entry))
}

/** Keys whose value equals en-US, carries letters, and is not allow-listed. */
export function untranslatedKeys(locale: Locale): string[] {
	const english = flatten(resolveLocale('en-US'))
	const own = flatten(resolveLocale(locale))
	return Object.entries(english)
		.filter(([key, value]) => {
			if (EXCLUDED_NAMESPACES.has(key.split('.')[0] as string)) return false
			if (!/\p{L}{2}/u.test(value)) return false
			return own[key] === value && !isAllowed(locale, key)
		})
		.map(([key]) => key)
}

const fullLocales = locales.filter((locale) => locale !== 'en-US' && !localeFallbacks[locale])

describe('full locales carry no untranslated player-facing strings', () => {
	test('the full locales are the ones without a fallback', () => {
		expect(fullLocales).toEqual(['zh-HK', 'zh-CN', 'ja', 'es', 'pt-BR'])
	})

	for (const locale of fullLocales) {
		test(locale, () => {
			expect(untranslatedKeys(locale)).toEqual([])
		})
	}

	test('an allow-listed key is still identical to en-US (stale entries are removed)', () => {
		const english = flatten(resolveLocale('en-US'))
		for (const [locale, keys] of Object.entries(LOCALE_KEYS)) {
			const own = flatten(resolveLocale(locale as Locale))
			for (const key of keys ?? []) {
				expect(own[key] === english[key] && key in english).toBe(true)
			}
		}
	})
})
