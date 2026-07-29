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
// useInbox (In-App Messages / Notification Center)
// ============================================

export interface UseInboxReturn {
	/** List of in-app messages */
	messages: InAppMessage[];
	/** Number of unread messages */
	unreadCount: number;
	/** Whether inbox is loading */
	isLoading: boolean;
	/** Error loading inbox */
	error: Error | null;
	/** Whether there was an error */
	isError: boolean;
	/** User preferences for inbox */
	preferences: InboxPreferences | null;
	/** Mark a specific message as read */
	markAsRead: (messageId: string) => Promise<void>;
	/** Mark all messages as read */
	markAllAsRead: () => Promise<void>;
	/** Dismiss a message (user closed it) */
	dismiss: (messageId: string) => Promise<void>;
	/** Record that user clicked an action button */
	recordClick: (
		messageId: string,
		action: "primary" | "secondary",
	) => Promise<void>;
	/** Update inbox preferences */
	updatePreferences: (prefs: Partial<InboxPreferences>) => Promise<void>;
	/** Refresh the inbox data */
	refresh: () => Promise<void>;
	/** Get messages filtered by topic */
	getByTopic: (topic: string) => InAppMessage[];
	/** Get messages filtered by type */
	getByType: (type: InAppMessageType) => InAppMessage[];
	/** Get unread messages only */
	unreadMessages: InAppMessage[];
}

/**
 * Hook for in-app messages / notification center
 *
 * @example Basic usage
 * ```tsx
 * function NotificationBell() {
 *   const { unreadCount, messages, markAsRead } = useInbox()
 *
 *   return (
 *     <div>
 *       <Bell />
 *       {unreadCount > 0 && <Badge>{unreadCount}</Badge>}
 *       <Dropdown>
 *         {messages.map(msg => (
 *           <NotificationItem
 *             key={msg.id}
 *             message={msg}
 *             onClick={() => markAsRead(msg.id)}
 *           />
 *         ))}
 *       </Dropdown>
 *     </div>
 *   )
 * }
 * ```
 *
 * @example With action buttons
 * ```tsx
 * function NotificationCard({ message }: { message: InAppMessage }) {
 *   const { recordClick, dismiss } = useInbox()
 *
 *   const handleAction = async () => {
 *     await recordClick(message.id, 'primary')
 *     if (message.actionUrl) {
 *       window.open(message.actionUrl, '_blank')
 *     }
 *   }
 *
 *   return (
 *     <Card>
 *       <h3>{message.title}</h3>
 *       <p>{message.body}</p>
 *       {message.actionText && (
 *         <Button onClick={handleAction}>{message.actionText}</Button>
 *       )}
 *       <CloseButton onClick={() => dismiss(message.id)} />
 *     </Card>
 *   )
 * }
 * ```
 *
 * @example Filtering by topic
 * ```tsx
 * function SystemAlerts() {
 *   const { getByType } = useInbox()
 *   const alerts = getByType('warning').concat(getByType('error'))
 *
 *   return (
 *     <AlertBanner>
 *       {alerts.map(alert => (
 *         <Alert key={alert.id} severity={alert.type}>
 *           {alert.title}
 *         </Alert>
 *       ))}
 *     </AlertBanner>
 *   )
 * }
 * ```
 */
export function useInbox(): UseInboxReturn {
	const ctx = usePlatformContext();

	const getByTopic = useCallback(
		(topic: string): InAppMessage[] => {
			return ctx.inboxMessages.filter((m) => m.topic === topic);
		},
		[ctx.inboxMessages],
	);

	const getByType = useCallback(
		(type: InAppMessageType): InAppMessage[] => {
			return ctx.inboxMessages.filter((m) => m.type === type);
		},
		[ctx.inboxMessages],
	);

	const unreadMessages = ctx.inboxMessages.filter(
		(m) => !m.isRead && !m.isDismissed,
	);

	return {
		messages: ctx.inboxMessages,
		unreadCount: ctx.inboxUnreadCount,
		isLoading: ctx.inboxLoading,
		error: ctx.inboxError,
		isError: ctx.inboxError !== null,
		preferences: ctx.inboxPreferences,
		markAsRead: ctx.markInboxMessageAsRead,
		markAllAsRead: ctx.markAllInboxMessagesAsRead,
		dismiss: ctx.dismissInboxMessage,
		recordClick: ctx.recordInboxMessageClick,
		updatePreferences: ctx.updateInboxPreferences,
		refresh: ctx.refreshInbox,
		getByTopic,
		getByType,
		unreadMessages,
	};
}
