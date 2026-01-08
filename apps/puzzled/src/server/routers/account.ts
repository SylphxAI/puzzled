/**
 * Account Router
 *
 * Account management including connected OAuth providers, password settings,
 * and account deletion.
 * Uses auth-state.ts as SSOT for all permission checks.
 */

import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import {
	buildAuthStateFromAccounts,
	CREDENTIAL_PROVIDER_ID,
	canDisconnectOAuth,
	canRemovePassword,
	canSetPassword,
	getAuthStateWithAccounts,
	getDisconnectBlockedReason,
} from '@/features/auth/server'
import { createSecurityAlert } from '@/features/settings'
import { db } from '@/lib/db'
import { accounts, subscriptions, users } from '@/lib/db/schema'
import { getEnabledOAuthProviders, getOAuthProviderDisplayName } from '@/lib/oauth-providers'
import { captureError } from '@/lib/sentry'
import { requireChallenge } from '../lib/challenge'
import { protectedProcedure, protectedRateLimitedProcedure, publicProcedure, router } from '../trpc'

export const accountRouter = router({
	/**
	 * Get enabled OAuth providers
	 * Returns which social login providers are configured
	 */
	getEnabledProviders: publicProcedure.query(() => {
		return getEnabledOAuthProviders()
	}),

	/**
	 * Get all connected accounts for the current user
	 * Returns list of OAuth providers with per-provider disconnect permissions
	 */
	getConnectedAccounts: protectedProcedure.query(async ({ ctx }) => {
		// Get auth state with accounts in single query (fixes N+1)
		const authState = await getAuthStateWithAccounts(ctx.user.id)

		// Get OAuth accounts with per-provider permissions
		const oauthAccounts = authState.accounts
			.filter((account) => account.providerId !== CREDENTIAL_PROVIDER_ID)
			.map((account) => ({
				id: account.id,
				provider: account.providerId,
				accountId: account.accountId,
				connectedAt: account.createdAt,
				// Per-provider disconnect permission from SSOT
				canDisconnect: canDisconnectOAuth(authState, account.providerId),
				disconnectBlockedReason: getDisconnectBlockedReason(authState, account.providerId),
			}))

		return {
			hasPassword: authState.hasCredential,
			canSetPassword: canSetPassword(authState),
			canRemovePassword: canRemovePassword(authState),
			oauthAccounts,
			// Summary for UI
			authMethodCount: (authState.hasCredential ? 1 : 0) + authState.oauthProviders.length,
		}
	}),

	/**
	 * Disconnect an OAuth account
	 *
	 * INVARIANT: User must always retain at least one auth method.
	 * Permission check uses auth-state.ts as SSOT.
	 * Uses transaction to prevent TOCTOU race conditions.
	 */
	disconnectAccount: protectedRateLimitedProcedure
		.input(
			z.object({
				accountId: z.string().uuid(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const sessionToken = ctx.session.session.token

			// Require identity verification for security - disconnecting OAuth is a sensitive action
			await requireChallenge(sessionToken, 'identity')

			// Use transaction to prevent race condition (TOCTOU-safe permission check)
			const { providerId } = await db.transaction(async (tx) => {
				// Get all user accounts within transaction for consistency
				const userAccounts = await tx
					.select({
						id: accounts.id,
						providerId: accounts.providerId,
					})
					.from(accounts)
					.where(eq(accounts.userId, ctx.user.id))

				// Find the account to disconnect
				const account = userAccounts.find((a) => a.id === input.accountId)
				if (!account) {
					throw new TRPCError({
						code: 'NOT_FOUND',
						message: 'Account not found',
					})
				}

				// Block credential account removal through this endpoint
				// Password removal has its own endpoint with different flow
				if (account.providerId === CREDENTIAL_PROVIDER_ID) {
					throw new TRPCError({
						code: 'BAD_REQUEST',
						message: 'Use password removal endpoint to remove password',
					})
				}

				// Build auth state from transaction data for TOCTOU-safe permission check
				const authState = buildAuthStateFromAccounts(userAccounts)

				// Use SSOT permission function
				if (!canDisconnectOAuth(authState, account.providerId)) {
					throw new TRPCError({
						code: 'BAD_REQUEST',
						message:
							getDisconnectBlockedReason(authState, account.providerId) ??
							'Cannot disconnect this account',
					})
				}

				// Delete the account
				await tx.delete(accounts).where(eq(accounts.id, input.accountId))

				return { providerId: account.providerId }
			})

			// Create security alert outside transaction (best-effort, non-blocking)
			const providerName = getOAuthProviderDisplayName(providerId)
			await createSecurityAlert(ctx.user.id, 'oauth_disconnected', {
				provider: providerId,
				providerDisplayName: providerName,
			})

			return { success: true }
		}),

	/**
	 * Delete user account
	 *
	 * Requires challenge ('both' - identity + MFA if enabled) for security.
	 * This is a destructive action that cannot be undone.
	 */
	deleteAccount: protectedRateLimitedProcedure
		.input(
			z.object({
				// Confirmation word is validated client-side (localized)
				// Server relies on challenge for security, not the confirmation string
				confirmation: z.string().min(1),
			}),
		)
		.mutation(async ({ ctx }) => {
			const sessionToken = ctx.session.session.token

			// Require both identity and MFA verification (if user has 2FA enabled)
			// Account deletion is the most sensitive operation
			await requireChallenge(sessionToken, 'both')

			try {
				// Cancel any active Stripe subscription before deleting user
				const subscription = await db.query.subscriptions.findFirst({
					where: eq(subscriptions.userId, ctx.user.id),
				})

				if (subscription?.stripeSubscriptionId) {
					try {
						const { cancelSubscription } = await import('@/features/subscription/lib/stripe')
						await cancelSubscription(subscription.stripeSubscriptionId)
					} catch (stripeError) {
						// Log but don't block deletion - Stripe can handle orphaned subscriptions
						captureError(
							stripeError instanceof Error ? stripeError : new Error(String(stripeError)),
							{
								tags: { operation: 'delete-account', step: 'cancel-stripe-subscription' },
								extra: { userId: ctx.user.id },
								level: 'warning',
							},
						)
					}
				}

				// Delete user (cascade will handle related records)
				await db.delete(users).where(eq(users.id, ctx.user.id))

				return { success: true }
			} catch (error) {
				captureError(error instanceof Error ? error : new Error(String(error)), {
					tags: { operation: 'delete-account' },
					extra: { userId: ctx.user.id },
				})
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Failed to delete account. Please contact support.',
				})
			}
		}),
})
