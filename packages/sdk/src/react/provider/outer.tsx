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

import type { SylphxProviderProps } from "./types";
import { SylphxProviderInner } from "./inner";


// ============================================
// Provider Component
// ============================================

/**
 * SylphxProvider
 *
 * Wrapper that sets up QueryClientProvider first, then renders the inner provider.
 * This is necessary because the inner provider uses useQuery hooks that require
 * QueryClientProvider context.
 */
export function SylphxProvider({
	children,
	appId,
	platformUrl: providedPlatformUrl,
	afterSignOutUrl = "/",
	vapidPublicKey,
	autoTracking = true,
	config,
	authPrefix = "/auth",
}: SylphxProviderProps) {
	// Create QueryClient at the outer level
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						// SDK default: 5 min stale time, no refetch on window focus
						staleTime: STALE_TIME_STABLE_MS,
						refetchOnWindowFocus: false,
						retry: 1,
					},
				},
			}),
	);

	// Wrap with QueryClientProvider FIRST, then render inner provider
	// ConfigContext wraps everything to provide server-fetched config
	return (
		<ConfigContext.Provider value={config}>
			<QueryClientProvider client={queryClient}>
				<SylphxProviderInner
					appId={appId}
					platformUrl={providedPlatformUrl}
					afterSignOutUrl={afterSignOutUrl}
					vapidPublicKey={vapidPublicKey}
					autoTracking={autoTracking}
					queryClient={queryClient}
					config={config}
					authPrefix={authPrefix}
				>
					{children}
				</SylphxProviderInner>
			</QueryClientProvider>
		</ConfigContext.Provider>
	);
}
