/**
 * Root tRPC Router
 *
 * Combines all routers into a single app router.
 * Export type for client-side type inference.
 */

import { router } from '../trpc'
import { adminRouter } from './admin'
import { gamesRouter } from './games'
import { gamificationRouter } from './gamification'
import { notificationsRouter } from './notifications'
import { statsRouter } from './stats'
import { userRouter } from './user'

/**
 * Main app router - combines all feature routers
 *
 * PLATFORM SDK HANDLES:
 * - Auth, billing, security, 2FA, email changes
 * - Referrals (via useReferral hook)
 * - Push subscriptions (via usePush hook)
 * - Analytics (via useAnalytics hook)
 *
 * APP HANDLES:
 * - Notification preferences (which types of notifications to receive)
 */
export const appRouter = router({
	admin: adminRouter,
	games: gamesRouter,
	stats: statsRouter,
	gamification: gamificationRouter,
	notifications: notificationsRouter,
	user: userRouter,
})

/**
 * Type definition for the app router
 * Used for client-side type inference
 */
export type AppRouter = typeof appRouter
