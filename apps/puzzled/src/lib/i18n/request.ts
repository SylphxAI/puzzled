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
import enUSAnnouncements from '@/messages/en-US/announcements.json'
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
import enUSPlus from '@/messages/en-US/plus.json'
import enUSPwa from '@/messages/en-US/pwa.json'
import enUSReauth from '@/messages/en-US/reauth.json'
import enUSSettings from '@/messages/en-US/settings.json'
import enUSShare from '@/messages/en-US/share.json'
import enUSStats from '@/messages/en-US/stats.json'
import enUSStreak from '@/messages/en-US/streak.json'
import enUSSupport from '@/messages/en-US/support.json'
import esAchievements from '@/messages/es/achievements.json'
import esAdmin from '@/messages/es/admin.json'
import esAnnouncements from '@/messages/es/announcements.json'
import esArchive from '@/messages/es/archive.json'
import esAuth from '@/messages/es/auth.json'
import esCalendar from '@/messages/es/calendar.json'
import esCatalog from '@/messages/es/catalog.json'
import esCommon from '@/messages/es/common.json'
import esConsent from '@/messages/es/consent.json'
import esDaily from '@/messages/es/daily.json'
import esFooter from '@/messages/es/footer.json'
import esGameResult from '@/messages/es/game-result.json'
import esHome from '@/messages/es/home.json'
import esLeaderboard from '@/messages/es/leaderboard.json'
import esLegal from '@/messages/es/legal.json'
import esModes from '@/messages/es/modes.json'
import esNav from '@/messages/es/nav.json'
import esOnboarding from '@/messages/es/onboarding.json'
import esPagination from '@/messages/es/pagination.json'
import esPlus from '@/messages/es/plus.json'
import esPwa from '@/messages/es/pwa.json'
import esReauth from '@/messages/es/reauth.json'
import esSettings from '@/messages/es/settings.json'
import esShare from '@/messages/es/share.json'
import esStats from '@/messages/es/stats.json'
import esStreak from '@/messages/es/streak.json'
import esSupport from '@/messages/es/support.json'
import jaAchievements from '@/messages/ja/achievements.json'
import jaAdmin from '@/messages/ja/admin.json'
import jaAnnouncements from '@/messages/ja/announcements.json'
import jaArchive from '@/messages/ja/archive.json'
import jaAuth from '@/messages/ja/auth.json'
import jaCalendar from '@/messages/ja/calendar.json'
import jaCatalog from '@/messages/ja/catalog.json'
import jaCommon from '@/messages/ja/common.json'
import jaConsent from '@/messages/ja/consent.json'
import jaDaily from '@/messages/ja/daily.json'
import jaFooter from '@/messages/ja/footer.json'
import jaGameResult from '@/messages/ja/game-result.json'
import jaHome from '@/messages/ja/home.json'
import jaLeaderboard from '@/messages/ja/leaderboard.json'
import jaLegal from '@/messages/ja/legal.json'
import jaModes from '@/messages/ja/modes.json'
import jaNav from '@/messages/ja/nav.json'
import jaOnboarding from '@/messages/ja/onboarding.json'
import jaPagination from '@/messages/ja/pagination.json'
import jaPlus from '@/messages/ja/plus.json'
import jaPwa from '@/messages/ja/pwa.json'
import jaReauth from '@/messages/ja/reauth.json'
import jaSettings from '@/messages/ja/settings.json'
import jaShare from '@/messages/ja/share.json'
import jaStats from '@/messages/ja/stats.json'
import jaStreak from '@/messages/ja/streak.json'
import jaSupport from '@/messages/ja/support.json'
import ptBRAchievements from '@/messages/pt-BR/achievements.json'
import ptBRAdmin from '@/messages/pt-BR/admin.json'
import ptBRAnnouncements from '@/messages/pt-BR/announcements.json'
import ptBRArchive from '@/messages/pt-BR/archive.json'
import ptBRAuth from '@/messages/pt-BR/auth.json'
import ptBRCalendar from '@/messages/pt-BR/calendar.json'
import ptBRCatalog from '@/messages/pt-BR/catalog.json'
import ptBRCommon from '@/messages/pt-BR/common.json'
import ptBRConsent from '@/messages/pt-BR/consent.json'
import ptBRDaily from '@/messages/pt-BR/daily.json'
import ptBRFooter from '@/messages/pt-BR/footer.json'
import ptBRGameResult from '@/messages/pt-BR/game-result.json'
import ptBRHome from '@/messages/pt-BR/home.json'
import ptBRLeaderboard from '@/messages/pt-BR/leaderboard.json'
import ptBRLegal from '@/messages/pt-BR/legal.json'
import ptBRModes from '@/messages/pt-BR/modes.json'
import ptBRNav from '@/messages/pt-BR/nav.json'
import ptBROnboarding from '@/messages/pt-BR/onboarding.json'
import ptBRPagination from '@/messages/pt-BR/pagination.json'
import ptBRPlus from '@/messages/pt-BR/plus.json'
import ptBRPwa from '@/messages/pt-BR/pwa.json'
import ptBRReauth from '@/messages/pt-BR/reauth.json'
import ptBRSettings from '@/messages/pt-BR/settings.json'
import ptBRShare from '@/messages/pt-BR/share.json'
import ptBRStats from '@/messages/pt-BR/stats.json'
import ptBRStreak from '@/messages/pt-BR/streak.json'
import ptBRSupport from '@/messages/pt-BR/support.json'
import zhCNAchievements from '@/messages/zh-CN/achievements.json'
import zhCNAdmin from '@/messages/zh-CN/admin.json'
import zhCNAnnouncements from '@/messages/zh-CN/announcements.json'
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
import zhCNPlus from '@/messages/zh-CN/plus.json'
import zhCNPwa from '@/messages/zh-CN/pwa.json'
import zhCNReauth from '@/messages/zh-CN/reauth.json'
import zhCNSettings from '@/messages/zh-CN/settings.json'
import zhCNShare from '@/messages/zh-CN/share.json'
import zhCNStats from '@/messages/zh-CN/stats.json'
import zhCNStreak from '@/messages/zh-CN/streak.json'
import zhCNSupport from '@/messages/zh-CN/support.json'
import zhHKAchievements from '@/messages/zh-HK/achievements.json'
import zhHKAdmin from '@/messages/zh-HK/admin.json'
import zhHKAnnouncements from '@/messages/zh-HK/announcements.json'
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
import zhHKPlus from '@/messages/zh-HK/plus.json'
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
import zhTWGameResult from '@/messages/zh-TW/game-result.json'
import zhTWHome from '@/messages/zh-TW/home.json'
import zhTWLeaderboard from '@/messages/zh-TW/leaderboard.json'
import zhTWLegal from '@/messages/zh-TW/legal.json'
import zhTWModes from '@/messages/zh-TW/modes.json'
import zhTWNav from '@/messages/zh-TW/nav.json'
import zhTWOnboarding from '@/messages/zh-TW/onboarding.json'
import zhTWPlus from '@/messages/zh-TW/plus.json'
import zhTWSettings from '@/messages/zh-TW/settings.json'
import zhTWShare from '@/messages/zh-TW/share.json'
import zhTWStats from '@/messages/zh-TW/stats.json'
import zhTWStreak from '@/messages/zh-TW/streak.json'
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
	plus: Messages
	achievements: Messages
	announcements: Messages
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
		plus: enUSPlus,
		achievements: enUSAchievements,
		announcements: enUSAnnouncements,
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
		plus: zhHKPlus,
		achievements: zhHKAchievements,
		announcements: zhHKAnnouncements,
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
		onboarding: zhTWOnboarding,
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
		legal: zhTWLegal,
		share: zhTWShare,
		stats: zhTWStats,
		streak: zhTWStreak,
		support: zhTWSupport,
		plus: zhTWPlus,
		modes: zhTWModes,
		gameResult: zhTWGameResult,
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
		plus: zhCNPlus,
		achievements: zhCNAchievements,
		announcements: zhCNAnnouncements,
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
	ja: {
		achievements: jaAchievements,
		admin: jaAdmin,
		announcements: jaAnnouncements,
		archive: jaArchive,
		auth: jaAuth,
		calendar: jaCalendar,
		catalog: jaCatalog,
		common: jaCommon,
		consent: jaConsent,
		daily: jaDaily,
		footer: jaFooter,
		gameResult: jaGameResult,
		home: jaHome,
		leaderboard: jaLeaderboard,
		legal: jaLegal,
		modes: jaModes,
		nav: jaNav,
		onboarding: jaOnboarding,
		pagination: jaPagination,
		plus: jaPlus,
		pwa: jaPwa,
		reauth: jaReauth,
		settings: jaSettings,
		share: jaShare,
		stats: jaStats,
		streak: jaStreak,
		support: jaSupport,
	},
	es: {
		achievements: esAchievements,
		admin: esAdmin,
		announcements: esAnnouncements,
		archive: esArchive,
		auth: esAuth,
		calendar: esCalendar,
		catalog: esCatalog,
		common: esCommon,
		consent: esConsent,
		daily: esDaily,
		footer: esFooter,
		gameResult: esGameResult,
		home: esHome,
		leaderboard: esLeaderboard,
		legal: esLegal,
		modes: esModes,
		nav: esNav,
		onboarding: esOnboarding,
		pagination: esPagination,
		plus: esPlus,
		pwa: esPwa,
		reauth: esReauth,
		settings: esSettings,
		share: esShare,
		stats: esStats,
		streak: esStreak,
		support: esSupport,
	},
	'pt-BR': {
		achievements: ptBRAchievements,
		admin: ptBRAdmin,
		announcements: ptBRAnnouncements,
		archive: ptBRArchive,
		auth: ptBRAuth,
		calendar: ptBRCalendar,
		catalog: ptBRCatalog,
		common: ptBRCommon,
		consent: ptBRConsent,
		daily: ptBRDaily,
		footer: ptBRFooter,
		gameResult: ptBRGameResult,
		home: ptBRHome,
		leaderboard: ptBRLeaderboard,
		legal: ptBRLegal,
		modes: ptBRModes,
		nav: ptBRNav,
		onboarding: ptBROnboarding,
		pagination: ptBRPagination,
		plus: ptBRPlus,
		pwa: ptBRPwa,
		reauth: ptBRReauth,
		settings: ptBRSettings,
		share: ptBRShare,
		stats: ptBRStats,
		streak: ptBRStreak,
		support: ptBRSupport,
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
