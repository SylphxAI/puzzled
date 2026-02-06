/**
 * Automatic Breadcrumb Collection
 *
 * Captures user actions leading to errors:
 * - UI interactions (clicks, inputs)
 * - Network requests (fetch, XHR)
 * - Console logs
 * - Navigation changes
 */

import type { Breadcrumb, ErrorLevel } from './types'
import { sanitizeUrl, sanitizeForLogging } from '../session-replay/privacy'
import { LOG_MESSAGE_MAX_LENGTH } from '../../../constants'
import { onFetchEnd, onXHREnd, type UnsubscribeFn } from '../network-interceptor'

// ==========================================
// Breadcrumb Store
// ==========================================

let breadcrumbs: Breadcrumb[] = []
let maxBreadcrumbs = 100

/**
 * Configure max breadcrumbs
 */
export function setMaxBreadcrumbs(max: number): void {
	maxBreadcrumbs = max
	trimBreadcrumbs()
}

/**
 * Add a breadcrumb
 */
export function addBreadcrumb(breadcrumb: Breadcrumb): void {
	breadcrumbs.push({
		...breadcrumb,
		timestamp: breadcrumb.timestamp ?? Date.now(),
	})
	trimBreadcrumbs()
}

/**
 * Get all breadcrumbs
 */
export function getBreadcrumbs(): Breadcrumb[] {
	return [...breadcrumbs]
}

/**
 * Clear all breadcrumbs
 */
export function clearBreadcrumbs(): void {
	breadcrumbs = []
}

/**
 * Trim breadcrumbs to max size
 */
function trimBreadcrumbs(): void {
	if (breadcrumbs.length > maxBreadcrumbs) {
		breadcrumbs = breadcrumbs.slice(-maxBreadcrumbs)
	}
}

// ==========================================
// Click Capture
// ==========================================

let clickCaptureEnabled = false

/**
 * Enable click capture
 */
function enableClickCapture(): void {
	if (clickCaptureEnabled || typeof document === 'undefined') return
	clickCaptureEnabled = true

	document.addEventListener(
		'click',
		(event) => {
			const target = event.target as Element
			if (!target) return

			const breadcrumb: Breadcrumb = {
				type: 'ui',
				category: 'ui.click',
				message: getElementDescription(target),
				data: {
					selector: getElementSelector(target),
				},
				level: 'info',
			}

			addBreadcrumb(breadcrumb)
		},
		{ capture: true, passive: true }
	)
}

/**
 * Get human-readable description of clicked element
 */
function getElementDescription(element: Element): string {
	const tag = element.tagName.toLowerCase()
	const text = element.textContent?.trim().slice(0, 50) || ''
	const id = element.id ? `#${element.id}` : ''
	const role = element.getAttribute('role')
	const ariaLabel = element.getAttribute('aria-label')

	if (ariaLabel) {
		return `${tag}[${ariaLabel}]`
	}
	if (role) {
		return `${tag}[role=${role}]`
	}
	if (id) {
		return `${tag}${id}`
	}
	if (text) {
		return `${tag}[${text}]`
	}
	return tag
}

/**
 * Get CSS selector for element
 */
function getElementSelector(element: Element): string {
	if (element.id) {
		return `#${CSS.escape(element.id)}`
	}

	const tag = element.tagName.toLowerCase()
	const classes = Array.from(element.classList)
		.slice(0, 2)
		.map((c) => `.${CSS.escape(c)}`)
		.join('')

	return classes ? `${tag}${classes}` : tag
}

// ==========================================
// Input Capture
// ==========================================

let inputCaptureEnabled = false

/**
 * Enable input capture (captures input events without values)
 */
function enableInputCapture(): void {
	if (inputCaptureEnabled || typeof document === 'undefined') return
	inputCaptureEnabled = true

	document.addEventListener(
		'input',
		(event) => {
			const target = event.target as HTMLInputElement | HTMLTextAreaElement
			if (!target) return

			// Don't capture the actual value for privacy
			const breadcrumb: Breadcrumb = {
				type: 'ui',
				category: 'ui.input',
				message: `Input: ${getElementDescription(target)}`,
				data: {
					selector: getElementSelector(target),
					type: target.type || 'text',
				},
				level: 'info',
			}

			addBreadcrumb(breadcrumb)
		},
		{ capture: true, passive: true }
	)
}

// ==========================================
// Network Capture
// ==========================================

let networkCaptureEnabled = false
let networkUnsubscribers: UnsubscribeFn[] = []

/**
 * Enable network request capture via shared interceptor.
 *
 * Uses the centralized network interceptor instead of independently
 * monkey-patching fetch/XHR. This prevents the fragile chain problem
 * where multiple modules each wrap the previous patch.
 */
