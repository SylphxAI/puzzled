'use client'

/**
 * Deferred shell chrome.
 *
 * Anything that is not needed for the first paint of a route is mounted after
 * the load event on an idle frame (or immediately on the first user
 * interaction), and its modules are imported on demand so they never enter the
 * initial route bundle:
 *
 * - the toast host (sonner runtime),
 * - session replay, the global error handler and the web-vitals reporter,
 * - achievement toasts, the PWA install prompt and the consent banner.
 *
 * The idle deadline is bounded, so every one of these still appears on a slow
 * or busy device; nothing is skipped. Consent behaviour is unchanged: analytics
 * only fire after the banner recorded an explicit opt-in (the gate lives at the
 * send site, see `features/analytics/lib/web-vitals*`).
 */

import dynamic from 'next/dynamic'
import { type ReactNode, useEffect, useState } from 'react'

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

/**
 * Run `callback` once the first paint is no longer at risk: after the document
 * has loaded and the main thread reached idle, or on the first user
 * interaction, whichever comes first. Returns a cancel function.
 */
export function afterFirstPaint(callback: () => void): () => void {
	if (typeof window === 'undefined') return () => undefined

	let done = false
	let idleHandle: number | undefined
	let timerHandle: ReturnType<typeof setTimeout> | undefined

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
			timerHandle = setTimeout(release, IDLE_FALLBACK_MS)
		}
	}

	const cancel = () => {
		if (idleHandle !== undefined && typeof cancelIdleCallback === 'function') {
			cancelIdleCallback(idleHandle)
		}
		if (timerHandle !== undefined) clearTimeout(timerHandle)
		window.removeEventListener('load', scheduleIdle)
		window.removeEventListener('pointerdown', release)
		window.removeEventListener('keydown', release)
	}

	// An engaged player gets the chrome right away.
	window.addEventListener('pointerdown', release, { passive: true })
	window.addEventListener('keydown', release)
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
