/**
 * Feature Flags for Puzzled
 *
 * Uses the Sylphx Platform SDK's feature flag system.
 * Enables gradual rollouts, A/B testing, and feature gating.
 *
 * Usage:
 * ```tsx
 * const { isEnabled } = useFeatureFlag('premium-hints')
 * if (isEnabled) {
 *   // Show premium hint button
 * }
 * ```
 */

'use client'

export {
	useFeatureFlag,
	useFeatureFlags,
	useFlagOverrides,
	FeatureFlagProvider,
	type FeatureFlag,
	type FlagValue,
	type UseFeatureFlagReturn,
} from '@sylphx/platform-sdk/react'

// ==========================================
// Puzzled-specific Flag Keys
// ==========================================

/**
 * Feature flag keys used in Puzzled
 *
 * Keep this type definition in sync with flags configured in the platform.
 */
export type PuzzledFeatureFlags =
	// Premium Features
	| 'premium-hints' // Unlimited hints for premium users
	| 'premium-statistics' // Advanced statistics dashboard
	| 'premium-themes' // Custom theme selection
	| 'archive-access' // Access to past puzzles
	// Experiments
	| 'new-game-ui' // New game interface design
	| 'social-features' // Share scores, challenges
	| 'leaderboard-v2' // New leaderboard with filters
	// Rollouts
	| 'crossword-game' // Crossword puzzle game
	| 'multiplayer-mode' // Real-time multiplayer
	| 'ai-generated-puzzles' // AI-generated daily puzzles

/**
 * Hook for Puzzled feature flags with type-safe keys
 */
export function usePuzzledFlag(
	key: PuzzledFeatureFlags,
	defaultValue = false,
) {
	// Re-export with type safety
	// biome-ignore lint/correctness/useHookAtTopLevel: This is a wrapper hook
	const { useFeatureFlag } = require('@sylphx/platform-sdk/react')
	return useFeatureFlag(key, { defaultValue })
}

/**
 * Hook for checking multiple Puzzled flags
 */
export function usePuzzledFlags(keys: PuzzledFeatureFlags[]) {
	// biome-ignore lint/correctness/useHookAtTopLevel: This is a wrapper hook
	const { useFeatureFlags } = require('@sylphx/platform-sdk/react')
	return useFeatureFlags(keys)
}
