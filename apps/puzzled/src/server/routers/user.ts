/**
 * User Settings Router
 *
 * Handles user profile updates, avatar uploads, username validation
 */

import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { LIMITS } from '@/features/settings'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
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
	name: z.string().min(1, 'Name is required').max(100).optional(),
	username: usernameSchema.optional(),
	bio: bioSchema,
	isPublicProfile: z.boolean().optional(),
})

const updatePreferencesSchema = z.object({
	timezone: z.string().max(50).optional(),
	locale: z.string().max(10).optional(),
	dateFormat: z.enum(['relative', 'absolute', 'iso']).optional(),
	reduceMotion: z.boolean().optional(),
	compactMode: z.boolean().optional(),
})

const checkUsernameSchema = z.object({
	username: usernameSchema,
})

// ==========================================
// Router
// ==========================================

export const userRouter = router({
	/**
	 * Update user profile
	 * Rate limited to prevent abuse
	 */
	updateProfile: protectedRateLimitedProcedure
		.input(updateProfileSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.user.id

			// If username is being updated, check if it's available
			if (input.username) {
				const [existing] = await db
					.select({ id: users.id })
					.from(users)
					.where(eq(users.username, input.username))
					.limit(1)

				if (existing && existing.id !== userId) {
					throw new TRPCError({
						code: 'CONFLICT',
						message: 'Username is already taken',
					})
				}
			}

			// Update user profile
			const [updated] = await db
				.update(users)
				.set({
					...input,
					updatedAt: new Date(),
				})
				.where(eq(users.id, userId))
				.returning()

			if (!updated) {
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Failed to update profile',
				})
			}

			return {
				success: true,
				user: {
					id: updated.id,
					name: updated.name,
					username: updated.username,
					bio: updated.bio,
					isPublicProfile: updated.isPublicProfile,
					image: updated.image,
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
				.select({ id: users.id })
				.from(users)
				.where(eq(users.username, input.username))
				.limit(1)

			const isAvailable = !existing || existing.id === ctx.user.id

			return {
				available: isAvailable,
				username: input.username,
			}
		}),

	/**
	 * Get current user profile
	 */
	getProfile: protectedProcedure.query(async ({ ctx }) => {
		const [user] = await db
			.select({
				id: users.id,
				name: users.name,
				email: users.email,
				emailVerified: users.emailVerified,
				username: users.username,
				bio: users.bio,
				image: users.image,
				isPublicProfile: users.isPublicProfile,
				timezone: users.timezone,
				locale: users.locale,
				dateFormat: users.dateFormat,
				reduceMotion: users.reduceMotion,
				compactMode: users.compactMode,
				leaderboardVisible: users.leaderboardVisible,
			})
			.from(users)
			.where(eq(users.id, ctx.user.id))
			.limit(1)

		if (!user) {
			throw new TRPCError({
				code: 'NOT_FOUND',
				message: 'User not found',
			})
		}

		return user
	}),

	/**
	 * Update user preferences (timezone, locale, dateFormat, appearance)
	 * Rate limited to prevent abuse
	 */
	updatePreferences: protectedRateLimitedProcedure
		.input(updatePreferencesSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.user.id

			const [updated] = await db
				.update(users)
				.set({
					...input,
					updatedAt: new Date(),
				})
				.where(eq(users.id, userId))
				.returning({
					timezone: users.timezone,
					locale: users.locale,
					dateFormat: users.dateFormat,
					reduceMotion: users.reduceMotion,
					compactMode: users.compactMode,
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
