'use client'

/**
 * Consent Banner Wrapper
 *
 * Uses SDK's CookieBanner with localStorage sync: the SDK owns the UI and the
 * stored decision, this wrapper mirrors a settled decision onto the keys
 * client-side scripts read (`puzzled:consent:cookie`).
 *
 * The (main) layout mounts this eagerly, not through the deferred shell: the
 * banner is the largest contentful paint on mobile, so the S5 budget requires
 * it in the first frame. Server rendering is safe - `useSafeConsent` starts
 * from "no decision" on both sides of hydration, so the server output and the
 * first client render match; a visitor whose decision is already stored is
 * hidden before paint (see the settle script in `app/[locale]/layout.tsx` and
 * the `[data-consent-banner]` rule in globals.css), so the banner never
 * flashes and hydration stays consistent.
 */

import { useEffect, useState } from 'react'
import { CookieBanner, useSafeConsent } from '@/lib/identity/react'
import { CONSENT_KEY, CONSENT_TIMESTAMP_KEY, MARKETING_CONSENT_KEY } from '@/lib/storage-keys'

/**
 * Mirror the SDK's stored decision onto the key client-side scripts read
 * (`puzzled:consent:cookie`). Callers must have a settled decision.
 */
function mirrorStoredConsent(): void {
	if (typeof window === 'undefined') return
	const stored = window.localStorage.getItem('puzzled-consent')
	if (!stored) return
	let preferences: Record<string, boolean>
	try {
		preferences = JSON.parse(stored) as Record<string, boolean>
	} catch {
		return
	}
	const analyticsConsent = preferences.analytics === true
	const timestamp = new Date().toISOString()
	localStorage.setItem(CONSENT_KEY, analyticsConsent ? 'accepted' : 'declined')
	localStorage.setItem(
		MARKETING_CONSENT_KEY,
		preferences.marketing === true ? 'accepted' : 'declined',
	)
	localStorage.setItem(CONSENT_TIMESTAMP_KEY, timestamp)

	// Dispatch event for client-side scripts listening
	window.dispatchEvent(
		new CustomEvent('consent-change', {
			detail: {
				status: analyticsConsent ? 'accepted' : 'declined',
				timestamp,
			},
		}),
	)
}

/**
 * Sync SDK consent state to localStorage for client-side scripts
 */
function ConsentSync() {
	const { hasConsented, isLoading, isConfigured } = useSafeConsent()

	useEffect(() => {
		// Don't sync if SDK is not configured (SSR/prerendering)
		if (!isConfigured) return
		if (isLoading || typeof window === 'undefined') return

		// Sync to localStorage when consent state changes
		if (hasConsented) {
			mirrorStoredConsent()
		}
	}, [hasConsented, isLoading, isConfigured])

	return null
}

const MODAL_SELECTOR = '[role="dialog"], [role="alertdialog"]'

/**
 * True while a modal dialog is open. The modal marks the rest of the app inert
 * and sits below the banner's layer, so a banner left up would cover the
 * modal's own actions (the result screen's Plus offer, Share, Play next) and
 * could not be pressed itself. It comes back when the modal closes.
 */
function useModalOpen(): boolean {
	const [open, setOpen] = useState(false)
	useEffect(() => {
		const sync = () => setOpen(document.querySelector(MODAL_SELECTOR) !== null)
		sync()
		const observer = new MutationObserver(sync)
		observer.observe(document.body, { childList: true, subtree: true })
		return () => observer.disconnect()
	}, [])
	return open
}

/**
 * Inner component that only renders when SDK is configured
 * CookieBanner uses useConsent internally which throws during SSR
 */
function ConsentBannerInner() {
	const handleSave = () => {
		// The SDK has stored the decision by the time it calls this, so mirror it
		// now: without this, a player who opts in during a page view would only be
		// visible to analytics on the next one.
		mirrorStoredConsent()
	}

	const modalOpen = useModalOpen()

	return (
		<div style={{ display: modalOpen ? 'none' : 'contents' }}>
			<CookieBanner
				position="bottom"
				privacyPolicyUrl="/privacy"
				variant="bar"
				onSave={handleSave}
			/>
		</div>
	)
}

/**
 * Consent Banner with localStorage sync
 *
 * Uses SDK's CookieBanner for UI and consent management, and mirrors a
 * settled decision onto the keys client-side scripts read. Renders eagerly:
 * a visitor without a stored decision sees the banner in the first frame.
 */
export function ConsentBanner() {
	const { isConfigured } = useSafeConsent()

	// Don't render if SDK is not configured (SSR/prerendering)
	if (!isConfigured) return null

	return (
		<>
			<ConsentSync />
			<ConsentBannerInner />
		</>
	)
}
