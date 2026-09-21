/**
 * i18n Configuration
 *
 * Supports 5 locales with region-specific variants:
 * - en-US: American English (default, no URL prefix)
 * - en-GB: British English
 * - zh-HK: 香港繁體中文
 * - zh-TW: 台灣正體中文
 * - zh-CN: 简体中文
 *
 * Every locale fact lives in one table, `LOCALE_REGISTRY`: the locale list, the
 * display names, the fallback chain, the formatting preferences, the Open Graph
 * codes, the hreflang tags and the language-menu badges are all derived from it,
 * so adding or removing a locale is a one-entry edit and the compiler names every
 * table that still has to answer for it. `lib/seo/metadata.ts` and the language
 * switcher read the same registry instead of re-keying the facts.
 */

// ==========================================
// Locale Definitions
// ==========================================

export const locales = [
	'en-US', // American English (default, no URL prefix)
	'en-GB', // British English
	'zh-HK', // Hong Kong Traditional Chinese
	'zh-TW', // Taiwan Traditional Chinese
	'zh-CN', // Simplified Chinese
] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en-US'

// ==========================================
// Locale registry (single source of truth)
// ==========================================

/** How a locale formats dates and numbers. */
export type LocaleFormatPreferences = {
	dateStyle: 'short' | 'medium' | 'long'
	numberGrouping: boolean
	currency: string
}

/** Everything the product knows about one locale. */
export type LocaleFacts = {
	/** BCP 47 tag: `<html lang>` and the hreflang cluster. */
	tag: string
	/** Open Graph locale code (`en_US`). */
	ogLocale: string
	/** English name, for operator and non-localised surfaces. */
	english: string
	/** Display name in the locale's own language. */
	native: string
	/** Compact native label for tight surfaces. */
	short: string
	/** Language-menu badge: the locale's script, not a flag. */
	badge: string
	/** Fallback locale when a key is missing; `null` is the base of its family. */
	fallback: Locale | null
	/** Date and number formatting preferences. */
	formats: LocaleFormatPreferences
}

export const LOCALE_REGISTRY: Record<Locale, LocaleFacts> = {
	'en-US': {
		tag: 'en-US',
		ogLocale: 'en_US',
		english: 'English (US)',
		native: 'English (US)',
		short: 'English',
		badge: 'EN',
		fallback: null, // Base English
		formats: { dateStyle: 'medium', numberGrouping: true, currency: 'USD' },
	},
	'en-GB': {
		tag: 'en-GB',
		ogLocale: 'en_GB',
		english: 'English (UK)',
		native: 'English (UK)',
		short: 'English',
		badge: 'EN',
		fallback: 'en-US', // Falls back to US English
		formats: { dateStyle: 'medium', numberGrouping: true, currency: 'GBP' },
	},
	'zh-HK': {
		tag: 'zh-HK',
		ogLocale: 'zh_HK',
		english: 'Chinese (Traditional, Hong Kong)',
		native: '繁體中文（香港）',
		short: '繁體中文',
		badge: '繁',
		fallback: null, // Base Traditional Chinese
		formats: { dateStyle: 'long', numberGrouping: true, currency: 'HKD' },
	},
	'zh-TW': {
		tag: 'zh-TW',
		ogLocale: 'zh_TW',
		english: 'Chinese (Traditional, Taiwan)',
		native: '正體中文（台灣）',
		short: '正體中文',
		badge: '繁',
		fallback: 'zh-HK', // Falls back to HK Traditional
		formats: { dateStyle: 'long', numberGrouping: true, currency: 'TWD' },
	},
	'zh-CN': {
		tag: 'zh-CN',
		ogLocale: 'zh_CN',
		english: 'Chinese (Simplified)',
		native: '简体中文',
		short: '简体中文',
		badge: '简',
		fallback: null, // Base Simplified Chinese
		formats: { dateStyle: 'long', numberGrouping: true, currency: 'CNY' },
	},
}

/** Project one registry field across every locale. */
export function localeFacts<K extends keyof LocaleFacts>(key: K): Record<Locale, LocaleFacts[K]> {
	return Object.fromEntries(
		locales.map((locale) => [locale, LOCALE_REGISTRY[locale][key]]),
	) as Record<Locale, LocaleFacts[K]>
}

// ==========================================
// Derived locale facts
// ==========================================

/** Display names (in native language). */
export const localeNames: Record<Locale, string> = localeFacts('native')

/** Short names for compact display. */
export const localeShortNames: Record<Locale, string> = localeFacts('short')

/** Language-menu badges: the script, not a flag. */
export const localeBadges: Record<Locale, string> = localeFacts('badge')

// Fallback chain: if a key is missing, try the parent locale
export const localeFallbacks: Record<Locale, Locale | null> = localeFacts('fallback')

/** Date and number formatting preferences. */
export const localeFormats: Record<Locale, LocaleFormatPreferences> = localeFacts('formats')

/** Group locales by language family. */
export type LocaleGroupName = 'english' | 'chinese'

/** Language subtag (from each locale's own tag) -> its group in the menu. */
const LANGUAGE_GROUPS: Record<string, LocaleGroupName> = {
	en: 'english',
	zh: 'chinese',
}

function groupLocales(group: LocaleGroupName): Locale[] {
	return locales.filter(
		(locale) => LANGUAGE_GROUPS[LOCALE_REGISTRY[locale].tag.split('-')[0]] === group,
	)
}

export const localeGroups: Record<LocaleGroupName, Locale[]> = {
	english: groupLocales('english'),
	chinese: groupLocales('chinese'),
}

// ==========================================
// Utilities
// ==========================================

export function isValidLocale(locale: string): locale is Locale {
	return locales.includes(locale as Locale)
}

function _getLocaleDirection(_locale: Locale): 'ltr' | 'rtl' {
	// All current locales are LTR
	// Add RTL locales here if needed (ar, he, fa, etc.)
	return 'ltr'
}

function _getLanguageFromLocale(locale: Locale): string {
	return locale.split('-')[0]
}

function _isChineseLocale(locale: Locale): boolean {
	return locale.startsWith('zh-')
}

function _isEnglishLocale(locale: Locale): boolean {
	return locale.startsWith('en-')
}
