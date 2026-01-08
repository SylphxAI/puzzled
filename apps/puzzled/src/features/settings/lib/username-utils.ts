/**
 * Username utility functions
 * Pure functions for username validation, suggestions, and generation
 */

import { LIMITS } from './constants'

/**
 * Validate username format
 * @returns Error message if invalid, null if valid
 */
export function validateUsernameFormat(value: string): string | null {
	const usernameRegex = /^[a-z0-9_]+$/
	if (!usernameRegex.test(value)) {
		return 'Username can only contain lowercase letters, numbers, and underscores'
	}
	if (value.length < LIMITS.USERNAME_MIN_LENGTH) {
		return `Username must be at least ${LIMITS.USERNAME_MIN_LENGTH} characters`
	}
	if (value.length > LIMITS.USERNAME_MAX_LENGTH) {
		return `Username must be at most ${LIMITS.USERNAME_MAX_LENGTH} characters`
	}
	return null
}

/**
 * Generate username suggestions based on name or email (for initial setup)
 * Uses deterministic generation when a seed is provided (for testing)
 */
export function generateUsernameSuggestions(
	name: string | null,
	email: string,
	options?: { seed?: number },
): string[] {
	const suggestions: string[] = []
	const baseNames: string[] = []

	// Extract base from name
	if (name) {
		const nameParts = name.toLowerCase().split(/\s+/)
		baseNames.push(nameParts[0]) // First name
		if (nameParts.length > 1) {
			baseNames.push(`${nameParts[0]}_${nameParts[nameParts.length - 1]}`) // first_last
			baseNames.push(`${nameParts[0]}${nameParts[nameParts.length - 1][0]}`) // firstL
		}
	}

	// Extract base from email
	const emailBase = email
		.split('@')[0]
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '')
	if (emailBase.length >= 3) {
		baseNames.push(emailBase)
	}

	// Generate variations
	for (const base of baseNames) {
		if (base.length >= LIMITS.USERNAME_MIN_LENGTH && base.length <= LIMITS.USERNAME_MAX_LENGTH) {
			suggestions.push(base)
		}
		// Add suffix variations
		const suffix =
			options?.seed !== undefined ? (options.seed % 999) + 1 : Math.floor(Math.random() * 999) + 1
		const withSuffix = `${base}${suffix}`
		if (withSuffix.length <= LIMITS.USERNAME_MAX_LENGTH) {
			suggestions.push(withSuffix)
		}
	}

	// Dedupe and limit
	return [...new Set(suggestions)].slice(0, 3)
}

/**
 * Generate recovery suggestions when username is taken (Facebook-style)
 * Uses deterministic generation when a seed is provided (for testing)
 */
export function generateRecoverySuggestions(
	takenUsername: string,
	options?: { seed?: number; year?: number },
): string[] {
	const suggestions: string[] = []
	const base = takenUsername.toLowerCase().replace(/[^a-z0-9_]/g, '')

	if (base.length < 2) return []

	// Number suffixes (deterministic when seed provided)
	const year = (options?.year ?? new Date().getFullYear()).toString().slice(-2)
	const randomNum1 =
		options?.seed !== undefined ? (options.seed % 99) + 1 : Math.floor(Math.random() * 99) + 1
	const randomNum2 =
		options?.seed !== undefined ? ((options.seed + 1) % 99) + 1 : Math.floor(Math.random() * 99) + 1

	suggestions.push(`${base}${randomNum1}`)
	suggestions.push(`${base}_${randomNum2}`)
	suggestions.push(`${base}${year}`)

	// Prefix variations
	if (`the${base}`.length <= LIMITS.USERNAME_MAX_LENGTH) suggestions.push(`the${base}`)
	if (`${base}_official`.length <= LIMITS.USERNAME_MAX_LENGTH) suggestions.push(`${base}_official`)
	if (`real_${base}`.length <= LIMITS.USERNAME_MAX_LENGTH) suggestions.push(`real_${base}`)

	// Filter valid length and dedupe
	return [...new Set(suggestions)]
		.filter((s) => s.length >= LIMITS.USERNAME_MIN_LENGTH && s.length <= LIMITS.USERNAME_MAX_LENGTH)
		.slice(0, 4)
}

/**
 * Normalize username input (lowercase, trim)
 */
export function normalizeUsername(value: string): string {
	return value.toLowerCase().trim()
}

/**
 * Check if username is reserved (system usernames)
 */
export function isReservedUsername(username: string): boolean {
	const reserved = [
		'admin',
		'administrator',
		'root',
		'system',
		'support',
		'help',
		'info',
		'contact',
		'api',
		'app',
		'www',
		'mail',
		'email',
		'blog',
		'news',
		'shop',
		'store',
		'status',
		'settings',
		'account',
		'profile',
		'login',
		'logout',
		'signup',
		'signin',
		'register',
		'dashboard',
		'user',
		'users',
		'mod',
		'moderator',
		'staff',
		'team',
		'official',
		'puzzled',
		'puzzle',
		'game',
		'games',
		'play',
		'player',
	]
	return reserved.includes(username.toLowerCase())
}
