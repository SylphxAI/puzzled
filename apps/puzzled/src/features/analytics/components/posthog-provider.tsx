'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useConsent } from '@sylphx/platform-sdk/react'

// Flag to track if PostHog has been initialized
let isPostHogInitialized = false

/**
 * Initialize PostHog
 * This is called only after consent is verified via SDK
 */
function initializePostHog(): boolean {
	if (isPostHogInitialized) return true
	if (typeof window === 'undefined') return false
	if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return false

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
	const { hasConsent } = useConsent()

	useEffect(() => {
		if (!pathname || !ph || !hasConsent('analytics')) return

		let url = window.origin + pathname
		if (searchParams.toString()) {
			url = `${url}?${searchParams.toString()}`
		}
		ph.capture('$pageview', { $current_url: url })
	}, [pathname, searchParams, ph, hasConsent])

	return null
}

/**
 * Component that handles SDK consent-based initialization
 * Uses Sylphx Platform SDK's useConsent hook for GDPR compliance
 */
function ConsentAwarePostHog({ children }: { children: React.ReactNode }) {
	const { hasConsent, isLoading } = useConsent()
	const [isReady, setIsReady] = useState(false)

	// Check consent and initialize PostHog
	const checkAndInitialize = useCallback(() => {
		const analyticsConsent = hasConsent('analytics')

		if (analyticsConsent) {
			const initialized = initializePostHog()
			setIsReady(initialized)
		} else {
			// If consent is revoked, opt out
			if (isPostHogInitialized) {
				posthog.opt_out_capturing()
			}
			setIsReady(false)
		}
	}, [hasConsent])

	// React to consent changes
	useEffect(() => {
		if (!isLoading) {
			checkAndInitialize()
		}
	}, [isLoading, checkAndInitialize])

	// If loading or no consent, render children without PostHog
	if (isLoading || !hasConsent('analytics') || !isReady) {
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
 * Uses Sylphx Platform SDK's consent management for GDPR compliance.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
	if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
		// PostHog not configured - render children without tracking
		return <>{children}</>
	}

	return <ConsentAwarePostHog>{children}</ConsentAwarePostHog>
}
