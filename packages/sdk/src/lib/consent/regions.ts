/**
 * Geographic Region Detection
 *
 * Detect user region and determine applicable privacy regulations.
 *
 * @example
 * ```typescript
 * import { detectRegion, getApplicableRegulation, requiresConsentFirst } from '@sylphx/platform-sdk/consent'
 *
 * // From headers (server-side)
 * const region = detectRegion({ country: 'DE' })
 * console.log(region.regulation) // 'GDPR'
 * console.log(region.requiresConsentFirst) // true
 *
 * // Check if consent needed before analytics
 * if (requiresConsentFirst(region)) {
 *   showConsentBanner()
 * } else {
 *   initAnalytics()
 * }
 * ```
 */

import type { ConsentRegion, PrivacyRegulation } from './types'

// ============================================================================
// EU/EEA Countries
// ============================================================================

/**
 * EU member states (as of 2024)
 */
export const EU_COUNTRIES = new Set([
	'AT', // Austria
	'BE', // Belgium
	'BG', // Bulgaria
	'HR', // Croatia
	'CY', // Cyprus
	'CZ', // Czechia
	'DK', // Denmark
	'EE', // Estonia
	'FI', // Finland
	'FR', // France
	'DE', // Germany
	'GR', // Greece
	'HU', // Hungary
	'IE', // Ireland
	'IT', // Italy
	'LV', // Latvia
	'LT', // Lithuania
	'LU', // Luxembourg
	'MT', // Malta
	'NL', // Netherlands
	'PL', // Poland
	'PT', // Portugal
	'RO', // Romania
	'SK', // Slovakia
	'SI', // Slovenia
	'ES', // Spain
	'SE', // Sweden
])

/**
 * EEA countries (EU + Iceland, Liechtenstein, Norway)
 */
export const EEA_COUNTRIES = new Set([
	...EU_COUNTRIES,
	'IS', // Iceland
	'LI', // Liechtenstein
	'NO', // Norway
])

/**
 * Countries with GDPR-like requirements
 */
export const GDPR_LIKE_COUNTRIES = new Set([
	...EEA_COUNTRIES,
	'GB', // UK (UK GDPR)
	'CH', // Switzerland (FADP)
])

// ============================================================================
// US State Regulations
// ============================================================================

/**
 * US states with comprehensive privacy laws
 */
export const US_PRIVACY_STATES: Record<string, PrivacyRegulation> = {
	'CA': 'CCPA', // California (CCPA/CPRA)
	// Future states as laws go into effect:
	// 'VA': 'VCDPA', // Virginia
	// 'CO': 'CPA',   // Colorado
	// 'CT': 'CTDPA', // Connecticut
	// 'UT': 'UCPA',  // Utah
}

// ============================================================================
// Region Detection
// ============================================================================

/**
 * Detect region from geographic info
 *
 * @param info - Geographic information (from headers, IP lookup, or user input)
 * @returns Region with applicable regulation
 *
 * @example
 * ```typescript
 * // Cloudflare headers
 * const region = detectRegion({
 *   country: request.headers.get('CF-IPCountry'),
 *   subdivision: request.headers.get('CF-Region'),
 * })
 *
 * // Vercel headers
 * const region = detectRegion({
 *   country: request.headers.get('x-vercel-ip-country'),
 *   subdivision: request.headers.get('x-vercel-ip-country-region'),
 * })
 * ```
 */
export function detectRegion(info: {
	country?: string | null
	subdivision?: string | null
	timezone?: string | null
}): ConsentRegion {
	const country = (info.country ?? '').toUpperCase()
	const subdivision = info.subdivision?.toUpperCase()

	// Check EU/EEA
	const isEU = EEA_COUNTRIES.has(country) || GDPR_LIKE_COUNTRIES.has(country)

	// Check California
	const isCalifornia = country === 'US' && subdivision === 'CA'

	// Determine regulation
	let regulation: PrivacyRegulation = 'NONE'
	let requiresConsentFirst = false

	if (isEU) {
		regulation = 'GDPR'
		requiresConsentFirst = true
	} else if (country === 'BR') {
		regulation = 'LGPD'
		requiresConsentFirst = true
	} else if (country === 'CA') {
		regulation = 'PIPEDA'
		requiresConsentFirst = true
	} else if (country === 'ZA') {
		regulation = 'POPIA'
		requiresConsentFirst = true
	} else if (country === 'SG') {
		regulation = 'PDPA'
		requiresConsentFirst = false // Opt-out model
	} else if (country === 'JP') {
		regulation = 'APPI'
		requiresConsentFirst = false // Opt-out model
	} else if (country === 'US') {
		if (isCalifornia) {
			regulation = 'CCPA'
			requiresConsentFirst = false // Opt-out model
		} else if (subdivision && US_PRIVACY_STATES[subdivision]) {
			regulation = US_PRIVACY_STATES[subdivision]
			requiresConsentFirst = false
		}
	}

	return {
		country,
		subdivision: subdivision ? `${country}-${subdivision}` : undefined,
		isEU,
		isCalifornia,
		regulation,
		requiresConsentFirst,
	}
}

