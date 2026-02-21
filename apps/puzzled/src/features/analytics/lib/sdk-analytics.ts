/**
 * SDK-Integrated Analytics
 *
 * Uses the Sylphx Platform SDK's analytics service for
 * event tracking, deduplication, and billing.
 *
 * Features:
 * - Event batching (send every 5s or when batch reaches 10 events)
 * - Rich event dimensions (device, session, journey stage)
 * - Exponential backoff retry logic
 * - Offline support with IndexedDB queue
 * - GDPR-compliant consent checks
 * - Page unload handling
 */

"use client";

import type { PuzzleDifficulty } from "@/games/types";
import { useAnalytics } from "@sylphx/sdk/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { canTrackAnalytics } from "./consent";

// ==========================================
// Constants
// ==========================================

import {
	ANALYTICS_OFFLINE_QUEUE_KEY,
	SESSION_ID_KEY,
	SESSION_START_KEY,
} from "@/lib/storage-keys";

const BATCH_SIZE = 10;
const BATCH_INTERVAL_MS = 5000;
const MAX_RETRIES = 5;
const BASE_RETRY_DELAY_MS = 1000;

// ==========================================
// Types
// ==========================================

export interface GameStartEvent {
	game: string;
	mode: "daily" | "archive" | "practice";
	difficulty?: PuzzleDifficulty;
	puzzleId?: string;
}

export interface GameCompleteEvent {
	game: string;
	status: "won" | "lost";
	attempts: number;
	timeSpentMs: number;
	score?: number;
	mode: "daily" | "archive" | "practice";
	difficulty?: PuzzleDifficulty;
	puzzleId?: string;
}

export interface AchievementEvent {
	achievementId: string;
	achievementName: string;
	category: string;
	points: number;
}

export interface StreakEvent {
	streakType: "daily" | "weekly";
	streakCount: number;
	isNewRecord: boolean;
}

type UserJourneyStage = "new" | "returning" | "premium";

type DeviceType = "mobile" | "tablet" | "desktop";

interface EventDimensions {
	device_type: DeviceType;
	session_id: string;
	session_duration_ms: number;
	journey_stage: UserJourneyStage;
	time_to_first_interaction_ms: number | null;
	is_online: boolean;
	viewport_width: number;
	viewport_height: number;
}

interface QueuedEvent {
	eventName: string;
	properties: Record<string, unknown>;
	timestamp: string;
	retryCount: number;
}

// ==========================================
// Device Detection
// ==========================================

function getDeviceType(): DeviceType {
	if (typeof window === "undefined") return "desktop";

	const userAgent = navigator.userAgent.toLowerCase();
	const screenWidth = window.innerWidth;

	// Check for tablet first (both UA and screen size)
	const isTabletUA =
		/ipad|android(?!.*mobile)|tablet/i.test(userAgent) ||
		(navigator.maxTouchPoints > 0 && screenWidth >= 768 && screenWidth < 1024);

	if (isTabletUA) return "tablet";

	// Check for mobile
	const isMobileUA =
		/mobile|iphone|ipod|android.*mobile|blackberry|opera mini|iemobile/i.test(
			userAgent,
		);
	if (isMobileUA || screenWidth < 768) return "mobile";

	return "desktop";
}

// ==========================================
// Session Management
// ==========================================

function generateSessionId(): string {
	return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function getOrCreateSessionId(): string {
	if (typeof window === "undefined") return generateSessionId();

	let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
	if (!sessionId) {
		sessionId = generateSessionId();
		sessionStorage.setItem(SESSION_ID_KEY, sessionId);
		sessionStorage.setItem(SESSION_START_KEY, Date.now().toString());
	}
	return sessionId;
}

function getSessionDurationMs(): number {
	if (typeof window === "undefined") return 0;

	const startTime = sessionStorage.getItem(SESSION_START_KEY);
	if (!startTime) return 0;

	return Date.now() - Number.parseInt(startTime, 10);
}

// ==========================================
// Offline Queue (IndexedDB)
// ==========================================

const DB_NAME = "puzzled-analytics";
const STORE_NAME = "offline-events";
const DB_VERSION = 1;

async function openDB(): Promise<IDBDatabase | null> {
	if (typeof indexedDB === "undefined") return null;

	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, {
					keyPath: "id",
					autoIncrement: true,
				});
			}
		};
	});
}

