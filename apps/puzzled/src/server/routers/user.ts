/**
 * User Settings Router
 *
 * Handles app-specific user preferences (username, bio, compactMode, etc.)
 *
 * ARCHITECTURE:
 * - Profile data (name, email, image) comes from platform SDK (ctx.user)
 * - App-specific preferences stored in local userPreferences table
 * - Global preferences (timezone, locale) are on platform - update via SDK
 */

import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { LIMITS } from '@/lib/config/user'
import { db } from '@/lib/db'
import { userPreferences } from '@/lib/db/schema'
import { protectedProcedure, protectedRateLimitedProcedure, router } from '../trpc'

// ==========================================
// Validation Schemas (using SSOT constants)
// ==========================================

const usernameSchema = z
	.string()
	.min(
		LIMITS.USERNAME_MIN_LENGTH,
		`Username must be at least ${LIMITS.USERNAME_MIN_LENGTH} characters`,
	)
	.max(
		LIMITS.USERNAME_MAX_LENGTH,
		`Username must be at most ${LIMITS.USERNAME_MAX_LENGTH} characters`,
	)
	.regex(/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers, and underscores')

const bioSchema = z
	.string()
	.max(LIMITS.BIO_MAX_LENGTH, `Bio must be at most ${LIMITS.BIO_MAX_LENGTH} characters`)
	.optional()

const updateProfileSchema = z.object({
	username: usernameSchema.optional(),
	bio: bioSchema,
	isPublicProfile: z.boolean().optional(),
})

const updatePreferencesSchema = z.object({
	compactMode: z.boolean().optional(),
	leaderboardVisible: z.boolean().optional(),
})

const checkUsernameSchema = z.object({
	username: usernameSchema,
})

// ==========================================
// Router
// ==========================================

export const userRouter = router({
	/**
	 * Update app-specific user profile (username, bio, etc.)
	 * Rate limited to prevent abuse
	 */
	updateProfile: protectedRateLimitedProcedure
		.input(updateProfileSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.user.id

			// If username is being updated, check if it's available
			if (input.username) {
				const [existing] = await db
					.select({ userId: userPreferences.userId })
					.from(userPreferences)
					.where(eq(userPreferences.username, input.username))
					.limit(1)

				if (existing && existing.userId !== userId) {
					throw new TRPCError({
						code: 'CONFLICT',
						message: 'Username is already taken',
					})
				}
			}

			// Upsert user preferences
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
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Failed to update profile',
				})
			}

			return {
				success: true,
				preferences: {
					userId: updated.userId,
					username: updated.username,
					bio: updated.bio,
					isPublicProfile: updated.isPublicProfile,
				},
			}
		}),

	/**
	 * Check username availability
	 */
	checkUsername: protectedRateLimitedProcedure
		.input(checkUsernameSchema)
		.query(async ({ ctx, input }) => {
			const [existing] = await db
				.select({ userId: userPreferences.userId })
				.from(userPreferences)
				.where(eq(userPreferences.username, input.username))
				.limit(1)

			const isAvailable = !existing || existing.userId === ctx.user.id

			return {
				available: isAvailable,
				username: input.username,
			}
		}),

	/**
	 * Get current user's app preferences
	 * Combines platform user data with local preferences
	 */
	getProfile: protectedProcedure.query(async ({ ctx }) => {
		// Get app-specific preferences
		const [prefs] = await db
			.select()
			.from(userPreferences)
			.where(eq(userPreferences.userId, ctx.user.id))
			.limit(1)

		// Combine platform user data with app preferences
		return {
			// Platform data (from ctx.user via SDK auth)
			id: ctx.user.id,
			name: ctx.user.name,
			email: ctx.user.email,
			image: ctx.user.image,

			// App-specific preferences (local)
			username: prefs?.username ?? null,
			bio: prefs?.bio ?? null,
			isPublicProfile: prefs?.isPublicProfile ?? false,
			compactMode: prefs?.compactMode ?? false,
			leaderboardVisible: prefs?.leaderboardVisible ?? true,
		}
	}),

	/**
	 * Update app-specific preferences (compactMode, leaderboardVisible)
	 * Rate limited to prevent abuse
	 */
	updatePreferences: protectedRateLimitedProcedure
		.input(updatePreferencesSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.user.id

			// Upsert preferences
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
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Failed to update preferences',
				})
			}

			return {
				success: true,
				preferences: updated,
			}
		}),
})
