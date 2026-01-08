/**
 * Locale Map - Single Source of Truth (SSOT)
 *
 * Maps app locale codes to Intl-compatible locale codes.
 * Used for formatting currencies, dates, and numbers.
 */

/**
 * Map of app locales to full Intl locale codes
 * Comprehensive list covering all supported app locales
 */
export const LOCALE_MAP: Readonly<Record<string, string>> = {
	en: 'en-US',
	es: 'es-ES',
	fr: 'fr-FR',
	de: 'de-DE',
	it: 'it-IT',
	pt: 'pt-PT',
	'pt-BR': 'pt-BR',
	nl: 'nl-NL',
	pl: 'pl-PL',
	ru: 'ru-RU',
	ja: 'ja-JP',
	ko: 'ko-KR',
	zh: 'zh-CN',
	'zh-Hans': 'zh-CN',
	'zh-Hant': 'zh-TW',
	ar: 'ar-SA',
	hi: 'hi-IN',
	th: 'th-TH',
	vi: 'vi-VN',
	id: 'id-ID',
	tr: 'tr-TR',
} as const

/**
 * Get the Intl-compatible locale code for a given app locale
 * @param locale - App locale code (e.g., 'en', 'ja')
 * @returns Full Intl locale code (e.g., 'en-US', 'ja-JP')
 */
export function getIntlLocale(locale: string): string {
	return LOCALE_MAP[locale] ?? 'en-US'
}

/**
 * Format a currency amount using the appropriate locale
 * @param amountCents - Amount in cents
 * @param currency - Currency code (e.g., 'usd', 'eur')
 * @param locale - App locale code (defaults to 'en')
 * @returns Formatted currency string (e.g., "$4.99", "$5")
 */
export function formatCurrency(amountCents: number, currency: string, locale = 'en'): string {
	const intlLocale = getIntlLocale(locale)
	// Show whole numbers without decimals (e.g., $5 instead of $5.00)
	const hasDecimalCents = amountCents % 100 !== 0
	return new Intl.NumberFormat(intlLocale, {
		style: 'currency',
		currency: currency.toUpperCase(),
		minimumFractionDigits: hasDecimalCents ? 2 : 0,
		maximumFractionDigits: 2,
	}).format(amountCents / 100)
}

/**
 * Get the monthly equivalent for an annual amount
 * @param annualAmountCents - Annual amount in cents
 * @param currency - Currency code
 * @param locale - App locale code
 * @returns Formatted monthly equivalent string
 */
export function getMonthlyEquivalent(
	annualAmountCents: number,
	currency: string,
	locale: string,
): string {
	const monthlyAmount = Math.round(annualAmountCents / 12)
	return formatCurrency(monthlyAmount, currency, locale)
}
