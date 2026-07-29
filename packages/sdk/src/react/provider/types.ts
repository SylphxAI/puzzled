/** SylphxProvider public props. */
import {
	QueryClient,
	QueryClientProvider,
	useQuery,
} from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { linkAnonymousConsents } from "../consent";
import {
	ANALYTICS_FLUSH_TIMEOUT_MS,
	ANALYTICS_INTERVAL_CHECK_MS,
	ANALYTICS_MAX_TRACKED_EVENT_IDS,
	ANALYTICS_QUEUE_LIMIT,
	ANALYTICS_TRACKED_IDS_KEEP,
	DEFAULT_AUTH_PREFIX,
	DEFAULT_CONTEXT_WINDOW,
	DEFAULT_PLATFORM_URL,
	NEW_USER_THRESHOLD_MS,
	SDK_API_PATH,
	SESSION_TOKEN_LIFETIME_MS,
	STALE_TIME_FREQUENT_MS,
	STALE_TIME_MODERATE_MS,
	STALE_TIME_STABLE_MS,
	STORAGE_MULTIPART_THRESHOLD_BYTES,
} from "../constants";
import { validateAndSanitizeAppId } from "../key-validation";
import type {
	AchievementDefaults,
	AchievementUnlockEvent,
	LeaderboardDefaults,
	LeaderboardQueryOptions,
	LeaderboardResult,
	RecordActivityResult,
	StreakDefaults,
	StreakState,
	SubmitScoreResult,
	UserAchievement,
} from "../lib/engagement/types";
import type { AIProvider, AppConfig, TokenResponse, User } from "../types";
import { AuthContext, type AuthState } from "./context";
import { inferProviderFromModelId } from "./context-values";
import { ConfigContext } from "./hooks/use-config";
import {
	type InAppMessageWithReadStatus,
	type InboxPreferences,
	type MobilePushConfig,
	type MobilePushPlatform,
	type MobilePushPreferences,
	type Plan,
	PlatformContext,
	type PushPreferences,
	type ReferralStats,
	type Subscription,
} from "./platform-context";
import { type RestApiClient, createRestApi } from "./rest-client";
import { isValidRedirectUrl, safeRedirect } from "./security-utils";
import {
	AIContext,
	type AIContextValue,
	ConsentContext,
	type ConsentContextValue,
	DatabaseContext,
	type DatabaseContextValue,
	EmailContext,
	type EmailContextValue,
	JobsContext,
	type JobsContextValue,
	MonitoringContext,
	type MonitoringContextValue,
	NewsletterContext,
	type NewsletterContextValue,
	SdkAuthContext,
	type SdkAuthContextValue,
	SecurityContext,
	type SecurityContextValue,
	StorageContext,
	type StorageContextValue,
	type UploadOptions,
	type UploadProgressEvent,
	UserContext,
	type UserContextValue,
	WebhooksContext,
	type WebhooksContextValue,
} from "./services-context";
import {
	type ClickIds,
	STORAGE_KEYS,
	SylphxStorage,
	autoCaptureClickIds,
	clearUserCookie,
	getOrCreateAnonymousId,
	getPrimaryClickId,
	getStoredClickIds,
	getUserFromCookie,
} from "./storage-utils";
import { TokenManager } from "./token-manager";


// TokenManager extracted to ./token-manager.ts for maintainability
// REST API Client extracted to ./rest-client.ts for maintainability
// Service context value factories extracted to ./context-values/ for maintainability

// Storage upload is now handled via presigned URLs in context-values/storage.ts

// ============================================
// Types
// ============================================

export interface SylphxProviderProps {
	children: React.ReactNode;
	/**
	 * Your app's ID (environment-specific identifier)
	 * Format: app_dev_xxx, app_stg_xxx, or app_prod_xxx
	 * Get this from Platform Admin → Apps → Your App → Environments
	 *
	 * The App ID IS the app identity — no separate key needed.
	 */
	appId?: string;
	/** Platform URL (default: https://sylphx.com) */
	platformUrl?: string;
	/** After sign out, redirect to this URL */
	afterSignOutUrl?: string;
	/** VAPID public key for push notifications (get from platform) */
	vapidPublicKey?: string;
	/**
	 * Auto-tracking configuration
	 * - true: enable all auto-tracking (default)
	 * - false: disable all auto-tracking
	 * - object: fine-grained control
	 */
	autoTracking?:
		| boolean
		| {
				pageview?: boolean;
				login?: boolean;
				signup?: boolean;
				logout?: boolean;
				purchase?: boolean;
		  };
	/**
	 * App configuration fetched server-side via getAppConfig()
	 *
	 * **Required:** Use `getAppConfig()` from '@sylphx/sdk/server' in Server Components
	 * to fetch all config data and pass it here.
	 *
	 * @example
	 * ```tsx
	 * // layout.tsx (Server Component)
	 * import { getAppConfig } from '@sylphx/sdk/server'
	 *
	 * export default async function RootLayout({ children }) {
	 *   const config = await getAppConfig({
	 *     secretKey: process.env.SYLPHX_SECRET_KEY!,
	 *     appId: process.env.NEXT_PUBLIC_SYLPHX_APP_ID!,
	 *   })
	 *
	 *   return (
	 *     <SylphxProvider config={config} appId={...}>
	 *       {children}
	 *     </SylphxProvider>
	 *   )
	 * }
	 * ```
	 */
	config: AppConfig;
	/**
	 * Auth route prefix. Must match the `authPrefix` in your middleware config.
	 * Default: '/auth' (matches middleware default)
	 *
	 * This determines where OAuth callbacks are routed:
	 * - '/auth' → callback at /auth/callback
	 * - '/api/auth' → callback at /api/auth/callback
	 */
	authPrefix?: string;
}
