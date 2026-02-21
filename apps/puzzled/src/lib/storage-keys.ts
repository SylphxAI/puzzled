/**
 * Centralized localStorage keys
 *
 * All localStorage keys should be defined here to ensure:
 * - Single source of truth
 * - Consistent naming convention
 * - Easy discovery and refactoring
 * - Prevent key collisions
 *
 * Naming convention: 'puzzled:{domain}:{key}'
 * - Use colons as separators
 * - Domain groups related keys
 * - Keep keys lowercase with hyphens
 */

// ==========================================
// Consent & Privacy
// ==========================================
export const CONSENT_KEY = "puzzled:consent:cookie";
export const CONSENT_TIMESTAMP_KEY = "puzzled:consent:timestamp";

// ==========================================
// Theme & Display
// ==========================================
const _THEME_KEY = "theme"; // Standard next-themes key

// ==========================================
// Sound & Audio
// ==========================================
export const SOUND_ENABLED_KEY = "puzzled:sound:enabled";

// ==========================================
// PWA & Prompts
// ==========================================
export const PWA_PROMPT_DISMISSED_KEY = "puzzled:pwa:prompt-dismissed";

// ==========================================
// Guest User Data
// ==========================================
export const GUEST_ONBOARDING_KEY = "puzzled:guest:onboarding";
export const GUEST_GAMES_KEY = "puzzled:guest:games";

// ==========================================
// Analytics & Session
// ==========================================
export const ANALYTICS_OFFLINE_QUEUE_KEY = "puzzled:analytics:offline-queue";
export const SESSION_START_KEY = "puzzled:session:start";
export const SESSION_ID_KEY = "puzzled:session:id";

// ==========================================
// Game Session (dynamic per game)
// ==========================================
/**
 * Get the localStorage key for tracking if a game was started today
 * @param gameSlug - The game identifier (e.g., 'word-guess', 'sudoku')
 * @param puzzleId - Optional puzzle ID for specific puzzle tracking
 */
export function getGameSessionKey(gameSlug: string, puzzleId?: string): string {
	return puzzleId
		? `puzzled:game:${gameSlug}:${puzzleId}:started`
		: `puzzled:game:${gameSlug}:started`;
}
