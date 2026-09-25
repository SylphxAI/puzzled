import { getRequestConfig } from 'next-intl/server'
import { isValidLocale, type Locale, localeFallbacks } from './config'
import { resolveGameMessages } from './game-messages'
import { routing } from './routing'

// ==========================================
// Namespace Imports (explicit for Turbopack)
// ==========================================

import enGBAdmin from '@/messages/en-GB/admin.json'
import enGBAuth from '@/messages/en-GB/auth.json'
import enGBCatalog from '@/messages/en-GB/catalog.json'
// en-GB namespaces
import enGBLegal from '@/messages/en-GB/legal.json'
import enGBSettings from '@/messages/en-GB/settings.json'
import enGBSupport from '@/messages/en-GB/support.json'
import enUSAchievements from '@/messages/en-US/achievements.json'
import enUSAdmin from '@/messages/en-US/admin.json'
import enUSArchive from '@/messages/en-US/archive.json'
import enUSAuth from '@/messages/en-US/auth.json'
import enUSCalendar from '@/messages/en-US/calendar.json'
import enUSCatalog from '@/messages/en-US/catalog.json'
// en-US namespaces
import enUSCommon from '@/messages/en-US/common.json'
import enUSConsent from '@/messages/en-US/consent.json'
import enUSDaily from '@/messages/en-US/daily.json'
import enUSFooter from '@/messages/en-US/footer.json'
import enUSGameResult from '@/messages/en-US/game-result.json'
import enUSHome from '@/messages/en-US/home.json'
import enUSLeaderboard from '@/messages/en-US/leaderboard.json'
import enUSLegal from '@/messages/en-US/legal.json'
import enUSModes from '@/messages/en-US/modes.json'
import enUSNav from '@/messages/en-US/nav.json'
import enUSOnboarding from '@/messages/en-US/onboarding.json'
import enUSPagination from '@/messages/en-US/pagination.json'
import enUSPwa from '@/messages/en-US/pwa.json'
import enUSReauth from '@/messages/en-US/reauth.json'
import enUSSettings from '@/messages/en-US/settings.json'
import enUSShare from '@/messages/en-US/share.json'
import enUSStats from '@/messages/en-US/stats.json'
import enUSStreak from '@/messages/en-US/streak.json'
import enUSSupport from '@/messages/en-US/support.json'
import zhCNAchievements from '@/messages/zh-CN/achievements.json'
import zhCNAdmin from '@/messages/zh-CN/admin.json'
import zhCNArchive from '@/messages/zh-CN/archive.json'
import zhCNAuth from '@/messages/zh-CN/auth.json'
import zhCNCalendar from '@/messages/zh-CN/calendar.json'
import zhCNCatalog from '@/messages/zh-CN/catalog.json'
// zh-CN namespaces
import zhCNCommon from '@/messages/zh-CN/common.json'
import zhCNConsent from '@/messages/zh-CN/consent.json'
import zhCNDaily from '@/messages/zh-CN/daily.json'
import zhCNFooter from '@/messages/zh-CN/footer.json'
import zhCNGameResult from '@/messages/zh-CN/game-result.json'
import zhCNHome from '@/messages/zh-CN/home.json'
import zhCNLeaderboard from '@/messages/zh-CN/leaderboard.json'
import zhCNLegal from '@/messages/zh-CN/legal.json'
import zhCNModes from '@/messages/zh-CN/modes.json'
import zhCNNav from '@/messages/zh-CN/nav.json'
import zhCNOnboarding from '@/messages/zh-CN/onboarding.json'
import zhCNPagination from '@/messages/zh-CN/pagination.json'
import zhCNPwa from '@/messages/zh-CN/pwa.json'
import zhCNReauth from '@/messages/zh-CN/reauth.json'
import zhCNSettings from '@/messages/zh-CN/settings.json'
import zhCNShare from '@/messages/zh-CN/share.json'
import zhCNStats from '@/messages/zh-CN/stats.json'
import zhCNStreak from '@/messages/zh-CN/streak.json'
import zhCNSupport from '@/messages/zh-CN/support.json'
import zhHKAchievements from '@/messages/zh-HK/achievements.json'
import zhHKAdmin from '@/messages/zh-HK/admin.json'
import zhHKArchive from '@/messages/zh-HK/archive.json'
import zhHKAuth from '@/messages/zh-HK/auth.json'
import zhHKCalendar from '@/messages/zh-HK/calendar.json'
import zhHKCatalog from '@/messages/zh-HK/catalog.json'
// zh-HK namespaces
import zhHKCommon from '@/messages/zh-HK/common.json'
import zhHKConsent from '@/messages/zh-HK/consent.json'
import zhHKDaily from '@/messages/zh-HK/daily.json'
import zhHKFooter from '@/messages/zh-HK/footer.json'
import zhHKGameResult from '@/messages/zh-HK/game-result.json'
import zhHKHome from '@/messages/zh-HK/home.json'
import zhHKLeaderboard from '@/messages/zh-HK/leaderboard.json'
import zhHKLegal from '@/messages/zh-HK/legal.json'
import zhHKModes from '@/messages/zh-HK/modes.json'
import zhHKNav from '@/messages/zh-HK/nav.json'
import zhHKOnboarding from '@/messages/zh-HK/onboarding.json'
import zhHKPagination from '@/messages/zh-HK/pagination.json'
import zhHKPwa from '@/messages/zh-HK/pwa.json'
import zhHKReauth from '@/messages/zh-HK/reauth.json'
import zhHKSettings from '@/messages/zh-HK/settings.json'
import zhHKShare from '@/messages/zh-HK/share.json'
import zhHKStats from '@/messages/zh-HK/stats.json'
import zhHKStreak from '@/messages/zh-HK/streak.json'
import zhHKSupport from '@/messages/zh-HK/support.json'
import zhTWArchive from '@/messages/zh-TW/archive.json'
import zhTWAuth from '@/messages/zh-TW/auth.json'
import zhTWCatalog from '@/messages/zh-TW/catalog.json'
// zh-TW namespaces
import zhTWCommon from '@/messages/zh-TW/common.json'
import zhTWConsent from '@/messages/zh-TW/consent.json'
import zhTWDaily from '@/messages/zh-TW/daily.json'
import zhTWFooter from '@/messages/zh-TW/footer.json'
import zhTWHome from '@/messages/zh-TW/home.json'
import zhTWLeaderboard from '@/messages/zh-TW/leaderboard.json'
import zhTWNav from '@/messages/zh-TW/nav.json'
import zhTWSettings from '@/messages/zh-TW/settings.json'
import zhTWShare from '@/messages/zh-TW/share.json'
import zhTWStats from '@/messages/zh-TW/stats.json'
import zhTWSupport from '@/messages/zh-TW/support.json'

