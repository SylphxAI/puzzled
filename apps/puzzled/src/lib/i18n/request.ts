import { getRequestConfig } from 'next-intl/server'
import { isValidLocale, type Locale, localeFallbacks } from './config'
import { routing } from './routing'

// ==========================================
// Per-Game Translations (English only for now)
// ==========================================

// Explicit imports required for Turbopack (no dynamic imports with template literals)
import arithmoEn from '@/games/arithmo/translations/en.json'
import blockSlideEn from '@/games/block-slide/translations/en.json'
import crosswordEn from '@/games/crossword/translations/en.json'
import cryptogramEn from '@/games/cryptogram/translations/en.json'
import killerSudokuEn from '@/games/killer-sudoku/translations/en.json'
import nonogramEn from '@/games/nonogram/translations/en.json'
import patternMatchEn from '@/games/pattern-match/translations/en.json'
import quadWordsEn from '@/games/quad-words/translations/en.json'
import queensEn from '@/games/queens/translations/en.json'
import sudokuEn from '@/games/sudoku/translations/en.json'
import tangoEn from '@/games/tango/translations/en.json'
import wordBoxEn from '@/games/word-box/translations/en.json'
import wordGroupsEn from '@/games/word-groups/translations/en.json'
import wordGuessEn from '@/games/word-guess/translations/en.json'
import wordHiveEn from '@/games/word-hive/translations/en.json'
import wordLadderEn from '@/games/word-ladder/translations/en.json'
import wordSearchEn from '@/games/word-search/translations/en.json'

const GAME_TRANSLATIONS_EN: Record<string, Record<string, unknown>> = {
	arithmo: arithmoEn,
	blockSlide: blockSlideEn,
	crossword: crosswordEn,
	cryptogram: cryptogramEn,
	killerSudoku: killerSudokuEn,
	nonogram: nonogramEn,
	patternMatch: patternMatchEn,
	quadWords: quadWordsEn,
	queens: queensEn,
	sudoku: sudokuEn,
	tango: tangoEn,
	wordBox: wordBoxEn,
	wordGroups: wordGroupsEn,
	wordGuess: wordGuessEn,
	wordHive: wordHiveEn,
	wordLadder: wordLadderEn,
	wordSearch: wordSearchEn,
}

// ==========================================
// Namespace Imports (explicit for Turbopack)
// ==========================================

