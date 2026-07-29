/**
 * Platform Hooks
 *
 * Hooks for billing, analytics, notifications, and referrals.
 */

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useContext } from "react";
import { STALE_TIME_FREQUENT_MS } from "../constants";
import {
	type AnalyticsQuery,
	type AnalyticsQueryResult,
	type ClickIds,
	type ConversionData,
	type DestinationPlatform,
	type InAppMessagePriority,
	type InAppMessageType,
	type InAppMessageWithReadStatus,
	type InboxPreferences,
	type Plan,
	PlatformContext,
	type PushPreferences,
	type RedeemResult,
	type ReferralRewardDefaults,
	type ReferralStats,
	type Subscription,
	type TrackOptions,
} from "./platform-context";
import { usePlatformContext } from "./types";

// ============================================
// useNotifications
// ============================================

export interface UseNotificationsReturn {
	/** Whether push notifications are supported in this browser */
	isSupported: boolean;
	/** Whether user is subscribed to push */
	isSubscribed: boolean;
	/** User's notification preferences */
	preferences: PushPreferences | null;
	/** Error from notification operations */
	error: Error | null;
	/** Whether there was an error */
	isError: boolean;
	/** Subscribe to notifications */
	subscribe: () => Promise<boolean>;
	/** Unsubscribe from notifications */
	unsubscribe: () => Promise<void>;
	/** Update notification preferences */
	updatePreferences: (prefs: Partial<PushPreferences>) => Promise<void>;
}

/**
 * Hook for notification management
 *
 * @example
 * ```tsx
 * function NotificationSettings() {
 *   const { isSupported, isSubscribed, subscribe, unsubscribe, preferences } = useNotifications()
 *
 *   if (!isSupported) {
 *     return <div>Notifications not supported</div>
 *   }
 *
 *   return (
 *     <button onClick={isSubscribed ? unsubscribe : subscribe}>
 *       {isSubscribed ? 'Disable' : 'Enable'} Notifications
 *     </button>
 *   )
 * }
 * ```
 */
export function useNotifications(): UseNotificationsReturn {
	const ctx = usePlatformContext();

	return {
		isSupported: ctx.pushSupported,
		isSubscribed: ctx.pushSubscribed,
		preferences: ctx.pushPreferences,
		error: ctx.pushError,
		isError: ctx.pushError !== null,
		subscribe: ctx.subscribePush,
		unsubscribe: ctx.unsubscribePush,
		updatePreferences: ctx.updatePushPreferences,
	};
}

// ============================================
// useMobilePush
// ============================================

export interface MobileDevice {
	id: string;
	platform: "ios" | "android" | "web";
	name: string | null;
	registeredAt: string;
	lastUsedAt: string | null | undefined;
}

export interface UseMobilePushReturn {
	/** Whether iOS push is configured for this app */
	iosConfigured: boolean;
	/** Whether Android push is configured for this app */
	androidConfigured: boolean;
	/** Whether any mobile push is configured */
	isConfigured: boolean;
	/** List of registered devices for current user */
	devices: MobileDevice[];
	/** Whether mobile push is enabled (has registered devices) */
	isEnabled: boolean;
	/** Error from mobile push operations */
	error: Error | null;
	/** Whether there was an error */
	isError: boolean;
	/**
	 * Register a mobile device for push notifications
	 *
	 * Call this after obtaining a device token from APNs (iOS) or FCM (Android).
	 *
	 * @example iOS with react-native-push-notification
	 * ```tsx
	 * import PushNotification from 'react-native-push-notification'
	 *
	 * PushNotification.configure({
	 *   onRegister: async (token) => {
	 *     await registerDevice({
	 *       platform: 'ios',
	 *       token: token.token,
	 *       deviceName: DeviceInfo.getDeviceId(),
	 *       appVersion: DeviceInfo.getVersion(),
	 *       osVersion: DeviceInfo.getSystemVersion(),
	 *     })
	 *   },
	 * })
	 * ```
	 *
	 * @example Android with firebase messaging
	 * ```tsx
	 * import messaging from '@react-native-firebase/messaging'
	 *
	 * const token = await messaging().getToken()
	 * await registerDevice({
	 *   platform: 'android',
	 *   token,
	 *   deviceName: DeviceInfo.getDeviceId(),
	 *   appVersion: DeviceInfo.getVersion(),
	 *   osVersion: DeviceInfo.getSystemVersion(),
	 * })
	 * ```
	 */
	registerDevice: (options: {
		platform: "ios" | "android";
		token: string;
		deviceId?: string;
		deviceName?: string;
		appVersion?: string;
		osVersion?: string;
	}) => Promise<{ success: boolean; tokenId: string }>;
	/**
	 * Unregister a mobile device
	 *
	 * Call this when the user logs out or disables notifications.
	 */
	unregisterDevice: (token: string) => Promise<void>;
	/** Refresh device list */
	refresh: () => Promise<void>;
}

/**
 * Hook for mobile push notification management (iOS/Android)
 *
 * Use this hook in React Native apps to register device tokens and manage
 * push notification settings.
 *
 * @example
 * ```tsx
 * function PushNotificationSetup() {
 *   const { isConfigured, registerDevice, devices } = useMobilePush()
 *
 *   useEffect(() => {
 *     if (!isConfigured) return
 *
 *     // Get device token from native push service
 *     messaging().getToken().then(token => {
 *       registerDevice({
 *         platform: Platform.OS === 'ios' ? 'ios' : 'android',
 *         token,
 *       })
 *     })
 *
 *     // Listen for token refresh
 *     return messaging().onTokenRefresh(token => {
 *       registerDevice({
 *         platform: Platform.OS === 'ios' ? 'ios' : 'android',
 *         token,
 *       })
 *     })
 *   }, [isConfigured])
 *
 *   return (
 *     <View>
 *       <Text>Registered devices: {devices.length}</Text>
 *     </View>
 *   )
 * }
 * ```
 */
export function useMobilePush(): UseMobilePushReturn {
	const ctx = usePlatformContext();

	const config = ctx.mobilePushConfig;
	const prefs = ctx.mobilePushPreferences;

	// Wrap refresh to return void (the data is already in context)
	const refresh = useCallback(async (): Promise<void> => {
		await ctx.getMobilePushPreferences();
	}, [ctx]);

	return {
		iosConfigured: config?.ios ?? false,
		androidConfigured: config?.android ?? false,
		isConfigured: config?.anyConfigured ?? false,
		devices: prefs?.devices ?? [],
		isEnabled: prefs?.enabled ?? false,
		error: ctx.mobilePushError,
		isError: ctx.mobilePushError !== null,
		registerDevice: ctx.registerMobileDevice,
		unregisterDevice: ctx.unregisterMobileDevice,
		refresh,
	};
}