async function saveToOfflineQueue(events: QueuedEvent[]): Promise<void> {
	try {
		const db = await openDB();
		if (!db) {
			// Fallback to localStorage if IndexedDB unavailable
			const existing = localStorage.getItem(ANALYTICS_OFFLINE_QUEUE_KEY);
			const queue: QueuedEvent[] = existing ? JSON.parse(existing) : [];
			queue.push(...events);
			// Limit to 1000 events
			localStorage.setItem(
				ANALYTICS_OFFLINE_QUEUE_KEY,
				JSON.stringify(queue.slice(-1000)),
			);
			return;
		}

		const tx = db.transaction(STORE_NAME, "readwrite");
		const store = tx.objectStore(STORE_NAME);

		for (const event of events) {
			store.add(event);
		}

		await new Promise<void>((resolve, reject) => {
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});

		db.close();
	} catch {
		// Silently fail - analytics shouldn't break the app
	}
}

async function getOfflineQueue(): Promise<QueuedEvent[]> {
	try {
		const db = await openDB();
		if (!db) {
			// Fallback to localStorage
			const existing = localStorage.getItem(ANALYTICS_OFFLINE_QUEUE_KEY);
			return existing ? JSON.parse(existing) : [];
		}

		const tx = db.transaction(STORE_NAME, "readonly");
		const store = tx.objectStore(STORE_NAME);

		return new Promise((resolve, reject) => {
			const request = store.getAll();
			request.onsuccess = () => resolve(request.result || []);
			request.onerror = () => reject(request.error);
		});
	} catch {
		return [];
	}
}

async function clearOfflineQueue(): Promise<void> {
	try {
		const db = await openDB();
		if (!db) {
			localStorage.removeItem(ANALYTICS_OFFLINE_QUEUE_KEY);
			return;
		}

		const tx = db.transaction(STORE_NAME, "readwrite");
		const store = tx.objectStore(STORE_NAME);
		store.clear();

		await new Promise<void>((resolve, reject) => {
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});

		db.close();
	} catch {
		// Silently fail
	}
}

// ==========================================
// Event Dimensions Enrichment
// ==========================================

let firstInteractionTime: number | null = null;

function recordFirstInteraction(): void {
	if (firstInteractionTime === null && typeof window !== "undefined") {
		firstInteractionTime = performance.now();
	}
}

function setupFirstInteractionTracking(): void {
	if (typeof window === "undefined") return;

	const events = ["click", "keydown", "touchstart", "scroll"];
	const handler = () => {
		recordFirstInteraction();
		// Remove listeners after first interaction
		for (const event of events) {
			window.removeEventListener(event, handler, { capture: true });
		}
	};

	for (const event of events) {
		window.addEventListener(event, handler, { capture: true, once: true });
	}
}

function getEventDimensions(journeyStage: UserJourneyStage): EventDimensions {
	return {
		device_type: getDeviceType(),
		session_id: getOrCreateSessionId(),
		session_duration_ms: getSessionDurationMs(),
		journey_stage: journeyStage,
		time_to_first_interaction_ms: firstInteractionTime,
		is_online: typeof navigator !== "undefined" ? navigator.onLine : true,
		viewport_width: typeof window !== "undefined" ? window.innerWidth : 0,
		viewport_height: typeof window !== "undefined" ? window.innerHeight : 0,
	};
}

// ==========================================
// Retry Logic with Exponential Backoff
// ==========================================

function calculateRetryDelay(retryCount: number): number {
	// Exponential backoff: 1s, 2s, 4s, 8s, 16s (capped)
	const delay = Math.min(BASE_RETRY_DELAY_MS * 2 ** retryCount, 30000);
	// Add jitter (0-25% of delay)
	const jitter = delay * 0.25 * Math.random();
	return delay + jitter;
}

// ==========================================
// Analytics Queue Manager
// ==========================================

interface QueueManager {
	enqueue: (eventName: string, properties: Record<string, unknown>) => void;
	flush: () => Promise<void>;
	destroy: () => void;
}

