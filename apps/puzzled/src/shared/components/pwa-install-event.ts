/**
 * `beforeinstallprompt` capture.
 *
 * The browser fires that event once per load, early, and the deferred install
 * UI only mounts after first paint. Capturing it here — from an always-mounted
 * client module — keeps the event available for whenever the UI appears, so
 * deferring the prompt cannot silently lose the install offer (nor its
 * `preventDefault`).
 */

export interface BeforeInstallPromptEvent extends Event {
	prompt: () => Promise<void>
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let captured: BeforeInstallPromptEvent | null = null
let listening = false
const listeners = new Set<(event: BeforeInstallPromptEvent) => void>()

/** Subscribe once, at first paint. Safe to call more than once. */
export function captureInstallPrompt(): void {
	if (typeof window === 'undefined' || listening) return
	listening = true
	window.addEventListener(
		'beforeinstallprompt',
		(event) => {
			event.preventDefault()
			captured = event as BeforeInstallPromptEvent
			for (const listener of listeners) listener(captured)
			listeners.clear()
		},
		{ once: true },
	)
}

/** The captured event, or null when the browser has not offered install. */
export function getInstallPrompt(): BeforeInstallPromptEvent | null {
	return captured
}

/** True once the captured event has been consumed by a prompt() call. */
export function clearInstallPrompt(): void {
	captured = null
}

/** Notified if the event arrives after the UI already mounted. */
export function onInstallPrompt(listener: (event: BeforeInstallPromptEvent) => void): () => void {
	listeners.add(listener)
	return () => listeners.delete(listener)
}
