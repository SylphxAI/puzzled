'use client'

/**
 * Session Replay Provider
 *
 * Initializes session replay with consent-aware recording.
 * Only records when:
 * - Running in production
 * - User has granted analytics consent
 * - SDK is properly configured
 *
 * Provides error correlation for debugging support issues.
 */

import { useEffect, useRef } from 'react'
import { useSessionReplay, useSafeUser, useBilling } from '@sylphx/sdk/react'
import { hasAnalyticsConsent, onConsentChange } from '@/features/analytics'
import { WEEK_MS } from '@/lib/constants/time'
import { getSessionReplayConfig, getAdjustedSampleRate } from '../lib'

export interface SessionReplayProviderProps {
	children: React.ReactNode
}

/**
 * Session Replay Provider Component
 *
 * Wraps the app to enable session replay when conditions are met.
 * Automatically links user context and handles consent changes.
 */
export function SessionReplayProvider({ children }: SessionReplayProviderProps) {
	const isProduction = process.env.NODE_ENV === 'production'

	// Only render the actual provider in production
	if (!isProduction) {
		return <>{children}</>
	}

	return <SessionReplayInner>{children}</SessionReplayInner>
}

/**
 * Inner component that actually initializes session replay
 * Separated to avoid hook calls when disabled
 */
function SessionReplayInner({ children }: { children: React.ReactNode }) {
	const { user } = useSafeUser()
	const { isPremium } = useBilling()

	// Track whether we've started recording
	const hasStartedRef = useRef(false)
	const consentRef = useRef(hasAnalyticsConsent())

	// Check if user is new (created in last 7 days)
	const isNewUser = user?.createdAt
		? Date.now() - new Date(user.createdAt).getTime() < WEEK_MS
		: false

	// Calculate sample rate based on user segment
	const adjustedRate = getAdjustedSampleRate({
		isPremium,
		isNewUser,
	})

	// Get config with potential sample rate override
	const config = getSessionReplayConfig()
	if (adjustedRate !== null && config.sampling) {
		config.sampling.rate = adjustedRate
	}

	// Initialize session replay with consent check
	// Uses default endpoint (/api/session-replay) for uploads
	const shouldRecord = consentRef.current
	const {
		sessionId,
		isRecording,
		markError,
		markNavigation,
		markConversion,
		stop,
	} = useSessionReplay({
		...config,
		autoStart: shouldRecord,
		stopOnUnmount: true,
		// Uses /api/session-replay endpoint by default
		uploadEndpoint: '/api/session-replay',
		userId: user?.id,
		onError: (error) => {
			// Log but don't break the app
			console.warn('[SessionReplay] Recording error:', error.message)
		},
	})

	// Handle consent changes
	useEffect(() => {
		const unsubscribe = onConsentChange((status) => {
			const hasConsent = status === 'accepted'
			consentRef.current = hasConsent

			// Stop recording if consent is revoked
			if (!hasConsent && isRecording) {
				void stop()
			}
		})

		return unsubscribe
	}, [isRecording, stop])

	// Mark session with user context when user changes
	useEffect(() => {
		if (user?.id && isRecording) {
			// User context is automatically linked via userId prop
			// Add custom marker for premium status changes
			if (isPremium) {
				markConversion('premium_user')
			}
		}
	}, [user?.id, isPremium, isRecording, markConversion])

	// Expose replay functions globally for error boundary integration
	useEffect(() => {
		if (typeof window !== 'undefined' && isRecording) {
			// Store for error boundary access
			const windowWithReplay = window as Window & {
				__puzzledSessionReplay?: {
					sessionId: string | null
					markError: typeof markError
					markNavigation: typeof markNavigation
					markConversion: typeof markConversion
				}
			}

			windowWithReplay.__puzzledSessionReplay = {
				sessionId,
				markError,
				markNavigation,
				markConversion,
			}

			return () => {
				delete windowWithReplay.__puzzledSessionReplay
			}
		}
	}, [isRecording, sessionId, markError, markNavigation, markConversion])

	// Log session start for debugging (dev only)
	useEffect(() => {
		if (sessionId && !hasStartedRef.current) {
			hasStartedRef.current = true
			if (process.env.NODE_ENV === 'development') {
				console.log('[SessionReplay] Recording started:', sessionId)
			}
		}
	}, [sessionId])

	return <>{children}</>
}