import enGBAchievements from '@/messages/en-GB/achievements.json'
import enGBAdmin from '@/messages/en-GB/admin.json'
import enGBAuth from '@/messages/en-GB/auth.json'
import enGBCalendar from '@/messages/en-GB/calendar.json'
// en-GB namespaces (same as en-US for now, will be customized)
import enGBCommon from '@/messages/en-GB/common.json'
import enGBConsent from '@/messages/en-GB/consent.json'
import enGBDaily from '@/messages/en-GB/daily.json'
import enGBFooter from '@/messages/en-GB/footer.json'
import enGBGameResult from '@/messages/en-GB/game-result.json'
import enGBHome from '@/messages/en-GB/home.json'
import enGBLeaderboard from '@/messages/en-GB/leaderboard.json'
import enGBLegal from '@/messages/en-GB/legal.json'
import enGBModes from '@/messages/en-GB/modes.json'
import enGBNav from '@/messages/en-GB/nav.json'
import enGBOnboarding from '@/messages/en-GB/onboarding.json'
import enGBPagination from '@/messages/en-GB/pagination.json'
import enGBPremium from '@/messages/en-GB/premium.json'
import enGBPricing from '@/messages/en-GB/pricing.json'
import enGBPwa from '@/messages/en-GB/pwa.json'
import enGBReauth from '@/messages/en-GB/reauth.json'
import enGBReferrals from '@/messages/en-GB/referrals.json'
import enGBSettings from '@/messages/en-GB/settings.json'
import enGBShare from '@/messages/en-GB/share.json'
import enGBStats from '@/messages/en-GB/stats.json'
import enGBStreak from '@/messages/en-GB/streak.json'
import enGBSubscription from '@/messages/en-GB/subscription.json'
import enGBSupport from '@/messages/en-GB/support.json'
import enGBTrial from '@/messages/en-GB/trial.json'
import enGBWinBack from '@/messages/en-GB/win-back.json'
import enUSAchievements from '@/messages/en-US/achievements.json'
import enUSAdmin from '@/messages/en-US/admin.json'
import enUSAuth from '@/messages/en-US/auth.json'
import enUSCalendar from '@/messages/en-US/calendar.json'
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
import enUSPremium from '@/messages/en-US/premium.json'
import enUSPricing from '@/messages/en-US/pricing.json'
import enUSPwa from '@/messages/en-US/pwa.json'
import enUSReauth from '@/messages/en-US/reauth.json'
import enUSReferrals from '@/messages/en-US/referrals.json'
import enUSSettings from '@/messages/en-US/settings.json'
import enUSShare from '@/messages/en-US/share.json'
import enUSStats from '@/messages/en-US/stats.json'
import enUSStreak from '@/messages/en-US/streak.json'
import enUSSubscription from '@/messages/en-US/subscription.json'
import enUSSupport from '@/messages/en-US/support.json'
import enUSTrial from '@/messages/en-US/trial.json'
import enUSWinBack from '@/messages/en-US/win-back.json'
import zhCNAchievements from '@/messages/zh-CN/achievements.json'
import zhCNAdmin from '@/messages/zh-CN/admin.json'
import zhCNAuth from '@/messages/zh-CN/auth.json'
import zhCNCalendar from '@/messages/zh-CN/calendar.json'
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
import zhCNPremium from '@/messages/zh-CN/premium.json'
import zhCNPricing from '@/messages/zh-CN/pricing.json'
import zhCNPwa from '@/messages/zh-CN/pwa.json'
import zhCNReauth from '@/messages/zh-CN/reauth.json'
import zhCNReferrals from '@/messages/zh-CN/referrals.json'
import zhCNSettings from '@/messages/zh-CN/settings.json'
import zhCNShare from '@/messages/zh-CN/share.json'
import zhCNStats from '@/messages/zh-CN/stats.json'
import zhCNStreak from '@/messages/zh-CN/streak.json'
import zhCNSubscription from '@/messages/zh-CN/subscription.json'
import zhCNSupport from '@/messages/zh-CN/support.json'
import zhCNTrial from '@/messages/zh-CN/trial.json'
import zhCNWinBack from '@/messages/zh-CN/win-back.json'
import zhHKAchievements from '@/messages/zh-HK/achievements.json'
import zhHKAdmin from '@/messages/zh-HK/admin.json'
import zhHKAuth from '@/messages/zh-HK/auth.json'
import zhHKCalendar from '@/messages/zh-HK/calendar.json'
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
import zhHKPremium from '@/messages/zh-HK/premium.json'
import zhHKPricing from '@/messages/zh-HK/pricing.json'
import zhHKPwa from '@/messages/zh-HK/pwa.json'
import zhHKReauth from '@/messages/zh-HK/reauth.json'
import zhHKReferrals from '@/messages/zh-HK/referrals.json'
import zhHKSettings from '@/messages/zh-HK/settings.json'
import zhHKShare from '@/messages/zh-HK/share.json'
import zhHKStats from '@/messages/zh-HK/stats.json'
import zhHKStreak from '@/messages/zh-HK/streak.json'
import zhHKSubscription from '@/messages/zh-HK/subscription.json'
import zhHKSupport from '@/messages/zh-HK/support.json'
import zhHKTrial from '@/messages/zh-HK/trial.json'
import zhHKWinBack from '@/messages/zh-HK/win-back.json'
import zhTWAchievements from '@/messages/zh-TW/achievements.json'
import zhTWAdmin from '@/messages/zh-TW/admin.json'
import zhTWAuth from '@/messages/zh-TW/auth.json'
import zhTWCalendar from '@/messages/zh-TW/calendar.json'
// zh-TW namespaces (same as zh-HK for now)
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
import zhTWPagination from '@/messages/zh-TW/pagination.json'
import zhTWPremium from '@/messages/zh-TW/premium.json'
import zhTWPricing from '@/messages/zh-TW/pricing.json'
import zhTWPwa from '@/messages/zh-TW/pwa.json'
import zhTWReauth from '@/messages/zh-TW/reauth.json'
import zhTWReferrals from '@/messages/zh-TW/referrals.json'
import zhTWSettings from '@/messages/zh-TW/settings.json'
import zhTWShare from '@/messages/zh-TW/share.json'
import zhTWStats from '@/messages/zh-TW/stats.json'
import zhTWStreak from '@/messages/zh-TW/streak.json'
import zhTWSubscription from '@/messages/zh-TW/subscription.json'
import zhTWSupport from '@/messages/zh-TW/support.json'
import zhTWTrial from '@/messages/zh-TW/trial.json'
import zhTWWinBack from '@/messages/zh-TW/win-back.json'

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
	legal: Messages
	pagination: Messages
	achievements: Messages
	calendar: Messages
	consent: Messages
	daily: Messages
	footer: Messages
	gameResult: Messages
	leaderboard: Messages
	modes: Messages
	onboarding: Messages
	premium: Messages
	pricing: Messages
	pwa: Messages
	reauth: Messages
	referrals: Messages
	share: Messages
	stats: Messages
	streak: Messages
	subscription: Messages
	support: Messages
	trial: Messages
	winBack: Messages
}

