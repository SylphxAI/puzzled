/**
 * Share Text Generation
 *
 * Creates engaging, personality-filled share text that drives virality.
 * Uses config-driven customization with sensible fallbacks.
 *
 * PLUG-AND-PLAY: Games define their own share text methods in GameConfig:
 * - getShareEmoji
 * - getShareMessage
 * - getResultString
 * - getChallengeMessage
 *
 * Games without these methods get generic defaults.
 */

import type { GameSlug } from '@/games/registry'
import { getGameConfig } from '@/games/registry'
import type { GameShareStats } from '@/games/types'
import { APP_DOMAIN, APP_NAME } from '@/lib/config/app'

type ShareTextOptions = GameShareStats & {
	gameType: GameSlug
	streak?: number
	emojiGrid?: string
}

// ==========================================
// Config-Driven with Fallbacks
// ==========================================

/**
 * Get performance emoji - uses config or generic fallback
 */
function getPerformanceEmoji(options: ShareTextOptions): string {
	const config = getGameConfig(options.gameType)
	if (config?.getShareEmoji) {
		return config.getShareEmoji(options)
	}
	// Generic fallback
	return options.status === 'won' ? '🎉' : pickRandom(['😅', '💔', '🙈', '😤'])
}

/**
 * Get victory/loss message - uses config or generic fallback
 */
function getVictoryMessage(options: ShareTextOptions): string {
	const config = getGameConfig(options.gameType)
	if (config?.getShareMessage) {
		return config.getShareMessage(options)
	}
	// Generic fallback
	return options.status === 'won' ? 'Solved it!' : 'This one got me...'
}

/**
 * Get challenge message - uses config or generic fallback
 */
function getChallengeMessage(options: ShareTextOptions): string {
	const config = getGameConfig(options.gameType)
	if (config?.getChallengeMessage) {
		return config.getChallengeMessage(options)
	}
	// Generic fallback
	return options.status === 'won' ? 'Can you beat me?' : 'Can you solve it?'
}

/**
 * Get result string - uses config or empty fallback
 */
function getResultString(options: ShareTextOptions): string {
	const config = getGameConfig(options.gameType)
	if (config?.getResultString) {
		return config.getResultString(options)
	}
	// Generic fallback - empty for games without specific format
	return ''
}

/**
 * Pick a random item from an array
 */
function pickRandom<T>(items: T[]): T {
	return items[Math.floor(Math.random() * items.length)]
}

/**
 * Get game name for sharing (from registry)
 */
function getGameName(gameType: ShareTextOptions['gameType']): string {
	const config = getGameConfig(gameType)
	return config?.name || gameType
}

// ==========================================
// Public API
// ==========================================

/**
 * Generate engaging share text
 */
export function generateShareText(options: ShareTextOptions): string {
	const emoji = getPerformanceEmoji(options)
	const message = getVictoryMessage(options)
	const gameName = getGameName(options.gameType)
	const result = getResultString(options)
	const challenge = getChallengeMessage(options)

	const appUrl = APP_DOMAIN

	// Build the share text
	const lines: string[] = []

	// Line 1: Emoji + Game name
	lines.push(`${emoji} ${APP_NAME} ${gameName}`)

	// Line 2: Result + Victory message
	if (result) {
		lines.push(`${result} - ${message}`)
	} else {
		lines.push(message)
	}

	// Line 3: Emoji grid (if provided)
	if (options.emojiGrid) {
		lines.push('')
		lines.push(options.emojiGrid)
	}

	// Line 4: Streak (if > 0)
	if (options.streak && options.streak > 1) {
		lines.push(`🔥 ${options.streak} day streak`)
	}

	// Line 5: Challenge + URL
	lines.push('')
	lines.push(`${challenge}`)
	lines.push(appUrl)

	return lines.join('\n')
}
