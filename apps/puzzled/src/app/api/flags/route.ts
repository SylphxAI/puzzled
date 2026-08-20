/**
 * Feature Flags API Route
 *
 * Returns feature flags for the app.
 * Platform integration pending - currently returns hardcoded defaults.
 */

import { type NextRequest, NextResponse } from 'next/server'

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
 * Get feature flags for a user
 *
 * Currently returns hardcoded defaults. Platform integration will be added
 * when the flags REST API is available, enabling per-user flag targeting.
 */
async function getPlatformFlags(_userId?: string): Promise<FeatureFlag[]> {
	// Platform flags API integration pending - return defaults for now
	return getDefaultFlags()
}

/**
 * Default flags for graceful degradation when Platform is unavailable
 */
function getDefaultFlags(): FeatureFlag[] {
	return [
		// Core features - always enabled as defaults
		{ key: 'crossword-game', value: true, enabled: true },
		// Experimental features - disabled by default
		{ key: 'premium-hints', value: false, enabled: false },
		{ key: 'premium-statistics', value: false, enabled: false },
		{ key: 'premium-themes', value: false, enabled: false },
		{ key: 'archive-access', value: false, enabled: false },
		{ key: 'new-game-ui', value: false, enabled: false },
		{ key: 'social-features', value: false, enabled: false },
		{ key: 'leaderboard-v2', value: false, enabled: false },
		{ key: 'multiplayer-mode', value: false, enabled: false },
		{ key: 'ai-generated-puzzles', value: false, enabled: false },
	]
}

export async function POST(request: NextRequest) {
	try {
		const body: FlagRequestBody = await request.json()
		const flags = await getPlatformFlags(body.context?.userId)

		return NextResponse.json({ flags })
	} catch (error) {
		console.error('[api/flags] Error:', error)
		// Always return valid response for graceful degradation
		return NextResponse.json({ flags: getDefaultFlags() })
	}
}

export async function GET() {
	const flags = await getPlatformFlags()
	return NextResponse.json({ flags })
}
