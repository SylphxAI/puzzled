/**
 * User Routes
 *
 * Handles app-specific user preferences (username, bio, compactMode, etc.)
 *
 * ARCHITECTURE:
 * - Profile data (name, email, image) comes from platform SDK (ctx.user)
 * - App-specific preferences stored in local userPreferences table
 * - Global preferences (timezone, locale) are on platform - update via SDK
 *
 * NOTE: Uses method chaining for proper hc type inference.
 */

import { OpenAPIHono, z } from '@hono/zod-openapi'
import { eq } from 'drizzle-orm'
import { HTTPException } from 'hono/http-exception'
import { USER_LIMITS } from '@/lib/config/user'
import { db } from '@/lib/db'
import { userPreferences } from '@/lib/db/schema'
import { authMiddleware, authRateLimitMiddleware } from '../middleware'
import type { PuzzledAuthEnv } from '../types'

// ==========================================
// Schemas
// ==========================================

const usernameSchema = z
	.string()
	.min(
		USER_LIMITS.USERNAME_MIN_LENGTH,
		`Username must be at least ${USER_LIMITS.USERNAME_MIN_LENGTH} characters`,
	)
	.max(
		USER_LIMITS.USERNAME_MAX_LENGTH,
		`Username must be at most ${USER_LIMITS.USERNAME_MAX_LENGTH} characters`,
	)
	.regex(/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers, and underscores')

const bioSchema = z
	.string()
	.max(USER_LIMITS.BIO_MAX_LENGTH, `Bio must be at most ${USER_LIMITS.BIO_MAX_LENGTH} characters`)
	.optional()

const UpdateProfileBodySchema = z.object({
	username: usernameSchema.optional(),
	bio: bioSchema,
	isPublicProfile: z.boolean().optional(),
})

const CheckUsernameQuerySchema = z.object({
	username: usernameSchema,
})

const UpdatePreferencesBodySchema = z.object({
	compactMode: z.boolean().optional(),
	leaderboardVisible: z.boolean().optional(),
})

// ==========================================
// Router (Method Chaining for hc type inference)
// ==========================================

const userRoutes = new OpenAPIHono<PuzzledAuthEnv>()
	// GET /profile - authenticated
	.get('/profile', authMiddleware, async (c) => {
		const user = c.get('user')

		const [prefs] = await db
			.select()
			.from(userPreferences)
			.where(eq(userPreferences.userId, user.id))
			.limit(1)

		return c.json({
			id: user.id,
			name: user.name,
			email: user.email,
			image: user.image,
			username: prefs?.username ?? null,
			bio: prefs?.bio ?? null,
			isPublicProfile: prefs?.isPublicProfile ?? false,
			compactMode: prefs?.compactMode ?? false,
			leaderboardVisible: prefs?.leaderboardVisible ?? true,
		})
	})

	// PUT /profile - authenticated + rate limited
	.put('/profile', authRateLimitMiddleware, async (c) => {
		const body = await c.req.json()
		const parsed = UpdateProfileBodySchema.safeParse(body)
		if (!parsed.success) {
			throw new HTTPException(400, { message: 'Invalid request body' })
		}
		const input = parsed.data
		const user = c.get('user')
		const userId = user.id

		if (input.username) {
			const [existing] = await db
				.select({ userId: userPreferences.userId })
				.from(userPreferences)
				.where(eq(userPreferences.username, input.username))
				.limit(1)

			if (existing && existing.userId !== userId) {
				throw new HTTPException(409, { message: 'Username is already taken' })
			}
		}

		const [updated] = await db
			.insert(userPreferences)
			.values({
				userId,
				username: input.username,
				bio: input.bio,
				isPublicProfile: input.isPublicProfile ?? false,
				updatedAt: new Date(),
			})
			.onConflictDoUpdate({
				target: userPreferences.userId,
				set: {
					...(input.username !== undefined && { username: input.username }),
					...(input.bio !== undefined && { bio: input.bio }),
					...(input.isPublicProfile !== undefined && { isPublicProfile: input.isPublicProfile }),
					updatedAt: new Date(),
				},
			})
			.returning()

		if (!updated) {
			throw new HTTPException(500, { message: 'Failed to update profile' })
		}

		return c.json({
			success: true,
			preferences: {
				userId: updated.userId,
				username: updated.username,
				bio: updated.bio,
				isPublicProfile: updated.isPublicProfile,
			},
		})
	})

	// GET /check-username - authenticated + rate limited
	.get('/check-username', authRateLimitMiddleware, async (c) => {
		const query = c.req.query()
		const parsed = CheckUsernameQuerySchema.safeParse(query)
		if (!parsed.success) {
			throw new HTTPException(400, { message: 'Invalid username' })
		}
		const { username } = parsed.data
		const user = c.get('user')

		const [existing] = await db
			.select({ userId: userPreferences.userId })
			.from(userPreferences)
			.where(eq(userPreferences.username, username))
			.limit(1)

		const isAvailable = !existing || existing.userId === user.id

		return c.json({
			available: isAvailable,
			username,
		})
	})

	// PUT /preferences - authenticated + rate limited
	.put('/preferences', authRateLimitMiddleware, async (c) => {
		const body = await c.req.json()
		const parsed = UpdatePreferencesBodySchema.safeParse(body)
		if (!parsed.success) {
			throw new HTTPException(400, { message: 'Invalid request body' })
		}
		const input = parsed.data
		const user = c.get('user')
		const userId = user.id

		const [updated] = await db
			.insert(userPreferences)
			.values({
				userId,
				compactMode: input.compactMode ?? false,
				leaderboardVisible: input.leaderboardVisible ?? true,
				updatedAt: new Date(),
			})
			.onConflictDoUpdate({
				target: userPreferences.userId,
				set: {
					...(input.compactMode !== undefined && { compactMode: input.compactMode }),
					...(input.leaderboardVisible !== undefined && {
						leaderboardVisible: input.leaderboardVisible,
					}),
					updatedAt: new Date(),
				},
			})
			.returning({
				compactMode: userPreferences.compactMode,
				leaderboardVisible: userPreferences.leaderboardVisible,
			})

		if (!updated) {
			throw new HTTPException(500, { message: 'Failed to update preferences' })
		}

		return c.json({
			success: true,
			preferences: updated,
		})
	})

export { userRoutes }
export type UserRoutes = typeof userRoutes