function createQueueManager(
	trackFn: (
		event: string,
		properties?: Record<string, unknown>,
	) => Promise<void>,
	journeyStage: UserJourneyStage,
): QueueManager {
	const queue: QueuedEvent[] = [];
	let flushTimeout: ReturnType<typeof setTimeout> | null = null;
	let isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
	let isDestroyed = false;
	let isFlushing = false;

	const scheduleFlush = () => {
		if (flushTimeout) clearTimeout(flushTimeout);
		flushTimeout = setTimeout(() => {
			void flush();
		}, BATCH_INTERVAL_MS);
	};

	const flush = async () => {
		if (queue.length === 0 || isDestroyed || isFlushing) return;

		// Check consent before sending
		if (!canTrackAnalytics()) {
			queue.length = 0;
			return;
		}

		isFlushing = true;
		const eventsToSend = queue.splice(0, queue.length);

		if (!isOnline) {
			// Save to offline queue
			await saveToOfflineQueue(eventsToSend);
			isFlushing = false;
			return;
		}

		const failedEvents: QueuedEvent[] = [];

		// Track each event with retry logic
		for (const event of eventsToSend) {
			try {
				await trackFn(event.eventName, event.properties);
			} catch {
				// Collect failed events for retry
				if (event.retryCount < MAX_RETRIES) {
					failedEvents.push({ ...event, retryCount: event.retryCount + 1 });
				} else {
					// Exceeded max retries - save to offline queue
					await saveToOfflineQueue([event]);
				}
			}
		}

		isFlushing = false;

		// Schedule retry for failed events
		if (failedEvents.length > 0) {
			const retryDelay = calculateRetryDelay(failedEvents[0].retryCount);
			setTimeout(() => {
				for (const event of failedEvents) {
					queue.push(event);
				}
				void flush();
			}, retryDelay);
		}
	};

	const enqueue = (eventName: string, properties: Record<string, unknown>) => {
		if (isDestroyed) return;

		// Check consent before queueing
		if (!canTrackAnalytics()) return;

		const dimensions = getEventDimensions(journeyStage);
		const enrichedProperties = {
			...properties,
			...dimensions,
		};

		queue.push({
			eventName,
			properties: enrichedProperties,
			timestamp: new Date().toISOString(),
			retryCount: 0,
		});

		if (queue.length >= BATCH_SIZE) {
			void flush();
		} else {
			scheduleFlush();
		}
	};

	// Handle online/offline state changes
	const handleOnline = async () => {
		isOnline = true;
		// Try to send offline queue
		const offlineEvents = await getOfflineQueue();
		if (offlineEvents.length > 0) {
			await clearOfflineQueue();
			for (const event of offlineEvents) {
				queue.push({ ...event, retryCount: 0 });
			}
			void flush();
		}
	};

	const handleOffline = () => {
		isOnline = false;
	};

	// Handle page unload - use sendBeacon if available
	const handleUnload = () => {
		if (queue.length > 0 && canTrackAnalytics()) {
			// Best effort flush on unload
			void flush();
		}
	};

	const handleVisibilityChange = () => {
		if (document.visibilityState === "hidden") {
			void flush();
		}
	};

	// Setup event listeners
	if (typeof window !== "undefined") {
		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);
		window.addEventListener("beforeunload", handleUnload);
		document.addEventListener("visibilitychange", handleVisibilityChange);
	}

	const destroy = () => {
		isDestroyed = true;
		if (flushTimeout) clearTimeout(flushTimeout);

		if (typeof window !== "undefined") {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
			window.removeEventListener("beforeunload", handleUnload);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		}

		// Final flush attempt
		if (queue.length > 0) {
			void flush();
		}
	};

	return { enqueue, flush, destroy };
}

// ==========================================
// Hook
// ==========================================

interface UseGameAnalyticsOptions {
	/** User journey stage for analytics segmentation */
	journeyStage?: UserJourneyStage;
}

/**
 * Hook for SDK-integrated game analytics with batching and offline support
 *
 * Features:
 * - Event batching (sends every 5s or when 10 events queued)
 * - Rich dimensions (device type, session, journey stage)
 * - Exponential backoff retry on failures
 * - Offline queue with sync when back online
 * - GDPR-compliant consent checks
 *
 * Usage:
 * ```tsx
 * const { trackGameStart, trackGameComplete, trackAchievement } = useGameAnalytics({
 *   journeyStage: user?.isPremium ? 'premium' : user ? 'returning' : 'new'
 * })
 *
 * // When game starts
 * trackGameStart({ game: 'word-guess', mode: 'daily' })
 *
 * // When game ends
 * trackGameComplete({ game: 'word-guess', status: 'won', attempts: 3, timeSpentMs: 45000, score: 150 })
 * ```
 */
