/**
 * i18n Configuration
 *
 * Supports 5 locales with region-specific variants:
 * - en-US: American English (default, no URL prefix)
 * - en-GB: British English
 * - zh-HK: 香港繁體中文
 * - zh-TW: 台灣正體中文
 * - zh-CN: 简体中文
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
// Display Names (in native language)
// ==========================================

export const localeNames: Record<Locale, string> = {
	'en-US': 'English (US)',
	'en-GB': 'English (UK)',
	'zh-HK': '繁體中文（香港）',
	'zh-TW': '正體中文（台灣）',
	'zh-CN': '简体中文',
}

// Short names for compact display
export const localeShortNames: Record<Locale, string> = {
	'en-US': 'English',
	'en-GB': 'English',
	'zh-HK': '繁體中文',
	'zh-TW': '正體中文',
	'zh-CN': '简体中文',
}

// ==========================================
// Country/Region Codes (for flags)
// ==========================================

// ISO 3166-1 alpha-2 codes for Iconify circle-flags
export const localeCountryCodes: Record<Locale, string> = {
	'en-US': 'us',
	'en-GB': 'gb',
	'zh-HK': 'hk',
	'zh-TW': 'tw',
	'zh-CN': 'cn',
}

// ==========================================
// Language Families (for fallback)
// ==========================================

// Fallback chain: if a key is missing, try the parent locale
export const localeFallbacks: Record<Locale, Locale | null> = {
	'en-US': null, // Base English
	'en-GB': 'en-US', // Falls back to US English
	'zh-HK': null, // Base Traditional Chinese
	'zh-TW': 'zh-HK', // Falls back to HK Traditional
	'zh-CN': null, // Base Simplified Chinese
}

// Group locales by language family
export const localeGroups = {
	english: ['en-US', 'en-GB'] as const,
	chinese: ['zh-HK', 'zh-TW', 'zh-CN'] as const,
}

// ==========================================
// Formatting Preferences
// ==========================================

export const localeFormats: Record<
	Locale,
	{
		dateStyle: 'short' | 'medium' | 'long'
		numberGrouping: boolean
		currency: string
	}
> = {
	'en-US': { dateStyle: 'medium', numberGrouping: true, currency: 'USD' },
	'en-GB': { dateStyle: 'medium', numberGrouping: true, currency: 'GBP' },
	'zh-HK': { dateStyle: 'long', numberGrouping: true, currency: 'HKD' },
	'zh-TW': { dateStyle: 'long', numberGrouping: true, currency: 'TWD' },
	'zh-CN': { dateStyle: 'long', numberGrouping: true, currency: 'CNY' },
}

// ==========================================
// Utilities
// ==========================================

export function isValidLocale(locale: string): locale is Locale {
	return locales.includes(locale as Locale)
}

export function getLocaleDirection(_locale: Locale): 'ltr' | 'rtl' {
	// All current locales are LTR
	// Add RTL locales here if needed (ar, he, fa, etc.)
	return 'ltr'
}

export function getLanguageFromLocale(locale: Locale): string {
	return locale.split('-')[0]
}

export function isChineseLocale(locale: Locale): boolean {
	return locale.startsWith('zh-')
}

export function isEnglishLocale(locale: Locale): boolean {
	return locale.startsWith('en-')
}
