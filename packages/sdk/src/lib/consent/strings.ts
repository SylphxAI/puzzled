/**
 * Consent String Utilities
 *
 * Parse and generate IAB TCF and GPP consent strings.
 *
 * @example
 * ```typescript
 * import { parseTCFString, parseUSPrivacyString, generateSimpleConsentString } from '@sylphx/platform-sdk/consent'
 *
 * // Parse TCF v2 consent string
 * const tcf = parseTCFString(consentString)
 * console.log(tcf.purposesConsent) // [1, 2, 3]
 *
 * // Parse US Privacy string (CCPA)
 * const usPrivacy = parseUSPrivacyString('1YNN')
 * console.log(usPrivacy.saleOptOut) // false
 *
 * // Generate a simple consent string for your app
 * const myString = generateSimpleConsentString({
 *   analytics: true,
 *   marketing: false,
 * })
 * ```
 */

import type { TCFConsentString, GPPString, ConsentState } from './types'

// ============================================================================
// Base64url Utilities
// ============================================================================

const BASE64URL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

function decodeBase64url(str: string): Uint8Array {
	// Add padding if needed
	const padding = (4 - (str.length % 4)) % 4
	const padded = str + '='.repeat(padding)

	// Replace URL-safe chars with standard Base64
	const base64 = padded.replace(/-/g, '+').replace(/_/g, '/')

	// Decode
	const binary = atob(base64)
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i)
	}
	return bytes
}

function encodeBase64url(bytes: Uint8Array): string {
	let binary = ''
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i])
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// ============================================================================
// Bit Field Utilities
// ============================================================================

class BitReader {
	private bytes: Uint8Array
	private bitPosition: number = 0

	constructor(bytes: Uint8Array) {
		this.bytes = bytes
	}

	readBits(numBits: number): number {
		let result = 0
		for (let i = 0; i < numBits; i++) {
			const byteIndex = Math.floor(this.bitPosition / 8)
			const bitIndex = 7 - (this.bitPosition % 8)

			if (byteIndex < this.bytes.length) {
				const bit = (this.bytes[byteIndex] >> bitIndex) & 1
				result = (result << 1) | bit
			}

			this.bitPosition++
		}
		return result
	}

	readBoolean(): boolean {
		return this.readBits(1) === 1
	}

	readDate(): Date {
		// TCF dates are deciseconds since epoch
		const deciseconds = this.readBits(36)
		return new Date(deciseconds * 100)
	}

	readString(numChars: number): string {
		let result = ''
		for (let i = 0; i < numChars; i++) {
			const charCode = this.readBits(6)
			result += String.fromCharCode(charCode + 65)
		}
		return result
	}

	readBitField(numBits: number): number[] {
		const result: number[] = []
		for (let i = 1; i <= numBits; i++) {
			if (this.readBoolean()) {
				result.push(i)
			}
		}
		return result
	}

	get position(): number {
		return this.bitPosition
	}

	seek(position: number): void {
		this.bitPosition = position
	}
}

// ============================================================================
// TCF v2 Parsing
// ============================================================================

/**
 * Parse an IAB TCF v2 consent string
 *
 * @param consentString - The TCF consent string
 * @returns Parsed consent information
 *
 * @example
 * ```typescript
 * const tcf = parseTCFString('COP4LfOOP4LfOC_AAAENAwCAAP_AAH_AAAAAAAAAFwAQAFwAAAAA')
 *
 * console.log(tcf.version) // 2
 * console.log(tcf.purposesConsent) // [1, 2, 3, 4]
 * console.log(tcf.vendorConsent) // [1, 2, 3]
 * ```
 */
export function parseTCFString(consentString: string): TCFConsentString | null {
	try {
		// Split into segments
		const segments = consentString.split('.')
		if (segments.length === 0) return null

		// Decode core segment
		const bytes = decodeBase64url(segments[0])
		const reader = new BitReader(bytes)

		// Read core fields
		const version = reader.readBits(6)
		if (version !== 2) {
			// Only TCF v2 supported
			return null
		}

		const created = reader.readDate()
		const lastUpdated = reader.readDate()
		const cmpId = reader.readBits(12)
		const cmpVersion = reader.readBits(12)
		const consentScreen = reader.readBits(6)
		const consentLanguage = reader.readString(2)
		const vendorListVersion = reader.readBits(12)
		const tcfPolicyVersion = reader.readBits(6)
		const isServiceSpecific = reader.readBoolean()
		const useNonStandardStacks = reader.readBoolean()
		const specialFeatureOptIns = reader.readBitField(12)

		// Purposes consent (24 bits)
		const purposesConsent = reader.readBitField(24)

		// Purposes legitimate interest (24 bits)
		const purposesLI = reader.readBitField(24)

		// Purpose one treatment
		const purposeOneTreatment = reader.readBoolean()

		// Publisher country code
		const publisherCC = reader.readString(2)

		// Vendor consent section
		const vendorConsentMaxId = reader.readBits(16)
		const vendorConsentIsRange = reader.readBoolean()

		let vendorConsent: number[] = []
		if (vendorConsentIsRange) {
			const numEntries = reader.readBits(12)
			for (let i = 0; i < numEntries; i++) {
				const isRange = reader.readBoolean()
				const startId = reader.readBits(16)
				if (isRange) {
					const endId = reader.readBits(16)
					for (let id = startId; id <= endId; id++) {
						vendorConsent.push(id)
					}
				} else {
					vendorConsent.push(startId)
				}
			}
		} else {
			vendorConsent = reader.readBitField(vendorConsentMaxId)
		}

		return {
			version,
			consentScreen,
			cmpId,
			cmpVersion,
			created,
			lastUpdated,
			purposesConsent,
			purposesLI,
			vendorConsent,
		}
	} catch {
		return null
	}
}

