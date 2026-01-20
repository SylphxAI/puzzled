/**
 * Feature Flags API Route
 *
 * Proxies feature flag requests to the Sylphx Platform SDK.
 * All flag configuration is managed centrally in the Platform dashboard.
 *
 * The Platform handles:
 * - Flag creation and configuration
 * - Rollout percentages
 * - User targeting
 * - Premium/admin gating
 *
 * This route simply forwards requests to the Platform's featureFlags.getAll endpoint.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@sylphx/sdk/server'

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

// Environment configuration
const APP_ID = process.env.NEXT_PUBLIC_SYLPHX_APP_ID
const APP_SECRET = process.env.SYLPHX_SECRET_KEY

/**
 * Get feature flags from the Sylphx Platform
 */
async function getPlatformFlags(userId?: string): Promise<FeatureFlag[]> {
	// If Platform not configured, return empty (graceful degradation)
	if (!APP_ID || !APP_SECRET) {
		console.warn('[api/flags] Platform not configured, using defaults')
		return getDefaultFlags()
	}

	try {
		// Create SDK server client
		const client = createServerClient({
			appId: APP_ID,
			appSecret: APP_SECRET,
		})

		// Call the Platform's flags.getAll endpoint
		const flagMap = await client.flags.getAll(userId) as Record<string, boolean>

		// Transform to array format expected by SDK provider
		return Object.entries(flagMap).map(([key, enabled]) => ({
			key,
			value: enabled as boolean,
			enabled: enabled as boolean,
		}))
	} catch (error) {
		console.error('[api/flags] Error fetching from Platform:', error)
		// Fallback to defaults on error
		return getDefaultFlags()
	}
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
