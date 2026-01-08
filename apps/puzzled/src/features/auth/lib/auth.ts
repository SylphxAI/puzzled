import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { twoFactor } from 'better-auth/plugins'
import { APP_NAME } from '@/lib/config/app'
import { SESSION_CONFIG } from '@/lib/config/subscription'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { tryAutoPromoteSuperAdmin } from '@/lib/init'
import { getBetterAuthSocialProviders } from '@/lib/oauth-providers'
import { getServerBaseUrl } from '@/lib/utils'
import { CREDENTIAL_PROVIDER_ID } from './auth-state'

// Dynamic import to avoid build-time initialization issues with Resend
async function getSendVerificationEmail() {
	const { sendVerificationEmail } = await import('@/features/notifications/server')
	return sendVerificationEmail
}

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
	window: 60, // 1 minute window
	max: 10, // 10 requests per window
}

// Build social providers config from shared config
const socialProviders = getBetterAuthSocialProviders()

export const auth = betterAuth({
	// App name for TOTP issuer
	appName: APP_NAME,

	// Expose role field in session for client-side access
	user: {
		additionalFields: {
			role: {
				type: 'string',
				defaultValue: 'user',
				input: false, // Don't allow setting via signup
			},
			username: {
				type: 'string',
				required: false,
				input: false,
			},
			bio: {
				type: 'string',
				required: false,
				input: false,
			},
			isPublicProfile: {
				type: 'boolean',
				defaultValue: false,
				input: false,
			},
		},
	},

	database: drizzleAdapter(db, {
		provider: 'pg',
		schema: {
			user: schema.users,
			session: schema.sessions,
			account: schema.accounts,
			verification: schema.verifications,
			twoFactor: schema.twoFactors,
		},
	}),

	// Generate UUIDs to match our schema (uuid columns, not text)
	advanced: {
		database: {
			generateId: false, // Let database generate UUIDs via defaultRandom()
		},
	},

	// Per spec: MFA required for admin and super_admin roles
	plugins: [
		twoFactor({
			issuer: APP_NAME,
			// Skip 2FA for trusted devices (30 days)
			skipVerificationOnEnable: false,
		}),
	],

	databaseHooks: {
		session: {
			update: {
				after: async (session, ctx) => {
					// Set twoFactorVerified = true when 2FA is verified via better-auth
					// This enables our custom admin 2FA requirement
					try {
						const requestPath = ctx?.request?.url
						if (requestPath?.includes('/two-factor/verify-totp')) {
							const { sessions } = await import('@/lib/db/schema')
							const { eq } = await import('drizzle-orm')

							await db
								.update(sessions)
								.set({ twoFactorVerified: true })
								.where(eq(sessions.token, session.token))

							console.log('[Auth] Set twoFactorVerified=true for session after 2FA verification')
						}
					} catch (err) {
						console.error('[Auth] Failed to update twoFactorVerified:', err)
					}
				},
			},
			create: {
				after: async (session, ctx) => {
					// Record login history and check for suspicious patterns
					try {
						const { loginHistory } = await import('@/lib/db/schema')
						const { getClientIpAddress, getDeviceDescription, parseUserAgent } = await import(
							'@/lib/user-agent'
						)

						// Extract IP and User-Agent from request context
						const headers = ctx?.request?.headers
						const ipAddress = headers ? getClientIpAddress(headers) : null
						const userAgent = headers?.get?.('user-agent') || null

						// Parse user agent to get device description
						const parsed = parseUserAgent(userAgent)
						const device = getDeviceDescription(parsed)

						// Insert login history record
						await db.insert(loginHistory).values({
							userId: session.userId,
							ipAddress,
							userAgent,
							device,
							success: true,
							// Note: country/city geolocation could be added with a service like MaxMind
						})

						// Analyze login patterns against historical data
						// Detection runs AFTER recording this login for complete history analysis
						const { createSecurityAlert, shouldTriggerSuspiciousAlert } = await import(
							'@/features/settings'
						)

						const suspiciousCheck = await shouldTriggerSuspiciousAlert({
							userId: session.userId,
							ipAddress,
							device,
							userAgent,
						})

						if (suspiciousCheck.trigger) {
							// Create suspicious login alert (critical - sends email)
							await createSecurityAlert(session.userId, 'suspicious_login', {
								ipAddress: ipAddress ?? undefined,
								userAgent: userAgent ?? undefined,
								device,
								reasons: suspiciousCheck.result.reasons,
								riskScore: suspiciousCheck.result.riskScore,
							})
							console.log(
								'[Auth] Suspicious login detected:',
								session.userId,
								suspiciousCheck.result.reasons,
							)
						} else {
							// Create normal login alert (non-critical - no email)
							await createSecurityAlert(session.userId, 'new_login', {
								ipAddress: ipAddress ?? undefined,
								userAgent: userAgent ?? undefined,
								device,
							})
						}
					} catch (err) {
						// Don't fail login if history recording fails
						console.error('[Auth] Failed to record login history:', err)
					}
				},
			},
		},
		account: {
			create: {
				after: async (account) => {
					// Create security alert when a new OAuth account is connected
					// Skip for credential provider (password login)
					if (account.providerId === CREDENTIAL_PROVIDER_ID) {
						return
					}

					try {
						const { getOAuthProviderDisplayName } = await import('@/lib/oauth-providers')
						const { createSecurityAlert } = await import('@/features/settings')

						const providerName = getOAuthProviderDisplayName(account.providerId)

						await createSecurityAlert(account.userId, 'oauth_connected', {
							provider: account.providerId,
							providerDisplayName: providerName,
							accountId: account.accountId,
						})

						console.log(
							'[Auth] Created oauth_connected alert for:',
							account.userId,
							account.providerId,
						)
					} catch (err) {
						// Don't fail account creation if alert fails
						console.error('[Auth] Failed to create oauth_connected alert:', err)
					}
				},
			},
		},
		user: {
			create: {
				after: async (user) => {
					// Log new user creation
					console.log('[Auth] New user registered:', user.email)

					// Auto-promote to super_admin if email matches INITIAL_SUPERADMIN_EMAIL
					// This is one-time: only works if no super_admin exists yet
					await tryAutoPromoteSuperAdmin(user.email)

					// Create free subscription (and Stripe customer if configured)
					// Dynamic import to avoid circular dependencies
					try {
						const { createStripeCustomer, isStripeConfigured } = await import(
							'@/features/subscription/lib/stripe'
						)
						const { subscriptions } = await import('@/lib/db/schema')
						const { eq } = await import('drizzle-orm')

						// Check if subscription already exists (race condition protection)
						const existingSub = await db.query.subscriptions.findFirst({
							where: eq(subscriptions.userId, user.id),
						})

						if (!existingSub) {
							// Create Stripe customer only if Stripe is configured
							let stripeCustomerId: string | undefined
							if (isStripeConfigured()) {
								stripeCustomerId = await createStripeCustomer({
									userId: user.id,
									email: user.email,
									name: user.name,
								})
							}

							// Create default free subscription
							// stripeCustomerId is nullable - will be set when user upgrades if not set now
							await db.insert(subscriptions).values({
								userId: user.id,
								stripeCustomerId: stripeCustomerId ?? null,
								plan: 'free',
								status: 'active',
							})

							if (stripeCustomerId) {
								console.log('[Auth] Created Stripe customer and subscription for:', user.email)
							} else {
								console.log('[Auth] Created free subscription (no Stripe) for:', user.email)
							}
						}
					} catch (err) {
						// Don't fail signup if subscription creation fails
						console.error('[Auth] Failed to create subscription:', err)
					}
				},
			},
		},
	},

	emailAndPassword: {
		enabled: true,
		// Always require email verification for security
		requireEmailVerification: true,
		// Password reset configuration
		sendResetPassword: async ({ user, url: _url, token }, _request) => {
			try {
				// Dynamic import to avoid build-time issues
				const { sendPasswordResetEmail } = await import('@/features/notifications/server')
				// Fire and forget - don't block on email delivery
				sendPasswordResetEmail({ email: user.email, token }).catch((err) => {
					console.error('[Auth] Failed to send password reset email:', err)
				})
			} catch (err) {
				console.error('[Auth] Error in sendResetPassword callback:', err)
				// Don't throw - allow request to continue even if email fails
			}
		},
		resetPasswordTokenExpiresIn: 3600, // 1 hour
	},

	emailVerification: {
		sendVerificationEmail: async ({ user, token }) => {
			try {
				// Dynamic import to avoid build-time issues
				const sendEmail = await getSendVerificationEmail()
				// Fire and forget - don't block signup on email delivery
				sendEmail({ email: user.email, token }).catch((err) => {
					console.error('[Auth] Failed to send verification email:', err)
				})
			} catch (err) {
				console.error('[Auth] Error in sendVerificationEmail callback:', err)
				// Don't throw - allow signup to continue even if email fails
			}
		},
		sendOnSignUp: true,
		autoSignInAfterVerification: true,
		expiresIn: 3600, // 1 hour
	},

	socialProviders,

	session: {
		expiresIn: SESSION_CONFIG.EXPIRES_IN,
		updateAge: SESSION_CONFIG.UPDATE_AGE,
		cookieCache: {
			enabled: true,
			maxAge: SESSION_CONFIG.COOKIE_CACHE_MAX_AGE,
		},
	},

	trustedOrigins: [
		getServerBaseUrl(),
		// Support Vercel preview deployments
		process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
	].filter(Boolean),

	// Rate limiting to prevent brute force attacks
	rateLimit: {
		enabled: true,
		window: RATE_LIMIT_CONFIG.window,
		max: RATE_LIMIT_CONFIG.max,
		// Stricter limits for sensitive endpoints
		customRules: {
			'/sign-in/email': {
				window: 900, // 15 minutes
				max: 5, // 5 attempts
			},
			'/sign-up/email': {
				window: 3600, // 1 hour
				max: 3, // 3 signups
			},
			'/forgot-password': {
				window: 3600, // 1 hour
				max: 3, // 3 reset requests
			},
		},
	},
})

export type Session = typeof auth.$Infer.Session
/** User type from better-auth session (distinct from schema User type) */
export type SessionUser = typeof auth.$Infer.Session.user
