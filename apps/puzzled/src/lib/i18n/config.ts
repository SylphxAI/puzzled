// All supported locales (16 total)
// Per spec: Use BCP 47 script subtags for Chinese variants
export const locales = [
	'en', // English (default, non-prefixed)
	'zh-Hans', // Simplified Chinese
	'zh-Hant', // Traditional Chinese
	'es', // Spanish
	'ja', // Japanese
	'ko', // Korean
	'de', // German
	'fr', // French
	'pt-BR', // Brazilian Portuguese
	'it', // Italian
	'nl', // Dutch
	'pl', // Polish
	'tr', // Turkish
	'id', // Indonesian
	'th', // Thai
	'vi', // Vietnamese
] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

export const localeNames: Record<Locale, string> = {
	en: 'English',
	'zh-Hans': '简体中文',
	'zh-Hant': '繁體中文',
	es: 'Español',
	ja: '日本語',
	ko: '한국어',
	de: 'Deutsch',
	fr: 'Français',
	'pt-BR': 'Português (Brasil)',
	it: 'Italiano',
	nl: 'Nederlands',
	pl: 'Polski',
	tr: 'Türkçe',
	id: 'Bahasa Indonesia',
	th: 'ไทย',
	vi: 'Tiếng Việt',
}

// ISO 3166-1 alpha-2 country codes for flag icons (use Iconify circle-flags)
// Note: zh-Hans/zh-Hant are script-based, we use CN/TW flags as representative
export const localeCountryCodes: Record<Locale, string> = {
	en: 'us',
	'zh-Hans': 'cn',
	'zh-Hant': 'tw',
	es: 'es',
	ja: 'jp',
	ko: 'kr',
	de: 'de',
	fr: 'fr',
	'pt-BR': 'br',
	it: 'it',
	nl: 'nl',
	pl: 'pl',
	tr: 'tr',
	id: 'id',
	th: 'th',
	vi: 'vn',
}
