import { createHmac, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { DAY_MS, MINUTE_MS } from '@/lib/constants/time'
import { db } from '@/lib/db'
import { notificationPreferences } from '@/lib/db/schema'

export const runtime = 'nodejs' // Required for crypto

// Fail fast if secret is missing - this is a security-critical credential
function getSecret(): string {
	const secret = process.env.CRON_SECRET
	if (!secret) {
		throw new Error('[Unsubscribe] Missing CRON_SECRET environment variable')
	}
	return secret
}
const UNSUBSCRIBE_SECRET = getSecret()

// Token expiration: 30 days
const TOKEN_EXPIRY_DAYS = 30
const TOKEN_EXPIRY_MS = TOKEN_EXPIRY_DAYS * DAY_MS

/**
 * Generate a signed unsubscribe token for a user ID
 * Format: userId.timestamp.signature
 * Token expires after 30 days for security
 */
export function generateUnsubscribeToken(userId: string): string {
	const timestamp = Date.now().toString(36) // Base36 for shorter encoding
	const data = `${userId}.${timestamp}`
	const signature = createHmac('sha256', UNSUBSCRIBE_SECRET).update(data).digest('hex').slice(0, 16)
	return `${userId}.${timestamp}.${signature}`
}

/**
 * Verify and extract user ID from unsubscribe token
 * Returns null if token is invalid, expired, or tampered
 */
function verifyUnsubscribeToken(token: string): string | null {
	const parts = token.split('.')

	// Support both old format (userId.signature) and new format (userId.timestamp.signature)
	// Old format tokens are treated as expired for security
	if (parts.length === 2) {
		// Old format - no timestamp, treat as expired
		console.log('[Unsubscribe] Legacy token format detected, treating as expired')
		return null
	}

	if (parts.length !== 3) return null

	const [userId, timestamp, providedSignature] = parts

	// Verify timestamp is not expired
	try {
		const tokenTime = parseInt(timestamp, 36)
		const now = Date.now()

		// Check if token is too old
		if (now - tokenTime > TOKEN_EXPIRY_MS) {
			console.log('[Unsubscribe] Token expired')
			return null
		}

		// Check if token is from the future (clock skew protection, allow 5 min)
		if (tokenTime > now + 5 * MINUTE_MS) {
			console.log('[Unsubscribe] Token from future, likely tampering')
			return null
		}
	} catch {
		return null
	}

	// Verify signature
	const data = `${userId}.${timestamp}`
	const expectedSignature = createHmac('sha256', UNSUBSCRIBE_SECRET)
		.update(data)
		.digest('hex')
		.slice(0, 16)

	// Timing-safe comparison
	try {
		const provided = Buffer.from(providedSignature, 'utf8')
		const expected = Buffer.from(expectedSignature, 'utf8')
		if (provided.length !== expected.length) return null
		if (!timingSafeEqual(provided, expected)) return null
		return userId
	} catch {
		return null
	}
}

const unsubscribeSchema = z.object({
	token: z.string().min(1),
})

/**
 * POST /api/email/unsubscribe
 * Unsubscribe a user from marketing emails using a signed token
 *
 * Note: User existence is validated by the signed token itself.
 * If a user was deleted, the notification preferences upsert is harmless.
 */
export async function POST(request: Request) {
	try {
		const body = await request.json()
		const parsed = unsubscribeSchema.safeParse(body)

		if (!parsed.success) {
			return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
		}

		const userId = verifyUnsubscribeToken(parsed.data.token)
		if (!userId) {
			return NextResponse.json({ error: 'Invalid or expired unsubscribe link' }, { status: 400 })
		}

		// Update notificationPreferences (upsert - create if doesn't exist)
		const existingPrefs = await db.query.notificationPreferences.findFirst({
			where: eq(notificationPreferences.userId, userId),
		})

		if (existingPrefs) {
			await db
				.update(notificationPreferences)
				.set({ emailMarketing: false, updatedAt: new Date() })
				.where(eq(notificationPreferences.userId, userId))
		} else {
			await db.insert(notificationPreferences).values({
				userId,
				emailMarketing: false,
			})
		}

		console.log(`[Unsubscribe] User ${userId} unsubscribed from marketing emails`)

		return NextResponse.json({
			success: true,
			message: 'Successfully unsubscribed from marketing emails',
		})
	} catch (error) {
		console.error('[Unsubscribe] Error:', error)
		return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 })
	}
}

/**
 * GET /api/email/unsubscribe?token=xxx
 * Alternative endpoint for one-click unsubscribe from email links
 */
export async function GET(request: Request) {
	const { searchParams } = new URL(request.url)
	const token = searchParams.get('token')

	if (!token) {
		return NextResponse.redirect(new URL('/unsubscribe?error=missing_token', request.url))
	}

	const userId = verifyUnsubscribeToken(token)
	if (!userId) {
		return NextResponse.redirect(new URL('/unsubscribe?error=invalid_token', request.url))
	}

	try {
		// Update notificationPreferences (upsert - create if doesn't exist)
		const existingPrefs = await db.query.notificationPreferences.findFirst({
			where: eq(notificationPreferences.userId, userId),
		})

		if (existingPrefs) {
			await db
				.update(notificationPreferences)
				.set({ emailMarketing: false, updatedAt: new Date() })
				.where(eq(notificationPreferences.userId, userId))
		} else {
			await db.insert(notificationPreferences).values({
				userId,
				emailMarketing: false,
			})
		}

		console.log(`[Unsubscribe] User ${userId} unsubscribed via one-click`)

		return NextResponse.redirect(new URL('/unsubscribe?success=true', request.url))
	} catch (error) {
		console.error('[Unsubscribe] Error:', error)
		return NextResponse.redirect(new URL('/unsubscribe?error=failed', request.url))
	}
}
