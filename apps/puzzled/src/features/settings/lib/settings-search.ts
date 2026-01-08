import {
	Bell,
	Clock,
	CreditCard,
	Download,
	Eye,
	Globe,
	History,
	Key,
	Link2,
	type LucideIcon,
	Mail,
	Minimize2,
	Moon,
	Shield,
	ShieldCheck,
	Smartphone,
	Trash2,
	User,
	UserCircle,
} from 'lucide-react'

/**
 * Settings Search Index
 *
 * Defines all searchable settings with their metadata for the command palette search.
 *
 * NOTE: The search index (titles, descriptions, keywords) is intentionally kept in English.
 * This allows universal search functionality regardless of the user's locale.
 * The UI strings (placeholder, results count, etc.) are internationalized in the component
 * using the 'settings.search' namespace in the message files.
 *
 * Full localization of the search index would require:
 * 1. Building the index dynamically per locale
 * 2. Translating all keywords for each supported language
 * 3. Significant increase in bundle size for keyword translations
 *
 * The current approach balances functionality with maintainability.
 */

export type SettingSection =
	| 'profile'
	| 'account'
	| 'security'
	| 'subscription'
	| 'preferences'
	| 'privacy'

export type SettingItem = {
	id: string
	title: string
	description: string
	keywords: string[]
	href: string
	section: SettingSection
	icon: LucideIcon
}

/**
 * All searchable settings in the application
 */