export function useGameAnalytics(options: UseGameAnalyticsOptions = {}) {
	const { journeyStage = "new" } = options;
	const { track, error: analyticsError } = useAnalytics();

	const queueManagerRef = useRef<QueueManager | null>(null);

	// Initialize queue manager and first interaction tracking
	useEffect(() => {
		setupFirstInteractionTracking();

		queueManagerRef.current = createQueueManager(track, journeyStage);

		// Check for offline events on mount
		void (async () => {
			if (typeof navigator !== "undefined" && navigator.onLine) {
				const offlineEvents = await getOfflineQueue();
				if (offlineEvents.length > 0 && queueManagerRef.current) {
					await clearOfflineQueue();
					for (const event of offlineEvents) {
						queueManagerRef.current.enqueue(event.eventName, event.properties);
					}
				}
			}
		})();

		return () => {
			queueManagerRef.current?.destroy();
			queueManagerRef.current = null;
		};
	}, [track, journeyStage]);

	const enqueueEvent = useCallback(
		(eventName: string, properties: Record<string, unknown>) => {
			queueManagerRef.current?.enqueue(eventName, properties);
		},
		[],
	);

	const trackGameStart = useCallback(
		(event: GameStartEvent) => {
			enqueueEvent("game_started", {
				game_slug: event.game,
				mode: event.mode,
				difficulty: event.difficulty,
				puzzle_id: event.puzzleId,
			});
		},
		[enqueueEvent],
	);

	const trackGameComplete = useCallback(
		(event: GameCompleteEvent) => {
			enqueueEvent("game_completed", {
				game_slug: event.game,
				status: event.status,
				attempts: event.attempts,
				time_spent_ms: event.timeSpentMs,
				score: event.score,
				mode: event.mode,
				difficulty: event.difficulty,
				puzzle_id: event.puzzleId,
			});

			// Also track win/loss specifically for funnel analysis
			if (event.status === "won") {
				enqueueEvent("game_won", {
					game_slug: event.game,
					attempts: event.attempts,
					time_spent_ms: event.timeSpentMs,
					score: event.score,
				});
			} else {
				enqueueEvent("game_lost", {
					game_slug: event.game,
					attempts: event.attempts,
					time_spent_ms: event.timeSpentMs,
				});
			}
		},
		[enqueueEvent],
	);

	const trackAchievement = useCallback(
		(event: AchievementEvent) => {
			enqueueEvent("achievement_unlocked", {
				achievement_id: event.achievementId,
				achievement_name: event.achievementName,
				category: event.category,
				points: event.points,
			});
		},
		[enqueueEvent],
	);

	const trackStreak = useCallback(
		(event: StreakEvent) => {
			enqueueEvent("streak_updated", {
				streak_type: event.streakType,
				streak_count: event.streakCount,
				is_new_record: event.isNewRecord,
			});

			// Track milestone streaks separately
			if (
				event.streakCount === 7 ||
				event.streakCount === 30 ||
				event.streakCount === 100
			) {
				enqueueEvent("streak_milestone", {
					streak_type: event.streakType,
					milestone: event.streakCount,
				});
			}
		},
		[enqueueEvent],
	);

	const trackSubscription = useCallback(
		(
			action: "started" | "cancelled" | "upgraded" | "downgraded",
			planId: string,
		) => {
			enqueueEvent(`subscription_${action}`, {
				plan_id: planId,
			});
		},
		[enqueueEvent],
	);

	const trackFeatureUsed = useCallback(
		(feature: string, properties?: Record<string, unknown>) => {
			enqueueEvent("feature_used", {
				feature,
				...properties,
			});
		},
		[enqueueEvent],
	);

	const flushEvents = useCallback(async () => {
		await queueManagerRef.current?.flush();
	}, []);

	return {
		trackGameStart,
		trackGameComplete,
		trackAchievement,
		trackStreak,
		trackSubscription,
		trackFeatureUsed,
		flushEvents,
		analyticsError,
	};
}

// ==========================================
// Utility Hooks
// ==========================================

/**
 * Hook to determine user journey stage based on common patterns
 *
 * Usage:
 * ```tsx
 * const journeyStage = useJourneyStage({ isAuthenticated, isPremium, daysSinceFirstVisit })
 * const analytics = useGameAnalytics({ journeyStage })
 * ```
 */
function _useJourneyStage(params: {
	isAuthenticated: boolean;
	isPremium?: boolean;
	daysSinceFirstVisit?: number;
}): UserJourneyStage {
	return useMemo(() => {
		if (params.isPremium) return "premium";
		if (params.isAuthenticated) return "returning";
		if (
			params.daysSinceFirstVisit !== undefined &&
			params.daysSinceFirstVisit > 1
		)
			return "returning";
		return "new";
	}, [params.isAuthenticated, params.isPremium, params.daysSinceFirstVisit]);
}
