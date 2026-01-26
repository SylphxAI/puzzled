/**
 * Shared Game Utilities (Server-Safe)
 *
 * Consolidated utilities used across multiple games:
 * - Random: Deterministic seeded random for puzzle generation
 * - Format: Time and value formatting
 *
 * NOTE: useGameSession is NOT exported here to keep this barrel server-safe.
 * Game components should import directly from '@/games/shared/use-game-session'
 */

// Format utilities
export {
	calculateWordleScore,
	compareByTime,
	formatTimeScore,
	isPerfectGame,
} from './format'
// Random utilities (FROZEN - do not modify algorithms)
export { pickRandom } from './random'

// Types only (no runtime code) - safe for server
