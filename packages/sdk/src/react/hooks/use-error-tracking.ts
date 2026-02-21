/**
 * Enhanced Error Tracking Hook
 *
 * React hook with Session Replay integration.
 * Automatically correlates errors with replay sessions.
 *
 * @example
 * ```tsx
 * function App() {
 *   const { captureException, addBreadcrumb } = useEnhancedErrorTracking({
 *     attachReplay: true,
 *   })
 *
 *   const handleClick = async () => {
 *     try {
 *       await riskyOperation()
 *     } catch (error) {
 *       const { eventId, replayUrl } = await captureException(error)
 *       console.log(`Error ${eventId} - Replay: ${replayUrl}`)
 *     }
 *   }
 *
 *   return <button onClick={handleClick}>Do Something</button>
 * }
 * ```
 */

"use client";

import { useCallback, useEffect, useRef } from "react";
import { SESSION_REPLAY_STATUS_CHECK_MS } from "../../constants";
import {
	type Breadcrumb,
	type CaptureExceptionOptions,
	type CaptureMessageOptions,
	type CaptureResult,
	// Error tracking
	type ErrorTracker,
	type ErrorTrackingConfig,
	// Session replay
	getRecorder,
	getTracker,
} from "../../lib/monitoring";

// ==========================================
// Types
// ==========================================

export interface UseEnhancedErrorTrackingOptions
	extends Partial<ErrorTrackingConfig> {
	/**
	 * Automatically link with session replay
	 * @default true
	 */
	attachReplay?: boolean;

	/**
	 * Upload endpoint path
	 * @default '/api/monitoring/error'
	 */
	uploadEndpoint?: string;

	/**
	 * Custom upload handler
	 */
	onUpload?: (event: unknown) => Promise<{ eventId: string }>;

	/**
	 * Called when an error is captured
	 */
	onCapture?: (result: CaptureResult) => void;

	/**
	 * Initialize on mount
	 * @default true
	 */
	autoInit?: boolean;
}

export interface UseEnhancedErrorTrackingReturn {
	/** Capture an exception with replay correlation */
	captureException: (
		error: Error,
		options?: CaptureExceptionOptions,
	) => Promise<CaptureResult & { replayUrl?: string }>;
	/** Capture a message */
	captureMessage: (
		message: string,
		options?: CaptureMessageOptions,
	) => Promise<CaptureResult>;
	/** Add a breadcrumb */
	addBreadcrumb: (breadcrumb: Breadcrumb) => void;
	/** Set current user */
	setUser: (user: { id?: string; email?: string; username?: string }) => void;
	/** Clear current user */
	clearUser: () => void;
	/** Manually link a replay session */
	linkReplaySession: (sessionId: string) => void;
	/** Get current replay session ID */
	getReplaySessionId: () => string | null;
}

// ==========================================
// Hook
// ==========================================

/**
 * Enhanced error tracking hook with Session Replay integration
 */
