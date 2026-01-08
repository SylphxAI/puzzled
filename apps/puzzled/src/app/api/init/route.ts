/**
 * Application Initialization Endpoint
 *
 * Seeds initial configuration from environment variables.
 * Safe to call multiple times - only seeds if not already set.
 *
 * Call this on deployment to ensure settings are initialized.
 * Can be triggered via Vercel deployment hook or manually.
 *
 * SECURITY: Requires INIT_SECRET token in Authorization header to prevent abuse.
 */

import { timingSafeEqual } from 'node:crypto'
import { type NextRequest, NextResponse } from 'next/server'
import { runInitialization } from '@/lib/init'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Validate the init secret token using constant-time comparison
 */
function validateInitSecret(request: NextRequest): boolean {
	const authHeader = request.headers.get('Authorization')
	if (!authHeader?.startsWith('Bearer ')) {
		return false
	}

	const providedToken = authHeader.slice(7)
	const expectedToken = process.env.INIT_SECRET

	// SECURITY: If no INIT_SECRET is set, only allow in development
	// This is a convenience for local development only
	if (!expectedToken) {
		if (process.env.NODE_ENV === 'development') {
			console.warn('[Init] INIT_SECRET not configured - allowing in development mode only')
			return true
		}
		// In production/staging without INIT_SECRET, deny all requests
		console.error('[Init] INIT_SECRET not configured - denying request in non-development mode')
		return false
	}

	// Constant-time comparison to prevent timing attacks
	try {
		const providedBuffer = Buffer.from(providedToken)
		const expectedBuffer = Buffer.from(expectedToken)
		if (providedBuffer.length !== expectedBuffer.length) {
			return false
		}
		return timingSafeEqual(providedBuffer, expectedBuffer)
	} catch {
		return false
	}
}

/**
 * POST /api/init
 *
 * Initialize application settings from environment variables.
 * This endpoint is idempotent - safe to call multiple times.
 *
 * Security: Requires INIT_SECRET token in Authorization header.
 * In development, works without token if INIT_SECRET is not set.
 */
export async function POST(request: NextRequest) {
	// Validate authorization
	if (!validateInitSecret(request)) {
		return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
	}

	try {
		const result = await runInitialization()

		return NextResponse.json({
			success: true,
			initialized: {
				superadmin: result.superadmin,
				model: result.model,
			},
			message: 'Initialization complete. Existing settings were preserved.',
		})
	} catch (error) {
		console.error('[Init] Initialization failed:', error)
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 },
		)
	}
}

/**
 * GET /api/init
 *
 * Check initialization status without making changes.
 */
export async function GET() {
	const envStatus = {
		INITIAL_SUPERADMIN_EMAIL: !!process.env.INITIAL_SUPERADMIN_EMAIL,
		PUZZLE_GENERATOR_MODEL: !!process.env.PUZZLE_GENERATOR_MODEL,
	}

	return NextResponse.json({
		configured: envStatus,
		message: 'POST to this endpoint to run initialization',
	})
}
