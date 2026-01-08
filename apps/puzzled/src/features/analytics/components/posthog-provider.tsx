'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { type ConsentStatus, hasAnalyticsConsent, onConsentChange } from '../lib/consent'

// Flag to track if PostHog has been initialized
let isPostHogInitialized = false

/**
 * Initialize PostHog only when consent is granted
 * This ensures GDPR compliance by not tracking until user consents
 */
function initializePostHog(): boolean {
	if (isPostHogInitialized) return true
	if (typeof window === 'undefined') return false
	if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return false
	if (!hasAnalyticsConsent()) return false

	posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
		api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
		person_profiles: 'identified_only', // Only create profiles for identified users
		capture_pageview: false, // We capture manually for better control
		capture_pageleave: true,
		autocapture: {
			dom_event_allowlist: ['click', 'submit'],
			css_selector_allowlist: ['[data-ph-capture]'],
		},
		// Privacy-focused defaults
		disable_session_recording: true, // Opt-in only
		mask_all_text: false,
		mask_all_element_attributes: false,
		// Respect Do Not Track
		respect_dnt: true,
	})

	isPostHogInitialized = true
	return true
}

/**
 * Track page views on route change (only if consent granted)
 */
function PostHogPageView() {
	const pathname = usePathname()
	const searchParams = useSearchParams()
	const ph = usePostHog()

	useEffect(() => {
		if (!pathname || !ph || !hasAnalyticsConsent()) return

		let url = window.origin + pathname
		if (searchParams.toString()) {
			url = `${url}?${searchParams.toString()}`
		}
		ph.capture('$pageview', { $current_url: url })
	}, [pathname, searchParams, ph])

	return null
}

/**
 * Component that handles consent-based initialization
 */
function ConsentAwarePostHog({ children }: { children: React.ReactNode }) {
	const [hasConsent, setHasConsent] = useState(false)
	const [isReady, setIsReady] = useState(false)

	// Check consent and initialize PostHog
	const checkAndInitialize = useCallback(() => {
		const consent = hasAnalyticsConsent()
		setHasConsent(consent)

		if (consent) {
			const initialized = initializePostHog()
			setIsReady(initialized)
		} else {
			setIsReady(false)
		}
	}, [])

	// Initial check
	useEffect(() => {
		checkAndInitialize()
	}, [checkAndInitialize])

	// Listen for consent changes
	useEffect(() => {
		const unsubscribe = onConsentChange((status: ConsentStatus) => {
			if (status === 'accepted') {
				checkAndInitialize()
			} else if (status === 'declined') {
				// If consent is revoked, opt out
				if (isPostHogInitialized) {
					posthog.opt_out_capturing()
				}
				setHasConsent(false)
				setIsReady(false)
			}
		})

		return unsubscribe
	}, [checkAndInitialize])

	// If no consent or not ready, render children without PostHog
	if (!hasConsent || !isReady) {
		return <>{children}</>
	}

	return (
		<PHProvider client={posthog}>
			<Suspense fallback={null}>
				<PostHogPageView />
			</Suspense>
			{children}
		</PHProvider>
	)
}

/**
 * PostHog provider wrapper for Next.js App Router
 *
 * This provider defers PostHog initialization until analytics consent is granted.
 * This ensures GDPR compliance by not tracking users before they consent.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
	if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
		// PostHog not configured - render children without tracking
		return <>{children}</>
	}

	return <ConsentAwarePostHog>{children}</ConsentAwarePostHog>
}
