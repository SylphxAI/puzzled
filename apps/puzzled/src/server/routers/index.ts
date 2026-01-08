/**
 * Root tRPC Router
 *
 * Combines all routers into a single app router.
 * Export type for client-side type inference.
 */

import { router } from '../trpc'
import { accountRouter } from './account'
import { adminRouter } from './admin'
import { billingRouter } from './billing'
import { challengeRouter } from './challenge'
import { emailRouter } from './email'
import { gamesRouter } from './games'
import { gamificationRouter } from './gamification'
import { referralsRouter } from './referrals'
import { securityRouter } from './security'
import { settingsRouter } from './settings'
import { statsRouter } from './stats'
import { twoFactorRouter } from './two-factor'
import { userRouter } from './user'

/**
 * Main app router - combines all feature routers
 */
export const appRouter = router({
	account: accountRouter,
	admin: adminRouter,
	billing: billingRouter,
	challenge: challengeRouter,
	email: emailRouter,
	games: gamesRouter,
	stats: statsRouter,
	gamification: gamificationRouter,
	referrals: referralsRouter,
	security: securityRouter,
	settings: settingsRouter,
	twoFactor: twoFactorRouter,
	user: userRouter,
})

/**
 * Type definition for the app router
 * Used for client-side type inference
 */
export type AppRouter = typeof appRouter