/**
 * Check if a TCF string grants consent for a purpose
 */
export function hasTCFPurposeConsent(tcf: TCFConsentString, purposeId: number): boolean {
	return tcf.purposesConsent.includes(purposeId)
}

/**
 * Check if a TCF string grants consent for a vendor
 */
export function hasTCFVendorConsent(tcf: TCFConsentString, vendorId: number): boolean {
	return tcf.vendorConsent.includes(vendorId)
}

// ============================================================================
// US Privacy String (CCPA)
// ============================================================================

export interface USPrivacyString {
	/** Version number */
	version: number
	/** Whether notice was given */
	noticeGiven: boolean | null
	/** Whether user opted out of sale */
	saleOptOut: boolean | null
	/** Whether LSPA (Limited Service Provider Agreement) is in effect */
	lspaInEffect: boolean | null
}

/**
 * Parse a US Privacy string (CCPA format)
 *
 * Format: [version][notice][optOut][lspa]
 * Example: "1YNN" = version 1, notice given, no opt-out, no LSPA
 *
 * @param usPrivacy - The US Privacy string (4 characters)
 * @returns Parsed string or null if invalid
 *
 * @example
 * ```typescript
 * const usp = parseUSPrivacyString('1YNN')
 * // { version: 1, noticeGiven: true, saleOptOut: false, lspaInEffect: false }
 *
 * const usp2 = parseUSPrivacyString('1YYN')
 * // { version: 1, noticeGiven: true, saleOptOut: true, lspaInEffect: false }
 * ```
 */
export function parseUSPrivacyString(usPrivacy: string): USPrivacyString | null {
	if (usPrivacy.length !== 4) return null

	const version = parseInt(usPrivacy[0], 10)
	if (isNaN(version) || version < 1) return null

	const parseChar = (c: string): boolean | null => {
		if (c === 'Y') return true
		if (c === 'N') return false
		if (c === '-') return null
		return null
	}

	return {
		version,
		noticeGiven: parseChar(usPrivacy[1]),
		saleOptOut: parseChar(usPrivacy[2]),
		lspaInEffect: parseChar(usPrivacy[3]),
	}
}

/**
 * Generate a US Privacy string
 *
 * @param options - Privacy options
 * @returns US Privacy string
 */
export function generateUSPrivacyString(options: {
	noticeGiven?: boolean
	saleOptOut?: boolean
	lspaInEffect?: boolean
}): string {
	const charFor = (value?: boolean): string => {
		if (value === true) return 'Y'
		if (value === false) return 'N'
		return '-'
	}

	return (
		'1' +
		charFor(options.noticeGiven) +
		charFor(options.saleOptOut) +
		charFor(options.lspaInEffect)
	)
}

// ============================================================================
// Simple Consent String (Custom Format)
// ============================================================================

/**
 * Generate a simple consent string for your app
 *
 * Format: version.timestamp.consents
 * Where consents is a base64-encoded JSON object
 *
 * @param consents - Consent decisions by category
 * @param version - Consent version (default: "1")
 * @returns Encoded consent string
 *
 * @example
 * ```typescript
 * const str = generateSimpleConsentString({
 *   analytics: true,
 *   marketing: false,
 *   preferences: true,
 * })
 * // Returns: "1.1703980800.eyJhbmFseXRpY3MiOnRydWUsIm1hcmtldGluZyI6ZmFsc2UsInByZWZlcmVuY2VzIjp0cnVlfQ"
 * ```
 */
export function generateSimpleConsentString(
	consents: Record<string, boolean>,
	version: string = '1'
): string {
	const timestamp = Math.floor(Date.now() / 1000)
	const payload = JSON.stringify(consents)
	const encoded = encodeBase64url(new TextEncoder().encode(payload))

	return `${version}.${timestamp}.${encoded}`
}

/**
 * Parse a simple consent string
 *
 * @param consentString - The consent string to parse
 * @returns Parsed consent or null if invalid
 */
export function parseSimpleConsentString(
	consentString: string
): { version: string; timestamp: number; consents: Record<string, boolean> } | null {
	try {
		const parts = consentString.split('.')
		if (parts.length !== 3) return null

		const [version, timestampStr, encoded] = parts
		const timestamp = parseInt(timestampStr, 10)
		if (isNaN(timestamp)) return null

		const payload = new TextDecoder().decode(decodeBase64url(encoded))
		const consents = JSON.parse(payload)

		return { version, timestamp, consents }
	} catch {
		return null
	}
}

/**
 * Convert consent state to simple consent string
 */
export function consentStateToString(state: ConsentState): string {
	return generateSimpleConsentString(state.consents, state.version)
}

/**
 * Parse simple consent string to consent state
 */
export function stringToConsentState(consentString: string): ConsentState | null {
	const parsed = parseSimpleConsentString(consentString)
	if (!parsed) return null

	return {
		consents: parsed.consents,
		version: parsed.version,
		updatedAt: new Date(parsed.timestamp * 1000).toISOString(),
		hasInteracted: true,
	}
}
