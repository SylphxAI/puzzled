#!/usr/bin/env npx tsx
/**
 * i18n Validation Script
 *
 * Validates that all locales have complete translations.
 * Fails CI if any translation keys are missing.
 *
 * Usage: npx tsx scripts/validate-i18n.ts
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

const MESSAGES_DIR = path.join(process.cwd(), 'src/messages')
const REFERENCE_LOCALE = 'en'

type MessageObject = Record<string, unknown>

/**
 * Recursively get all keys from a nested object
 */
function getAllKeys(obj: MessageObject, prefix = ''): string[] {
	const keys: string[] = []

	for (const [key, value] of Object.entries(obj)) {
		const fullKey = prefix ? `${prefix}.${key}` : key

		if (value && typeof value === 'object' && !Array.isArray(value)) {
			keys.push(...getAllKeys(value as MessageObject, fullKey))
		} else {
			keys.push(fullKey)
		}
	}

	return keys
}

/**
 * Load messages from a locale file
 */
function loadMessages(locale: string): MessageObject {
	const filePath = path.join(MESSAGES_DIR, `${locale}.json`)

	if (!fs.existsSync(filePath)) {
		throw new Error(`Locale file not found: ${filePath}`)
	}

	const content = fs.readFileSync(filePath, 'utf-8')
	return JSON.parse(content) as MessageObject
}

/**
 * Get value at path from nested object
 */
function getValueAtPath(obj: MessageObject, keyPath: string): unknown {
	const parts = keyPath.split('.')
	let current: unknown = obj

	for (const part of parts) {
		if (current && typeof current === 'object' && part in current) {
			current = (current as MessageObject)[part]
		} else {
			return undefined
		}
	}

	return current
}

/**
 * Main validation function
 */
async function main() {
	console.log('🌐 Validating i18n translations...\n')

	// Get all locale files
	const files = fs.readdirSync(MESSAGES_DIR).filter((f) => f.endsWith('.json'))
	const locales = files.map((f) => f.replace('.json', ''))

	console.log(`Found ${locales.length} locales: ${locales.join(', ')}\n`)

	// Load reference messages (English)
	const referenceMessages = loadMessages(REFERENCE_LOCALE)
	const referenceKeys = getAllKeys(referenceMessages)

	console.log(`Reference locale (${REFERENCE_LOCALE}) has ${referenceKeys.length} keys\n`)

	// Track errors
	const errors: { locale: string; missingKeys: string[]; extraKeys: string[] }[] = []

	// Validate each locale
	for (const locale of locales) {
		if (locale === REFERENCE_LOCALE) continue

		try {
			const messages = loadMessages(locale)
			const keys = getAllKeys(messages)

			const missingKeys = referenceKeys.filter((key) => !keys.includes(key))
			const extraKeys = keys.filter((key) => !referenceKeys.includes(key))

			// Also check for empty string values
			const emptyValues = referenceKeys.filter((key) => {
				const value = getValueAtPath(messages, key)
				return value === '' || value === null
			})

			if (missingKeys.length > 0 || emptyValues.length > 0) {
				errors.push({
					locale,
					missingKeys: [...missingKeys, ...emptyValues.map((k) => `${k} (empty)`)],
					extraKeys,
				})
			}

			// Report status
			if (missingKeys.length === 0 && emptyValues.length === 0) {
				console.log(`✅ ${locale}: Complete (${keys.length} keys)`)
			} else {
				console.log(
					`❌ ${locale}: Missing ${missingKeys.length + emptyValues.length} keys, ${extraKeys.length} extra`,
				)
			}
		} catch (error) {
			console.error(`❌ ${locale}: Failed to parse - ${error}`)
			errors.push({
				locale,
				missingKeys: ['FILE_PARSE_ERROR'],
				extraKeys: [],
			})
		}
	}

	// Report detailed errors
	if (errors.length > 0) {
		console.log('\n' + '='.repeat(60))
		console.log('VALIDATION ERRORS')
		console.log('='.repeat(60) + '\n')

		for (const { locale, missingKeys, extraKeys } of errors) {
			console.log(`\n📛 ${locale}:`)

			if (missingKeys.length > 0) {
				console.log('  Missing keys:')
				for (const key of missingKeys.slice(0, 20)) {
					console.log(`    - ${key}`)
				}
				if (missingKeys.length > 20) {
					console.log(`    ... and ${missingKeys.length - 20} more`)
				}
			}

			if (extraKeys.length > 0) {
				console.log('  Extra keys (may be intentional):')
				for (const key of extraKeys.slice(0, 10)) {
					console.log(`    + ${key}`)
				}
				if (extraKeys.length > 10) {
					console.log(`    ... and ${extraKeys.length - 10} more`)
				}
			}
		}

		console.log('\n' + '='.repeat(60))
		console.log(
			`\n❌ Validation failed: ${errors.length} locale(s) have issues\n`,
		)
		process.exit(1)
	}

	console.log('\n✅ All translations validated successfully!\n')
	process.exit(0)
}

main().catch((error) => {
	console.error('Validation script error:', error)
	process.exit(1)
})