// ==========================================
// Message Registry
// ==========================================

type Messages = Record<string, unknown>

interface LocaleMessages {
	common: Messages
	auth: Messages
	nav: Messages
	home: Messages
	settings: Messages
	admin: Messages
	archive: Messages
	legal: Messages
	pagination: Messages
	achievements: Messages
	calendar: Messages
	catalog: Messages
	consent: Messages
	daily: Messages
	footer: Messages
	gameResult: Messages
	leaderboard: Messages
	modes: Messages
	onboarding: Messages
	pwa: Messages
	reauth: Messages
	share: Messages
	stats: Messages
	streak: Messages
	support: Messages
}

/**
 * A locale's namespace files. Partial on purpose: an overlay locale (one with a
 * declared fallback in `./config`) ships only the keys its fallback does not
 * carry, so its map omits whole namespaces and `loadMessages` fills them from the
 * fallback.
 */
const LOCALE_MESSAGES: Record<Locale, Partial<LocaleMessages>> = {
	'en-US': {
		common: enUSCommon,
		auth: enUSAuth,
		nav: enUSNav,
		home: enUSHome,
		settings: enUSSettings,
		admin: enUSAdmin,
		archive: enUSArchive,
		legal: enUSLegal,
		pagination: enUSPagination,
		achievements: enUSAchievements,
		calendar: enUSCalendar,
		catalog: enUSCatalog,
		consent: enUSConsent,
		daily: enUSDaily,
		footer: enUSFooter,
		gameResult: enUSGameResult,
		leaderboard: enUSLeaderboard,
		modes: enUSModes,
		onboarding: enUSOnboarding,
		pwa: enUSPwa,
		reauth: enUSReauth,
		share: enUSShare,
		stats: enUSStats,
		streak: enUSStreak,
		support: enUSSupport,
	},
	'en-GB': {
		auth: enGBAuth,
		settings: enGBSettings,
		admin: enGBAdmin,
		legal: enGBLegal,
		catalog: enGBCatalog,
		support: enGBSupport,
	},
	'zh-HK': {
		common: zhHKCommon,
		auth: zhHKAuth,
		nav: zhHKNav,
		home: zhHKHome,
		settings: zhHKSettings,
		admin: zhHKAdmin,
		archive: zhHKArchive,
		legal: zhHKLegal,
		pagination: zhHKPagination,
		achievements: zhHKAchievements,
		calendar: zhHKCalendar,
		catalog: zhHKCatalog,
		consent: zhHKConsent,
		daily: zhHKDaily,
		footer: zhHKFooter,
		gameResult: zhHKGameResult,
		leaderboard: zhHKLeaderboard,
		modes: zhHKModes,
		onboarding: zhHKOnboarding,
		pwa: zhHKPwa,
		reauth: zhHKReauth,
		share: zhHKShare,
		stats: zhHKStats,
		streak: zhHKStreak,
		support: zhHKSupport,
	},
	'zh-TW': {
		common: zhTWCommon,
		auth: zhTWAuth,
		nav: zhTWNav,
		home: zhTWHome,
		settings: zhTWSettings,
		archive: zhTWArchive,
		catalog: zhTWCatalog,
		consent: zhTWConsent,
		daily: zhTWDaily,
		footer: zhTWFooter,
		leaderboard: zhTWLeaderboard,
		share: zhTWShare,
		stats: zhTWStats,
		support: zhTWSupport,
	},
	'zh-CN': {
		common: zhCNCommon,
		auth: zhCNAuth,
		nav: zhCNNav,
		home: zhCNHome,
		settings: zhCNSettings,
		admin: zhCNAdmin,
		archive: zhCNArchive,
		legal: zhCNLegal,
		pagination: zhCNPagination,
		achievements: zhCNAchievements,
		calendar: zhCNCalendar,
		catalog: zhCNCatalog,
		consent: zhCNConsent,
		daily: zhCNDaily,
		footer: zhCNFooter,
		gameResult: zhCNGameResult,
		leaderboard: zhCNLeaderboard,
		modes: zhCNModes,
		onboarding: zhCNOnboarding,
		pwa: zhCNPwa,
		reauth: zhCNReauth,
		share: zhCNShare,
		stats: zhCNStats,
		streak: zhCNStreak,
		support: zhCNSupport,
	},
}

