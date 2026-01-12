/**
 * Feature Flags API Route
 *
 * Returns feature flags for the Puzzled app.
 *
 * In production, this would call the Sylphx Platform to evaluate flags
 * based on user context. For now, it returns app-defined defaults
 * that can be overridden via environment variables.
 */

import { NextResponse, type NextRequest } from 'next/server'

interface FeatureFlag {
	key: string
	value: boolean | string | number
	enabled: boolean
	variant?: string
}

interface FlagRequestBody {
	context?: {
		userId?: string
		email?: string
		attributes?: Record<string, unknown>
	}
}

/**
 * Get feature flags based on user context
 *
 * Flags can be controlled via environment variables:
 * - FEATURE_PREMIUM_HINTS=true
 * - FEATURE_NEW_GAME_UI=true
 * etc.
 */
function getFeatureFlags(context?: FlagRequestBody['context']): FeatureFlag[] {
	const isPremium = context?.attributes?.isPremium === true

	// Define flags with defaults and environment overrides
	const flags: FeatureFlag[] = [
		// Premium features (enabled for premium users)
		{
			key: 'premium-hints',
			value: isPremium || process.env.FEATURE_PREMIUM_HINTS === 'true',
			enabled: isPremium || process.env.FEATURE_PREMIUM_HINTS === 'true',
		},
		{
			key: 'premium-statistics',
			value: isPremium || process.env.FEATURE_PREMIUM_STATISTICS === 'true',
			enabled: isPremium || process.env.FEATURE_PREMIUM_STATISTICS === 'true',
		},
		{
			key: 'premium-themes',
			value: isPremium || process.env.FEATURE_PREMIUM_THEMES === 'true',
			enabled: isPremium || process.env.FEATURE_PREMIUM_THEMES === 'true',
		},
		{
			key: 'archive-access',
			value: isPremium || process.env.FEATURE_ARCHIVE_ACCESS === 'true',
			enabled: isPremium || process.env.FEATURE_ARCHIVE_ACCESS === 'true',
		},
		// Experiments (controlled via env vars for rollout)
		{
			key: 'new-game-ui',
			value: process.env.FEATURE_NEW_GAME_UI === 'true',
			enabled: process.env.FEATURE_NEW_GAME_UI === 'true',
		},
		{
			key: 'social-features',
			value: process.env.FEATURE_SOCIAL === 'true',
			enabled: process.env.FEATURE_SOCIAL === 'true',
		},
		{
			key: 'leaderboard-v2',
			value: process.env.FEATURE_LEADERBOARD_V2 === 'true',
			enabled: process.env.FEATURE_LEADERBOARD_V2 === 'true',
		},
		// Game rollouts
		{
			key: 'crossword-game',
			value: process.env.FEATURE_CROSSWORD !== 'false', // Enabled by default
			enabled: process.env.FEATURE_CROSSWORD !== 'false',
		},
		{
			key: 'multiplayer-mode',
			value: process.env.FEATURE_MULTIPLAYER === 'true',
			enabled: process.env.FEATURE_MULTIPLAYER === 'true',
		},
		{
			key: 'ai-generated-puzzles',
			value: process.env.FEATURE_AI_PUZZLES === 'true',
			enabled: process.env.FEATURE_AI_PUZZLES === 'true',
		},
	]

	return flags
}

export async function POST(request: NextRequest) {
	try {
		const body: FlagRequestBody = await request.json()
		const flags = getFeatureFlags(body.context)

		return NextResponse.json({ flags })
	} catch (error) {
		console.error('[api/flags] Error getting flags:', error)
		return NextResponse.json({ flags: getFeatureFlags() })
	}
}

export async function GET() {
	const flags = getFeatureFlags()
	return NextResponse.json({ flags })
}