const LOCALE_MESSAGES: Record<Locale, LocaleMessages> = {
	'en-US': {
		common: enUSCommon,
		auth: enUSAuth,
		nav: enUSNav,
		home: enUSHome,
		settings: enUSSettings,
		admin: enUSAdmin,
		legal: enUSLegal,
		pagination: enUSPagination,
		achievements: enUSAchievements,
		calendar: enUSCalendar,
		consent: enUSConsent,
		daily: enUSDaily,
		footer: enUSFooter,
		gameResult: enUSGameResult,
		leaderboard: enUSLeaderboard,
		modes: enUSModes,
		onboarding: enUSOnboarding,
		premium: enUSPremium,
		pricing: enUSPricing,
		pwa: enUSPwa,
		reauth: enUSReauth,
		referrals: enUSReferrals,
		share: enUSShare,
		stats: enUSStats,
		streak: enUSStreak,
		subscription: enUSSubscription,
		support: enUSSupport,
		trial: enUSTrial,
		winBack: enUSWinBack,
	},
	'en-GB': {
		common: enGBCommon,
		auth: enGBAuth,
		nav: enGBNav,
		home: enGBHome,
		settings: enGBSettings,
		admin: enGBAdmin,
		legal: enGBLegal,
		pagination: enGBPagination,
		achievements: enGBAchievements,
		calendar: enGBCalendar,
		consent: enGBConsent,
		daily: enGBDaily,
		footer: enGBFooter,
		gameResult: enGBGameResult,
		leaderboard: enGBLeaderboard,
		modes: enGBModes,
		onboarding: enGBOnboarding,
		premium: enGBPremium,
		pricing: enGBPricing,
		pwa: enGBPwa,
		reauth: enGBReauth,
		referrals: enGBReferrals,
		share: enGBShare,
		stats: enGBStats,
		streak: enGBStreak,
		subscription: enGBSubscription,
		support: enGBSupport,
		trial: enGBTrial,
		winBack: enGBWinBack,
	},
	'zh-HK': {
		common: zhHKCommon,
		auth: zhHKAuth,
		nav: zhHKNav,
		home: zhHKHome,
		settings: zhHKSettings,
		admin: zhHKAdmin,
		legal: zhHKLegal,
		pagination: zhHKPagination,
		achievements: zhHKAchievements,
		calendar: zhHKCalendar,
		consent: zhHKConsent,
		daily: zhHKDaily,
		footer: zhHKFooter,
		gameResult: zhHKGameResult,
		leaderboard: zhHKLeaderboard,
		modes: zhHKModes,
		onboarding: zhHKOnboarding,
		premium: zhHKPremium,
		pricing: zhHKPricing,
		pwa: zhHKPwa,
		reauth: zhHKReauth,
		referrals: zhHKReferrals,
		share: zhHKShare,
		stats: zhHKStats,
		streak: zhHKStreak,
		subscription: zhHKSubscription,
		support: zhHKSupport,
		trial: zhHKTrial,
		winBack: zhHKWinBack,
	},
	'zh-TW': {
		common: zhTWCommon,
		auth: zhTWAuth,
		nav: zhTWNav,
		home: zhTWHome,
		settings: zhTWSettings,
		admin: zhTWAdmin,
		legal: zhTWLegal,
		pagination: zhTWPagination,
		achievements: zhTWAchievements,
		calendar: zhTWCalendar,
		consent: zhTWConsent,
		daily: zhTWDaily,
		footer: zhTWFooter,
		gameResult: zhTWGameResult,
		leaderboard: zhTWLeaderboard,
		modes: zhTWModes,
		onboarding: zhTWOnboarding,
		premium: zhTWPremium,
		pricing: zhTWPricing,
		pwa: zhTWPwa,
		reauth: zhTWReauth,
		referrals: zhTWReferrals,
		share: zhTWShare,
		stats: zhTWStats,
		streak: zhTWStreak,
		subscription: zhTWSubscription,
		support: zhTWSupport,
		trial: zhTWTrial,
		winBack: zhTWWinBack,
	},
	'zh-CN': {
		common: zhCNCommon,
		auth: zhCNAuth,
		nav: zhCNNav,
		home: zhCNHome,
		settings: zhCNSettings,
		admin: zhCNAdmin,
		legal: zhCNLegal,
		pagination: zhCNPagination,
		achievements: zhCNAchievements,
		calendar: zhCNCalendar,
		consent: zhCNConsent,
		daily: zhCNDaily,
		footer: zhCNFooter,
		gameResult: zhCNGameResult,
		leaderboard: zhCNLeaderboard,
		modes: zhCNModes,
		onboarding: zhCNOnboarding,
		premium: zhCNPremium,
		pricing: zhCNPricing,
		pwa: zhCNPwa,
		reauth: zhCNReauth,
		referrals: zhCNReferrals,
		share: zhCNShare,
		stats: zhCNStats,
		streak: zhCNStreak,
		subscription: zhCNSubscription,
		support: zhCNSupport,
		trial: zhCNTrial,
		winBack: zhCNWinBack,
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
 * Load all messages for a locale
 *
 * Includes fallback support:
 * - en-GB falls back to en-US for missing keys
 * - zh-TW falls back to zh-HK for missing keys
 */
function loadMessages(locale: Locale): Messages {
	const localeMessages = LOCALE_MESSAGES[locale]
	const fallbackLocale = localeFallbacks[locale]

	// Start with fallback messages if available
	let messages: Messages = {}

	if (fallbackLocale) {
		const fallbackMessages = LOCALE_MESSAGES[fallbackLocale]
		messages = { ...fallbackMessages }
	}

	// Merge locale-specific messages (overrides fallback)
	messages = deepMerge(messages, localeMessages as unknown as Messages)

	// Add games namespace
	messages.games = {}
	for (const [gameKey, translations] of Object.entries(GAME_TRANSLATIONS_EN)) {
		;(messages.games as Messages)[gameKey] = translations
	}

	return messages
}

// ==========================================
// Request Config
// ==========================================

export default getRequestConfig(async ({ requestLocale }) => {
	let locale = await requestLocale

	// Validate locale
	if (!locale || !isValidLocale(locale)) {
		locale = routing.defaultLocale
	}

	return {
		locale,
		messages: loadMessages(locale as Locale),
	}
})
