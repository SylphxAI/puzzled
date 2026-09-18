'use client'

/**
 * Deferred shell chrome.
 *
 * Anything that is not needed for the first paint of a route is mounted on an
 * idle frame after the document is ready, or immediately on the first user
 * interaction, and its modules are imported on demand so they never enter the
 * initial route bundle:
 *
 * - the toast host (sonner runtime),
 * - session replay, the global error handler and the web-vitals reporter,
 * - achievement toasts, the PWA install prompt and the consent banner.
 *
 * Every path is bounded: the mount happens at the earliest of `load` + idle,
 * DOMContentLoaded + 2 s, 4 s after first paint, or the first interaction —
 * so a hung subresource can delay the chrome but can never drop it. Consent
 * behaviour is unchanged: analytics only fire after the banner recorded an
 * explicit opt-in (the gate lives at the send site, see
 * `features/analytics/lib/web-vitals*`).
 */

import dynamic from 'next/dynamic'
import { type ReactNode, useEffect, useState } from 'react'
import { captureInstallPrompt } from './pwa-install-event'

// The install prompt is a once-per-load browser event: listen from the first
// client evaluation, long before the deferred UI exists.
captureInstallPrompt()

const loadChunk = () => import('./deferred-chunk')

const ChunkToaster = dynamic(() => loadChunk().then((module) => module.DeferredToaster), {
	ssr: false,
})
const ChunkMonitoring = dynamic(() => loadChunk().then((module) => module.DeferredMonitoring), {
	ssr: false,
})
const ChunkOverlays = dynamic(() => loadChunk().then((module) => module.DeferredOverlays), {
	ssr: false,
})

/** Longest a deferred mount may wait once the document has loaded. */
const IDLE_TIMEOUT_MS = 2000
/** Fallback delay when the browser has no `requestIdleCallback`. */
const IDLE_FALLBACK_MS = 200
/** Grace after DOMContentLoaded when `load` never arrives (hung subresource). */
const DCL_GRACE_MS = 2000
/** Absolute cap from first paint, whatever the document is waiting for. */
const RELEASE_CAP_MS = 4000

/**
 * Run `callback` once the first paint is no longer at risk. Whichever comes
 * first wins:
 *
 * 1. the first pointer/keyboard interaction,
 * 2. `load` followed by an idle frame,
 * 3. DOMContentLoaded + {@link DCL_GRACE_MS},
 * 4. {@link RELEASE_CAP_MS} after first paint.
 *
 * The last two bounds exist because `load` can be held up indefinitely by a
 * slow or hung subresource (a third-party beacon, a font, a stray image), and
 * the consent banner, install prompt, error handler and vitals reporter must
 * still appear on such a page.
 *
 * Returns a cancel function.
 */
export function afterFirstPaint(callback: () => void): () => void {
	if (typeof window === 'undefined') return () => undefined

	let done = false
	let idleHandle: number | undefined
	const timers: Array<ReturnType<typeof setTimeout>> = []

	const release = () => {
		if (done) return
		done = true
		cancel()
		callback()
	}

	const scheduleIdle = () => {
		if (done) return
		if (typeof requestIdleCallback === 'function') {
			idleHandle = requestIdleCallback(release, { timeout: IDLE_TIMEOUT_MS })
		} else {
			timers.push(setTimeout(release, IDLE_FALLBACK_MS))
		}
	}

	const cancel = () => {
		if (idleHandle !== undefined && typeof cancelIdleCallback === 'function') {
			cancelIdleCallback(idleHandle)
		}
		for (const timer of timers) clearTimeout(timer)
		window.removeEventListener('load', scheduleIdle)
		document.removeEventListener('DOMContentLoaded', armDclGrace)
		window.removeEventListener('pointerdown', release)
		window.removeEventListener('keydown', release)
	}

	/** `load` is not reliable: cap the wait from DOMContentLoaded too. */
	function armDclGrace() {
		if (!done) timers.push(setTimeout(release, DCL_GRACE_MS))
	}

	// An engaged player gets the chrome right away.
	window.addEventListener('pointerdown', release, { passive: true })
	window.addEventListener('keydown', release)

	// Absolute cap from the moment this ran (hydrated shell, i.e. first paint).
	timers.push(setTimeout(release, RELEASE_CAP_MS))
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', armDclGrace, { once: true })
	} else {
		armDclGrace()
	}
	if (document.readyState === 'complete') {
		scheduleIdle()
	} else {
		window.addEventListener('load', scheduleIdle)
	}

	return cancel
}

/**
 * True once the first paint is no longer at risk (see `afterFirstPaint`).
 */
export function useDeferredMount(): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => afterFirstPaint(() => setReady(true)), [])

	return ready
}

export function DeferredMount({ children }: { children: ReactNode }) {
	const ready = useDeferredMount()
	return ready ? children : null
}

/** Sonner toast host: toasts raised before it mounts are queued by sonner. */
export function DeferredToaster() {
	return (
		<DeferredMount>
			<ChunkToaster />
		</DeferredMount>
	)
}

/** Session replay, error handler and web-vitals reporter. */
export function DeferredMonitoring() {
	return (
		<DeferredMount>
			<ChunkMonitoring />
		</DeferredMount>
	)
}

/** Achievement toasts, PWA install prompt and the consent banner. */
export function DeferredOverlays({ maxStreak }: { maxStreak?: number | null }) {
	return (
		<DeferredMount>
			<ChunkOverlays maxStreak={maxStreak} />
		</DeferredMount>
	)
}
