/**
 * Sylphx Server SDK
 *
 * Server-side operations using REST API for type safety.
 * Uses Secret Key for authentication - NEVER expose this to client-side.
 *
 * @example
 * ```typescript
 * import { createServerClient, verifyWebhook } from '@sylphx/sdk/server'
 *
 * const client = createServerClient({
 *   secretKey: process.env.SYLPHX_SECRET_KEY!,
 * })
 *
 * // REST API calls
 * const { data: plans } = await client.GET('/billing/plans')
 * const { data: user } = await client.GET('/user/profile')
 * ```
 */

// Re-export key validation utilities from SSOT
export {
	// Environment detection
	detectEnvironment,
	// Key type detection
	detectKeyType,
	// Types
	type EnvironmentType,
	// Cookie namespace
	getCookieNamespace,
	isAppId,
	isDevelopmentKey,
	// Runtime detection
	isDevelopmentRuntime,
	isProductionKey,
	isSecretKey,
	type KeyType,
	type KeyValidationResult,
	validateAndSanitizeAppId,
	validateAndSanitizeKey,
	validateAndSanitizeSecretKey,
	// App ID validation
	validateAppId,
	// Generic key validation (auto-detects type)
	validateKey,
	// Secret key validation
	validateSecretKey,
} from '../key-validation'

// AI Client
export {
	type AIClient,
	type AIClientOptions,
	type ChatCompletionChunk,
	type ChatCompletionOptions,
	type ChatCompletionResponse,
	type ChatCompletionStreamOptions,
	type ChatMessage,
	createAI,
	type EmbeddingOptions,
	type EmbeddingResponse,
	getAI,
	type ModelInfo,
	type ModelsResponse,
} from './ai'
// Server Client Configuration & Factories
export {
	createAuthenticatedServerClient,
	createServerClient,
	type RestClient,
	type ServerClientConfig,
	type ServerConfig,
} from './config'
// Server-Side Data Fetching — Config & Platform Data
export {
	type AppConfig,
	type AppMetadata,
	type ConsentType,
	type DatabaseConnectionInfo,
	type DatabaseStatusInfo,
	type EngagementLeaderboardEntry,
	type EngagementLeaderboardResult,
	type FeatureFlagDefinition,
	type GetAppConfigOptions,
	getAppConfig,
	getAppMetadata,
	getConsentTypes,
	getDatabaseConnection,
	getDatabaseStatus,
	getEngagementLeaderboard,
	getFeatureFlags,
	getOAuthProviders,
	getOAuthProvidersWithInfo,
	getPlans,
	getReferralLeaderboard,
	type OAuthProvider,
	type OAuthProviderInfo,
	type Plan,
	type ReferralLeaderboardEntry,
	type ReferralLeaderboardResult,
} from './data'
// JWT / JWKS Verification
export { getJwks, verifyAccessToken } from './jwt'
// KV (Key-Value Store)
export {
	createKv,
	getKv,
	type KvClient,
	type KvClientOptions,
	type KvRateLimitResult,
	type KvSetOptions,
	type KvZMember,
} from './kv'
// Streams (Real-time Pub/Sub)
export {
	type ChannelHelper,
	createStreams,
	getStreams,
	type StreamHistoryOptions,
	type StreamMessage,
	type StreamsClient,
	type StreamsClientOptions,
} from './streams'
// Webhook Signature Verification
export {
	createWebhookHandler,
	verifyWebhook,
	type WebhookPayload,
	type WebhookVerifyOptions,
	type WebhookVerifyResult,
} from './webhooks'