export function useEnhancedErrorTracking(
	options: UseEnhancedErrorTrackingOptions = {},
): UseEnhancedErrorTrackingReturn {
	const {
		attachReplay = true,
		uploadEndpoint = "/api/monitoring/error",
		onUpload: customUpload,
		onCapture,
		autoInit = true,
		...trackerConfig
	} = options;

	const trackerRef = useRef<ErrorTracker | null>(null);
	const replaySessionIdRef = useRef<string | null>(null);

	// Initialize tracker
	useEffect(() => {
		if (typeof window === "undefined") return;

		const tracker = getTracker({
			...trackerConfig,
			attachReplay,
		});

		// Setup upload handler
		const uploadHandler =
			customUpload ?? createDefaultUploadHandler(uploadEndpoint);
		tracker.onUpload(async (event) => {
			const result = await uploadHandler(event);
			return result;
		});

		// Link with session replay if enabled
		if (attachReplay) {
			try {
				const recorder = getRecorder();
				const status = recorder.getStatus();
				if (status.sessionId) {
					tracker.setSessionReplayId(status.sessionId);
					replaySessionIdRef.current = status.sessionId;
				}
			} catch {
				// Recorder might not be initialized
			}
		}

		// Auto init
		if (autoInit) {
			tracker.init();
		}

		trackerRef.current = tracker;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Keep replay session in sync
	useEffect(() => {
		if (!attachReplay || typeof window === "undefined") return;

		const checkReplaySession = () => {
			try {
				const recorder = getRecorder();
				const status = recorder.getStatus();
				if (
					status.sessionId &&
					status.sessionId !== replaySessionIdRef.current
				) {
					replaySessionIdRef.current = status.sessionId;
					trackerRef.current?.setSessionReplayId(status.sessionId);
				}
			} catch {
				// Ignore
			}
		};

		const interval = setInterval(
			checkReplaySession,
			SESSION_REPLAY_STATUS_CHECK_MS,
		);
		return () => clearInterval(interval);
	}, [attachReplay]);

	// ==========================================
	// Actions
	// ==========================================

	const captureException = useCallback(
		async (
			error: Error,
			opts: CaptureExceptionOptions = {},
		): Promise<CaptureResult & { replayUrl?: string }> => {
			if (!trackerRef.current) {
				return { eventId: "" };
			}

			// Mark error in session replay if available
			if (attachReplay && replaySessionIdRef.current) {
				try {
					const recorder = getRecorder();
					recorder.markError(`err_${Date.now()}`, error);
				} catch {
					// Ignore
				}
			}

			const result = await trackerRef.current.captureException(error, {
				...opts,
				replaySessionId: replaySessionIdRef.current ?? undefined,
			});

			// Build replay URL if we have a session
			let replayUrl: string | undefined;
			if (result.replaySessionId) {
				replayUrl = `/console/replay/${result.replaySessionId}?event=${result.eventId}`;
			}

			onCapture?.(result);

			return {
				...result,
				replayUrl,
			};
		},
		[attachReplay, onCapture],
	);

	const captureMessage = useCallback(
		async (
			message: string,
			opts: CaptureMessageOptions = {},
		): Promise<CaptureResult> => {
			if (!trackerRef.current) {
				return { eventId: "" };
			}

			const result = await trackerRef.current.captureMessage(message, opts);
			onCapture?.(result);

			return result;
		},
		[onCapture],
	);

	const addBreadcrumb = useCallback((breadcrumb: Breadcrumb): void => {
		trackerRef.current?.addBreadcrumb(breadcrumb);
	}, []);

	const setUser = useCallback(
		(user: { id?: string; email?: string; username?: string }): void => {
			trackerRef.current?.setUser(user);
		},
		[],
	);

	const clearUser = useCallback((): void => {
		trackerRef.current?.clearUser();
	}, []);

	const linkReplaySession = useCallback((sessionId: string): void => {
		replaySessionIdRef.current = sessionId;
		trackerRef.current?.setSessionReplayId(sessionId);
	}, []);

	const getReplaySessionId = useCallback((): string | null => {
		return replaySessionIdRef.current;
	}, []);

	return {
		captureException,
		captureMessage,
		addBreadcrumb,
		setUser,
		clearUser,
		linkReplaySession,
		getReplaySessionId,
	};
}

// ==========================================
// Helpers
// ==========================================

interface UploadResponse {
	eventId: string;
	isNewError?: boolean;
	recommendedSampleRate?: number;
	quotaUsage?: number;
}

function createDefaultUploadHandler(
	endpoint: string,
): (event: unknown) => Promise<UploadResponse> {
	return async (event: unknown) => {
		const response = await fetch(endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(event),
		});

		if (!response.ok) {
			// Try to extract quota feedback from error response
			try {
				const errorData = (await response.json()) as {
					error?: { message: string };
					recommendedSampleRate?: number;
					quotaUsage?: number;
				};
				// Return with quota feedback for adaptive sampling even on error
				if (errorData.recommendedSampleRate !== undefined) {
					return {
						eventId: "",
						recommendedSampleRate: errorData.recommendedSampleRate,
						quotaUsage: errorData.quotaUsage,
					};
				}
			} catch {
				// Ignore JSON parse error
			}
			throw new Error(`Upload failed: ${response.status}`);
		}

		const data = (await response.json()) as UploadResponse;
		return {
			eventId: data.eventId,
			isNewError: data.isNewError,
			recommendedSampleRate: data.recommendedSampleRate,
			quotaUsage: data.quotaUsage,
		};
	};
}

// ==========================================
// Combined Hook
// ==========================================

export interface UseCombinedMonitoringOptions
	extends UseEnhancedErrorTrackingOptions {
	/** Session replay config (passed to useSessionReplay) */
	replayConfig?: Record<string, unknown>;
}

/**
 * Combined hook for error tracking + session replay
 * Use this as a single integration point
 */
export function useCombinedMonitoring(
	options: UseCombinedMonitoringOptions = {},
) {
	const errorTracking = useEnhancedErrorTracking(options);

	// The session replay is handled by the error tracking hook via getRecorder()
	// This hook just provides a unified interface

	return {
		// Error tracking
		...errorTracking,

		// Helper to capture and mark in replay
		captureWithReplay: async (
			error: Error,
			opts: CaptureExceptionOptions = {},
		): Promise<CaptureResult & { replayUrl?: string }> => {
			return errorTracking.captureException(error, opts);
		},
	};
}