function enableNetworkCapture(): void {
	if (networkCaptureEnabled || typeof window === 'undefined') return
	networkCaptureEnabled = true

	networkUnsubscribers.push(
		onFetchEnd((event) => {
			const failed = event.status === 0 && event.error
			addBreadcrumb({
				type: 'http',
				category: 'fetch',
				message: `${event.method} ${sanitizeUrl(event.url)}${failed ? ' (failed)' : ''}`,
				data: {
					method: event.method,
					url: sanitizeUrl(event.url),
					status_code: event.status,
					duration_ms: event.duration,
					...(event.error ? { error: event.error } : {}),
				},
				level: event.ok ? 'info' : 'error',
			})
		}),
	)

	networkUnsubscribers.push(
		onXHREnd((event) => {
			addBreadcrumb({
				type: 'http',
				category: 'xhr',
				message: `${event.method} ${sanitizeUrl(event.url)}`,
				data: {
					method: event.method,
					url: sanitizeUrl(event.url),
					status_code: event.status,
					duration_ms: event.duration,
				},
				level: event.status >= 400 ? 'error' : 'info',
			})
		}),
	)
}

/**
 * Unregister network capture listeners (for testing)
 */
function disableNetworkCapture(): void {
	if (!networkCaptureEnabled) return
	networkCaptureEnabled = false

	for (const unsub of networkUnsubscribers) {
		unsub()
	}
	networkUnsubscribers = []
}

// ==========================================
// Console Capture
// ==========================================

let consoleCaptureEnabled = false
const originalConsole: Partial<Record<'log' | 'info' | 'warn' | 'error' | 'debug', (...args: unknown[]) => void>> = {}

/**
 * Enable console log capture
 */
function enableConsoleCapture(): void {
	if (consoleCaptureEnabled || typeof console === 'undefined') return
	consoleCaptureEnabled = true

	const levels: Array<'log' | 'info' | 'warn' | 'error' | 'debug'> = [
		'log',
		'info',
		'warn',
		'error',
		'debug',
	]

	const levelMap: Record<string, ErrorLevel> = {
		log: 'info',
		info: 'info',
		warn: 'warning',
		error: 'error',
		debug: 'debug',
	}

	levels.forEach((level) => {
		originalConsole[level] = console[level]

		console[level] = (...args: unknown[]) => {
			const message = args.map((arg) => String(arg)).join(' ')

			addBreadcrumb({
				type: 'debug',
				category: `console.${level}`,
				message: sanitizeForLogging(message).slice(0, LOG_MESSAGE_MAX_LENGTH),
				level: levelMap[level],
			})

			originalConsole[level]?.apply(console, args)
		}
	})
}

/**
 * Restore original console (for testing)
 */
function disableConsoleCapture(): void {
	if (!consoleCaptureEnabled) return
	consoleCaptureEnabled = false

	const levels: Array<'log' | 'info' | 'warn' | 'error' | 'debug'> = [
		'log',
		'info',
		'warn',
		'error',
		'debug',
	]

	levels.forEach((level) => {
		if (originalConsole[level]) {
			console[level] = originalConsole[level]!
		}
	})
}

// ==========================================
// Navigation Capture
// ==========================================

let navigationCaptureEnabled = false
let lastUrl: string | null = null

/**
 * Enable navigation capture
 */
function enableNavigationCapture(): void {
	if (navigationCaptureEnabled || typeof window === 'undefined') return
	navigationCaptureEnabled = true

	lastUrl = window.location.href

	// History API
	const originalPushState = history.pushState
	const originalReplaceState = history.replaceState

	history.pushState = function (...args) {
		const result = originalPushState.apply(this, args)
		handleNavigationChange()
		return result
	}

	history.replaceState = function (...args) {
		const result = originalReplaceState.apply(this, args)
		handleNavigationChange()
		return result
	}

	// Popstate (back/forward)
	window.addEventListener('popstate', handleNavigationChange)
}

function handleNavigationChange(): void {
	const newUrl = window.location.href

	if (newUrl !== lastUrl) {
		addBreadcrumb({
			type: 'navigation',
			category: 'navigation',
			message: `Navigated`,
			data: {
				from: lastUrl ? sanitizeUrl(lastUrl) : undefined,
				to: sanitizeUrl(newUrl),
			},
			level: 'info',
		})

		lastUrl = newUrl
	}
}

// ==========================================
// All-in-One Setup
// ==========================================

export interface AutoCaptureOptions {
	clicks?: boolean
	inputs?: boolean
	network?: boolean
	console?: boolean
	navigation?: boolean
}

/**
 * Enable all automatic breadcrumb capture
 */
export function enableAutoCapture(options: AutoCaptureOptions = {}): void {
	const {
		clicks = true,
		inputs = true,
		network = true,
		console = true,
		navigation = true,
	} = options

	if (clicks) enableClickCapture()
	if (inputs) enableInputCapture()
	if (network) enableNetworkCapture()
	if (console) enableConsoleCapture()
	if (navigation) enableNavigationCapture()
}