// ==========================================
// Message Loading
// ==========================================

/**
 * Deep merge two objects, with source taking precedence
 */
function deepMerge(target: Messages, source: Messages): Messages {
	const result = { ...target }

	for (const [key, value] of Object.entries(source)) {
		if (
			value !== null &&
			typeof value === 'object' &&
			!Array.isArray(value) &&
			key in result &&
			typeof result[key] === 'object' &&
			result[key] !== null
		) {
			result[key] = deepMerge(result[key] as Messages, value as Messages)
		} else {
			result[key] = value
		}
	}

	return result
}

/**
 * Load all messages for a locale with fallback support.
 * en-GB falls back to en-US, zh-TW falls back to zh-HK.
 */
function loadMessages(locale: Locale): Messages {
	const localeMessages = LOCALE_MESSAGES[locale]
	const fallbackLocale = localeFallbacks[locale]

	let messages: Messages = {}

	if (fallbackLocale) {
		const fallbackMessages = LOCALE_MESSAGES[fallbackLocale]
		messages = { ...fallbackMessages }
	}

	messages = deepMerge(messages, localeMessages)

	// Add the games namespace, resolved for this locale: the module's own
	// per-locale copy where it exists, English for every key it does not carry.
	messages.games = resolveGameMessages(locale)

	return messages
}

// ==========================================
// Request Config
// ==========================================

export default getRequestConfig(async ({ requestLocale }) => {
	let locale = await requestLocale

	if (!locale || !isValidLocale(locale)) {
		locale = routing.defaultLocale
	}

	return {
		locale,
		messages: loadMessages(locale as Locale),
	}
})
