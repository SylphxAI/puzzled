/**
 * Sylphx SDK - Function-Based API
 *
 * State-of-the-art SDK design with natural tree-shaking.
 * Import only what you use - the bundler handles the rest.
 *
 * @example
 * ```typescript
 * import { createConfig, signIn, track, chat } from '@sylphx/platform-sdk/functions'
 *
 * const config = createConfig({
 *   appId: 'my-app',
 *   appSecret: process.env.SYLPHX_SECRET!,
 * })
 *
 * // Auth
 * const result = await signIn(config, { email, password })
 *
 * // Analytics
 * track(config, 'purchase', { amount: 99 })
 *
 * // AI
 * const response = await chat(config, {
 *   model: 'gpt-4o',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * })
 * ```
 */

// Config
export { createConfig, type SylphxConfig } from './config'

// Auth Functions
export {
	signIn,
	signUp,
	signOut,
	refreshToken,
	verifyEmail,
	forgotPassword,
	resetPassword,
	getSession,
	type SignInInput,
	type SignInResult,
	type SignUpInput,
	type SignUpResult,
} from './auth'

// Analytics Functions
export {
	track,
	page,
	identify,
	trackBatch,
	type TrackInput,
	type PageInput,
	type IdentifyInput,
} from './analytics'

// AI Functions
export {
	chat,
	chatStream,
	embed,
	type ChatInput,
	type ChatResult,
	type ChatStreamChunk,
	type EmbedInput,
	type EmbedResult,
} from './ai'

// Billing Functions
export {
	getPlans,
	getSubscription,
	createCheckout,
	createPortalSession,
	type Plan,
	type Subscription,
} from './billing'

// Storage Functions
export {
	uploadFile,
	deleteFile,
	getFileUrl,
	type UploadOptions,
	type UploadResult,
} from './storage'

// Notifications Functions
export {
	registerPush,
	unregisterPush,
	sendPush,
	type PushSubscription,
} from './notifications'

// Jobs Functions
export {
	scheduleJob,
	getJob,
	cancelJob,
	createCron,
	type JobInput,
	type JobResult,
} from './jobs'

// Feature Flags Functions
export {
	checkFlag,
	getFlags,
	type FlagResult,
} from './flags'