export const settingsIndex: SettingItem[] = [
	// Profile Section
	{
		id: 'profile-name',
		title: 'Display Name',
		description: 'Change your display name shown on your profile',
		keywords: ['name', 'display', 'full name', 'edit name'],
		href: '/settings/profile',
		section: 'profile',
		icon: User,
	},
	{
		id: 'profile-username',
		title: 'Username',
		description: 'Set or change your unique username for leaderboards',
		keywords: ['username', 'handle', '@', 'unique', 'leaderboard'],
		href: '/settings/profile',
		section: 'profile',
		icon: UserCircle,
	},
	{
		id: 'profile-bio',
		title: 'Bio',
		description: 'Add a short bio to your public profile',
		keywords: ['bio', 'about', 'description', 'introduction'],
		href: '/settings/profile',
		section: 'profile',
		icon: User,
	},
	{
		id: 'profile-avatar',
		title: 'Profile Picture',
		description: 'Upload or change your avatar image',
		keywords: ['avatar', 'picture', 'photo', 'image', 'profile pic'],
		href: '/settings/profile',
		section: 'profile',
		icon: UserCircle,
	},
	{
		id: 'profile-public',
		title: 'Public Profile',
		description: 'Make your profile visible to other users',
		keywords: ['public', 'visible', 'private', 'visibility', 'profile visibility'],
		href: '/settings/profile',
		section: 'profile',
		icon: Eye,
	},

	// Account Section
	{
		id: 'account-connected',
		title: 'Connected Accounts',
		description: 'Manage your linked social accounts (Google, Apple, etc.)',
		keywords: [
			'connected',
			'linked',
			'social',
			'google',
			'apple',
			'github',
			'discord',
			'facebook',
			'microsoft',
			'oauth',
			'login methods',
		],
		href: '/settings/account',
		section: 'account',
		icon: Link2,
	},
	{
		id: 'account-password',
		title: 'Password',
		description: 'Change your account password',
		keywords: ['password', 'change password', 'reset password', 'update password', 'security'],
		href: '/settings/account',
		section: 'account',
		icon: Key,
	},
	{
		id: 'account-email',
		title: 'Email Address',
		description: 'View or change your email address',
		keywords: ['email', 'email address', 'change email', 'update email'],
		href: '/settings/account',
		section: 'account',
		icon: Mail,
	},

	// Security Section
	{
		id: 'security-2fa',
		title: 'Two-Factor Authentication',
		description: 'Add an extra layer of security to your account',
		keywords: [
			'2fa',
			'two factor',
			'authenticator',
			'totp',
			'mfa',
			'multi factor',
			'security',
			'verification',
		],
		href: '/settings/security',
		section: 'security',
		icon: Shield,
	},
	{
		id: 'security-sessions',
		title: 'Active Sessions',
		description: 'View and manage your active login sessions',
		keywords: [
			'sessions',
			'active sessions',
			'devices',
			'logged in',
			'sign out everywhere',
			'logout',
		],
		href: '/settings/security',
		section: 'security',
		icon: Smartphone,
	},
	{
		id: 'security-login-history',
		title: 'Login History',
		description: 'View recent login attempts and locations',
		keywords: ['login history', 'sign in history', 'activity', 'access log', 'security log'],
		href: '/settings/security',
		section: 'security',
		icon: History,
	},
	{
		id: 'security-checkup',
		title: 'Security Checkup',
		description: 'Review your account security status',
		keywords: ['security checkup', 'security score', 'account security', 'security status'],
		href: '/settings/security',
		section: 'security',
		icon: ShieldCheck,
	},
	{
		id: 'security-recovery',
		title: 'Recovery Codes',
		description: 'Generate backup codes for account recovery',
		keywords: ['recovery', 'backup codes', 'recovery codes', 'account recovery', '2fa backup'],
		href: '/settings/security',
		section: 'security',
		icon: Key,
	},

	// Subscription Section
	{
		id: 'subscription-plan',
		title: 'Current Plan',
		description: 'View your current subscription plan',
		keywords: ['plan', 'subscription', 'premium', 'free', 'lifetime', 'pricing', 'tier'],
		href: '/settings/subscription',
		section: 'subscription',
		icon: CreditCard,
	},
	{
		id: 'subscription-billing',
		title: 'Billing History',
		description: 'View past payments and invoices',
		keywords: ['billing', 'invoices', 'payments', 'history', 'transactions', 'receipts', 'charges'],
		href: '/settings/subscription',
		section: 'subscription',
		icon: History,
	},
	{
		id: 'subscription-payment',
		title: 'Payment Method',
		description: 'Update your payment card or method',
		keywords: ['payment', 'credit card', 'card', 'payment method', 'update card', 'billing info'],
		href: '/settings/subscription',
		section: 'subscription',
		icon: CreditCard,
	},

	// Preferences Section
	{
		id: 'preferences-theme',
		title: 'Theme',
		description: 'Switch between light, dark, or system theme',
		keywords: ['theme', 'dark mode', 'light mode', 'appearance', 'color scheme', 'dark', 'light'],
		href: '/settings/preferences',
		section: 'preferences',
		icon: Moon,
	},
	{
		id: 'preferences-language',
		title: 'Language',
		description: 'Change the display language',
		keywords: ['language', 'locale', 'translation', 'localization', 'i18n'],
		href: '/settings/preferences',
		section: 'preferences',
		icon: Globe,
	},
	{
		id: 'preferences-notifications',
		title: 'Notifications',
		description: 'Manage push and email notification preferences',
		keywords: [
			'notifications',
			'push',
			'email',
			'alerts',
			'reminders',
			'daily reminder',
			'streak alert',
		],
		href: '/settings/preferences',
		section: 'preferences',
		icon: Bell,
	},
	{
		id: 'preferences-timezone',
		title: 'Timezone',
		description: 'Set your timezone for daily puzzles',
		keywords: ['timezone', 'time zone', 'time', 'clock', 'region'],
		href: '/settings/preferences',
		section: 'preferences',
		icon: Clock,
	},
	{
		id: 'preferences-reduce-motion',
		title: 'Reduce Motion',
		description: 'Minimize animations for accessibility',
		keywords: ['reduce motion', 'animations', 'accessibility', 'a11y', 'motion'],
		href: '/settings/preferences',
		section: 'preferences',
		icon: Minimize2,
	},

	// Privacy Section
	{
		id: 'privacy-visibility',
		title: 'Profile Visibility',
		description: 'Control who can see your profile and stats',
		keywords: ['visibility', 'public', 'private', 'who can see', 'profile privacy'],
		href: '/settings/privacy',
		section: 'privacy',
		icon: Eye,
	},
	{
		id: 'privacy-export',
		title: 'Export Data',
		description: 'Download all your personal data',
		keywords: ['export', 'download', 'data export', 'gdpr', 'personal data', 'my data'],
		href: '/settings/privacy',
		section: 'privacy',
		icon: Download,
	},
	{
		id: 'privacy-delete',
		title: 'Delete Account',
		description: 'Permanently delete your account and all data',
		keywords: [
			'delete',
			'remove',
			'close account',
			'delete account',
			'deactivate',
			'permanently delete',
		],
		href: '/settings/privacy',
		section: 'privacy',
		icon: Trash2,
	},
]

/**
 * Section labels for grouping results
 */
export const sectionLabels: Record<SettingSection, string> = {
	profile: 'Profile',
	account: 'Account',
	security: 'Security',
	subscription: 'Subscription',
	preferences: 'Preferences',
	privacy: 'Privacy',
}

/**
 * Simple fuzzy search implementation
 * Returns a score where higher = better match
 */
