/**
 * Engagement Library
 *
 * Types and utilities for engagement features (streaks, leaderboards, achievements).
 *
 * ## Architecture (ADR-004)
 *
 * Engagement uses **Inline Defaults + Auto-Discovery + Console Override**:
 * - Code provides inline defaults at function call time
 * - Platform auto-discovers entities when first referenced
 * - Console can override values without code deployment
 *
 * No config files required - just call the engagement functions directly.
 *
 * @example
 * ```typescript
 * // Unlock achievement with inline defaults
 * await unlockAchievement(config, userId, 'first-win', {
 *   name: 'First Win',
 *   description: 'Win your first game',
 *   tier: 'bronze',
 *   points: 100,
 * })
 *
 * // Record streak activity
 * await recordStreakActivity(config, userId, 'daily-login', {
 *   name: 'Daily Login',
 *   frequency: 'daily',
 *   gracePeriodHours: 4,
 * })
 * ```
 */

export * from './types'
