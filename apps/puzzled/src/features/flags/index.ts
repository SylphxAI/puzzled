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

import {
	useFeatureFlag,
	useFeatureFlags,
} from '@sylphx/sdk/react'

// Re-export SDK hooks and types for convenience
export {
	useFeatureFlag,
	useFeatureFlags,
	useFlagOverrides,
	FeatureFlagProvider,
	type FeatureFlag,
	type FlagValue,
	type UseFeatureFlagReturn,
} from '@sylphx/sdk/react'

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
 *
 * @example
 * ```tsx
 * const { isEnabled, value } = usePuzzledFlag('premium-hints')
 * ```
 */
export function usePuzzledFlag(
	key: PuzzledFeatureFlags,
	defaultValue = false,
) {
	return useFeatureFlag(key, { defaultValue })
}

/**
 * Hook for checking multiple Puzzled flags at once
 *
 * @example
 * ```tsx
 * const flags = usePuzzledFlags(['premium-hints', 'archive-access'])
 * ```
 */
export function usePuzzledFlags(keys: PuzzledFeatureFlags[]) {
	return useFeatureFlags(keys)
}