function fuzzyMatch(text: string, query: string): number {
	const textLower = text.toLowerCase()
	const queryLower = query.toLowerCase()

	// Exact match gets highest score
	if (textLower === queryLower) return 100

	// Contains exact query gets high score
	if (textLower.includes(queryLower)) {
		// Bonus for match at start of word
		if (textLower.startsWith(queryLower)) return 90
		if (textLower.includes(` ${queryLower}`)) return 85
		return 75
	}

	// Word-by-word matching
	const queryWords = queryLower.split(/\s+/)
	const matchedWords = queryWords.filter((word) => textLower.includes(word))
	if (matchedWords.length > 0) {
		return 50 + (matchedWords.length / queryWords.length) * 30
	}

	// Character sequence matching (loose fuzzy)
	let queryIndex = 0
	for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
		if (textLower[i] === queryLower[queryIndex]) {
			queryIndex++
		}
	}
	if (queryIndex === queryLower.length) {
		return 30
	}

	return 0
}

/**
 * Search through settings index
 * Returns matching items sorted by relevance
 */
export function searchSettings(query: string): SettingItem[] {
	if (!query.trim()) {
		return []
	}

	const results: Array<{ item: SettingItem; score: number }> = []

	for (const item of settingsIndex) {
		// Calculate score from title (highest weight)
		const titleScore = fuzzyMatch(item.title, query) * 2

		// Calculate score from description
		const descriptionScore = fuzzyMatch(item.description, query) * 1.5

		// Calculate score from keywords
		let keywordScore = 0
		for (const keyword of item.keywords) {
			const score = fuzzyMatch(keyword, query)
			if (score > keywordScore) {
				keywordScore = score
			}
		}

		// Total score
		const totalScore = Math.max(titleScore, descriptionScore, keywordScore)

		if (totalScore > 0) {
			results.push({ item, score: totalScore })
		}
	}

	// Sort by score descending
	results.sort((a, b) => b.score - a.score)

	return results.map((r) => r.item)
}

/**
 * Group settings by section
 */
export function groupBySection(items: SettingItem[]): Map<SettingSection, SettingItem[]> {
	const groups = new Map<SettingSection, SettingItem[]>()

	for (const item of items) {
		const existing = groups.get(item.section) || []
		existing.push(item)
		groups.set(item.section, existing)
	}

	return groups
}

/**
 * Highlight matching text in a string
 * Returns array of segments with isMatch flag
 */
export function highlightMatches(
	text: string,
	query: string,
): Array<{ text: string; isMatch: boolean }> {
	if (!query.trim()) {
		return [{ text, isMatch: false }]
	}

	const segments: Array<{ text: string; isMatch: boolean }> = []
	const textLower = text.toLowerCase()
	const queryLower = query.toLowerCase()

	let lastIndex = 0
	let searchFrom = 0

	while (searchFrom < text.length) {
		const matchIndex = textLower.indexOf(queryLower, searchFrom)

		if (matchIndex === -1) {
			break
		}

		// Add non-matching segment before this match
		if (matchIndex > lastIndex) {
			segments.push({
				text: text.slice(lastIndex, matchIndex),
				isMatch: false,
			})
		}

		// Add matching segment
		segments.push({
			text: text.slice(matchIndex, matchIndex + query.length),
			isMatch: true,
		})

		lastIndex = matchIndex + query.length
		searchFrom = lastIndex
	}

	// Add remaining non-matching segment
	if (lastIndex < text.length) {
		segments.push({
			text: text.slice(lastIndex),
			isMatch: false,
		})
	}

	// If no matches found, return original text
	if (segments.length === 0) {
		return [{ text, isMatch: false }]
	}

	return segments
}

/**
 * Recent searches storage key
 */
const RECENT_SEARCHES_KEY = 'puzzled:settings-recent-searches'
const MAX_RECENT_SEARCHES = 5

/**
 * Get recent searches from localStorage
 */
export function getRecentSearches(): string[] {
	if (typeof window === 'undefined') return []

	try {
		const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
		if (stored) {
			const parsed = JSON.parse(stored)
			if (Array.isArray(parsed)) {
				return parsed.slice(0, MAX_RECENT_SEARCHES)
			}
		}
	} catch {
		// Ignore parse errors
	}

	return []
}

/**
 * Save a search to recent searches
 */
export function saveRecentSearch(query: string): void {
	if (typeof window === 'undefined' || !query.trim()) return

	try {
		const existing = getRecentSearches()
		const filtered = existing.filter((s) => s.toLowerCase() !== query.toLowerCase())
		const updated = [query, ...filtered].slice(0, MAX_RECENT_SEARCHES)
		localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
	} catch {
		// Ignore storage errors
	}
}

/**
 * Clear recent searches
 */
export function clearRecentSearches(): void {
	if (typeof window === 'undefined') return

	try {
		localStorage.removeItem(RECENT_SEARCHES_KEY)
	} catch {
		// Ignore storage errors
	}
}