/**
 * Get applicable regulation for a country/region
 */
export function getApplicableRegulation(country: string, subdivision?: string): PrivacyRegulation {
	const region = detectRegion({ country, subdivision })
	return region.regulation
}

/**
 * Check if consent is required before tracking
 *
 * @param region - Region info
 * @returns Whether consent must be obtained before any tracking
 */
export function requiresConsentFirst(region: ConsentRegion): boolean {
	return region.requiresConsentFirst
}

/**
 * Check if region is in EU/EEA
 */
export function isEURegion(country: string): boolean {
	return EEA_COUNTRIES.has(country.toUpperCase())
}

/**
 * Check if region has GDPR or similar requirements
 */
export function hasGDPRRequirements(country: string): boolean {
	return GDPR_LIKE_COUNTRIES.has(country.toUpperCase())
}

/**
 * Infer region from timezone (fallback)
 *
 * Less accurate than IP-based detection but works client-side.
 */
export function inferRegionFromTimezone(timezone: string): ConsentRegion {
	// European timezones
	const euTimezones = [
		'Europe/Amsterdam', 'Europe/Berlin', 'Europe/Brussels',
		'Europe/Dublin', 'Europe/Helsinki', 'Europe/Lisbon',
		'Europe/London', 'Europe/Madrid', 'Europe/Paris',
		'Europe/Rome', 'Europe/Stockholm', 'Europe/Vienna',
		'Europe/Warsaw', 'Europe/Zurich',
	]

	const isLikelyEU = euTimezones.some(tz =>
		timezone.startsWith(tz) || timezone.startsWith('Europe/')
	)

	if (isLikelyEU) {
		return {
			country: 'EU', // Generic EU
			isEU: true,
			isCalifornia: false,
			regulation: 'GDPR',
			requiresConsentFirst: true,
		}
	}

	// Check for US Pacific (likely California)
	if (timezone === 'America/Los_Angeles' || timezone === 'America/San_Francisco') {
		return {
			country: 'US',
			subdivision: 'US-CA',
			isEU: false,
			isCalifornia: true,
			regulation: 'CCPA',
			requiresConsentFirst: false,
		}
	}

	// Default: no specific regulation
	return {
		country: 'XX',
		isEU: false,
		isCalifornia: false,
		regulation: 'NONE',
		requiresConsentFirst: false,
	}
}

// ============================================================================
// Header Extraction
// ============================================================================

/**
 * Extract region from common CDN headers
 *
 * Supports Cloudflare, Vercel, Fastly, Akamai, and AWS CloudFront.
 */
export function extractRegionFromHeaders(headers: Headers | Record<string, string>): ConsentRegion {
	const get = (name: string): string | null => {
		if (headers instanceof Headers) {
			return headers.get(name)
		}
		return headers[name] ?? headers[name.toLowerCase()] ?? null
	}

	// Cloudflare
	let country = get('CF-IPCountry')
	let subdivision = get('CF-Region')

	// Vercel
	if (!country) {
		country = get('x-vercel-ip-country')
		subdivision = get('x-vercel-ip-country-region')
	}

	// Fastly
	if (!country) {
		country = get('Fastly-Geo-Country-Code')
		subdivision = get('Fastly-Geo-Region')
	}

	// AWS CloudFront
	if (!country) {
		country = get('CloudFront-Viewer-Country')
		subdivision = get('CloudFront-Viewer-Country-Region')
	}

	// Akamai
	if (!country) {
		// Akamai uses X-Akamai-Edgescape which needs parsing
		const edgescape = get('X-Akamai-Edgescape')
		if (edgescape) {
			const countryMatch = edgescape.match(/country_code=(\w+)/)
			const regionMatch = edgescape.match(/region_code=(\w+)/)
			country = countryMatch?.[1] ?? null
			subdivision = regionMatch?.[1] ?? null
		}
	}

	return detectRegion({ country, subdivision })
}
