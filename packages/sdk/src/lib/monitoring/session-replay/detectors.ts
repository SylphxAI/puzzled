/**
 * Session Replay Detectors
 *
 * SOTA user frustration detection:
 * - Rage clicks (repeated rapid clicking)
 * - Dead clicks (clicks with no effect)
 * - Error clicks (clicks causing errors)
 * - Scroll thrashing (rapid scrolling)
 */

import type { DeadClick, RageClick } from './types'

// ==========================================
// Types
// ==========================================

interface ClickEvent {
	timestamp: number
	x: number
	y: number
	target: Element | null
	selector: string
}

interface ScrollEvent {
	timestamp: number
	scrollY: number
	direction: 'up' | 'down'
}

// ==========================================
// Rage Click Detection
// ==========================================

/**
 * Rage click detector
 *
 * Detects when users click rapidly on the same element,
 * indicating frustration or confusion.
 */
export class RageClickDetector {
	private clickHistory: ClickEvent[] = []
	private readonly threshold: number
	private readonly windowMs: number
	private readonly proximityPx: number
	private callback: ((rageClick: RageClick) => void) | null = null

	constructor(options: { threshold?: number; windowMs?: number; proximityPx?: number } = {}) {
		this.threshold = options.threshold ?? 3
		this.windowMs = options.windowMs ?? 1000
		this.proximityPx = options.proximityPx ?? 30
	}

	/**
	 * Set callback for rage click detection
	 */
	onRageClick(callback: (rageClick: RageClick) => void): void {
		this.callback = callback
	}

	/**
	 * Record a click event
	 */
	recordClick(event: MouseEvent): RageClick | null {
		const now = Date.now()
		const target = event.target as Element | null

		// Build selector for target
		const selector = this.buildSelector(target)

		const clickEvent: ClickEvent = {
			timestamp: now,
			x: event.clientX,
			y: event.clientY,
			target,
			selector,
		}

		// Clean old clicks outside window
		this.clickHistory = this.clickHistory.filter((c) => now - c.timestamp < this.windowMs)

		// Add new click
		this.clickHistory.push(clickEvent)

		// Check for rage click
		const rageClick = this.detectRageClick(clickEvent)
		if (rageClick && this.callback) {
			this.callback(rageClick)
		}

		return rageClick
	}

	/**
	 * Check if recent clicks constitute a rage click
	 */
	private detectRageClick(latestClick: ClickEvent): RageClick | null {
		// Filter clicks near the latest click
		const nearbyClicks = this.clickHistory.filter((c) => {
			const dx = Math.abs(c.x - latestClick.x)
			const dy = Math.abs(c.y - latestClick.y)
			const distance = Math.sqrt(dx * dx + dy * dy)
			return distance < this.proximityPx
		})

		if (nearbyClicks.length >= this.threshold) {
			const firstClick = nearbyClicks[0]!
			const lastClick = nearbyClicks[nearbyClicks.length - 1]!

			return {
				timestamp: latestClick.timestamp,
				element: this.getElementDescription(latestClick.target),
				selector: latestClick.selector,
				clickCount: nearbyClicks.length,
				duration: lastClick.timestamp - firstClick.timestamp,
			}
		}

		return null
	}

	/**
	 * Build a CSS selector for an element
	 */
	private buildSelector(element: Element | null): string {
		if (!element) return 'unknown'

		if (element.id) {
			return `#${CSS.escape(element.id)}`
		}

		const classes = Array.from(element.classList)
			.slice(0, 2)
			.map((c) => `.${CSS.escape(c)}`)
			.join('')

		const tag = element.tagName.toLowerCase()

		if (classes) {
			return `${tag}${classes}`
		}

		return tag
	}

	/**
	 * Get human-readable description of element
	 */
	private getElementDescription(element: Element | null): string {
		if (!element) return 'unknown element'

		const tag = element.tagName.toLowerCase()
		const text = element.textContent?.slice(0, 50).trim() || ''
		const role = element.getAttribute('role') || ''

		if (text) {
			return `${tag}[${text}]`
		}

		if (role) {
			return `${tag}[role=${role}]`
		}

		return tag
	}

	/**
	 * Reset detector state
	 */
	reset(): void {
		this.clickHistory = []
	}
}

// ==========================================
// Dead Click Detection
// ==========================================

/**
 * Dead click detector
 *
 * Detects clicks that had no visible effect:
 * - No navigation
 * - No DOM change
 * - No network request
 */
export class DeadClickDetector {
	private pendingClick: {
		event: MouseEvent
		timestamp: number
		domSnapshot: string
		url: string
	} | null = null

	private observer: MutationObserver | null = null
	private networkActivity = false
	private readonly timeout: number
	private callback: ((deadClick: DeadClick) => void) | null = null

	constructor(options: { timeout?: number } = {}) {
		this.timeout = options.timeout ?? 500
		this.setupNetworkMonitor()
	}

	/**
	 * Set callback for dead click detection
	 */
	onDeadClick(callback: (deadClick: DeadClick) => void): void {
		this.callback = callback
	}

	/**
	 * Record a click and monitor for effects
	 */
	recordClick(event: MouseEvent): void {
		const target = event.target as Element
		if (!target) return

		// Skip if element is inherently non-interactive
		if (this.isNonInteractive(target)) return

		this.pendingClick = {
			event,
			timestamp: Date.now(),
			domSnapshot: document.body.innerHTML.slice(0, 1000),
			url: window.location.href,
		}

		this.networkActivity = false
		this.startMutationObserver()

		// Check after timeout
		setTimeout(() => this.checkForDeadClick(), this.timeout)
	}

	/**
	 * Check if the click had any effect
	 */
	private checkForDeadClick(): void {
		if (!this.pendingClick) return

		const click = this.pendingClick
		const target = click.event.target as Element

		// Check for navigation
		if (window.location.href !== click.url) {
			this.pendingClick = null
			return
		}

		// Check for DOM changes
		const currentSnapshot = document.body.innerHTML.slice(0, 1000)
		if (currentSnapshot !== click.domSnapshot) {
			this.pendingClick = null
			return
		}

		// Check for network activity
		if (this.networkActivity) {
			this.pendingClick = null
			return
		}

		// This was a dead click
		const deadClick: DeadClick = {
			timestamp: click.timestamp,
			element: this.getElementDescription(target),
			selector: this.buildSelector(target),
			expectedAction: this.inferExpectedAction(target),
		}

		if (this.callback) {
			this.callback(deadClick)
		}

		this.pendingClick = null
	}

	/**
	 * Check if element is naturally non-interactive
	 */
	private isNonInteractive(element: Element): boolean {
		const nonInteractiveTags = new Set([
			'div',
			'span',
			'p',
			'section',
			'article',
			'header',
			'footer',
			'main',
			'aside',
			'nav',
		])

		const tag = element.tagName.toLowerCase()

		// Interactive elements
		if (
			['a', 'button', 'input', 'select', 'textarea'].includes(tag) ||
			element.hasAttribute('onclick') ||
			element.getAttribute('role') === 'button' ||
			element.hasAttribute('tabindex')
		) {
			return false
		}

		// Check for cursor style
		const style = window.getComputedStyle(element)
		if (style.cursor === 'pointer') {
			return false
		}

		return nonInteractiveTags.has(tag)
	}

	/**
	 * Infer what action the user expected
	 */
	private inferExpectedAction(element: Element): string {
		const tag = element.tagName.toLowerCase()
		const role = element.getAttribute('role')

		if (tag === 'a' || role === 'link') {
			return 'navigation'
		}

		if (tag === 'button' || role === 'button') {
			return 'action'
		}

		if (tag === 'input' || tag === 'select') {
			return 'input focus'
		}

		const text = element.textContent?.slice(0, 30).toLowerCase() || ''

		if (text.includes('submit') || text.includes('save')) {
			return 'form submission'
		}

		if (text.includes('close') || text.includes('cancel')) {
			return 'close/cancel'
		}

		return 'interaction'
	}

	/**
	 * Setup mutation observer
	 */
	private startMutationObserver(): void {
		this.stopMutationObserver()

		this.observer = new MutationObserver(() => {
			// DOM changed, not a dead click
			this.pendingClick = null
		})

		this.observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			characterData: true,
		})
	}

	/**
	 * Stop mutation observer
	 */
	private stopMutationObserver(): void {
		if (this.observer) {
			this.observer.disconnect()
			this.observer = null
		}
	}

	/**
	 * Monitor network activity
	 */
	private setupNetworkMonitor(): void {
		const detector = this

		// Intercept fetch
		const originalFetch = window.fetch.bind(window) as typeof window.fetch
		// biome-ignore lint/suspicious/noExplicitAny: window.fetch type is read-only in TypeScript, cast required for patching
		;(window as any).fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
			detector.networkActivity = true
			return originalFetch(input, init)
		}

		// Intercept XHR
		const originalOpen = XMLHttpRequest.prototype.open
		XMLHttpRequest.prototype.open = function (
			method: string,
			url: string | URL,
			async?: boolean,
			username?: string | null,
			password?: string | null
		) {
			;(this as XMLHttpRequest & { _deadClickActive?: boolean })._deadClickActive = true
			return originalOpen.call(this, method, url, async ?? true, username, password)
		}

		const originalSend = XMLHttpRequest.prototype.send
		XMLHttpRequest.prototype.send = function (body?: XMLHttpRequestBodyInit | null) {
			const xhr = this as XMLHttpRequest & { _deadClickActive?: boolean }
			if (xhr._deadClickActive) {
				detector.networkActivity = true
			}
			return originalSend.call(this, body)
		}
	}

	private buildSelector(element: Element | null): string {
		if (!element) return 'unknown'

		if (element.id) {
			return `#${CSS.escape(element.id)}`
		}

		const classes = Array.from(element.classList)
			.slice(0, 2)
			.map((c) => `.${CSS.escape(c)}`)
			.join('')

		const tag = element.tagName.toLowerCase()
		return classes ? `${tag}${classes}` : tag
	}

	private getElementDescription(element: Element | null): string {
		if (!element) return 'unknown element'

		const tag = element.tagName.toLowerCase()
		const text = element.textContent?.slice(0, 50).trim() || ''
		const role = element.getAttribute('role') || ''

		if (text) return `${tag}[${text}]`
		if (role) return `${tag}[role=${role}]`
		return tag
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		this.stopMutationObserver()
	}
}

// ==========================================
// Scroll Thrashing Detection
// ==========================================

/**
 * Scroll thrashing detector
 *
 * Detects rapid up-down scrolling indicating user confusion
 */
export class ScrollThrashingDetector {
	private scrollHistory: ScrollEvent[] = []
	private lastScrollY = 0
	private readonly threshold: number
	private readonly windowMs: number
	private callback: ((event: { timestamp: number; reversals: number }) => void) | null = null

	constructor(options: { threshold?: number; windowMs?: number } = {}) {
		this.threshold = options.threshold ?? 4
		this.windowMs = options.windowMs ?? 2000
	}

	onThrashing(callback: (event: { timestamp: number; reversals: number }) => void): void {
		this.callback = callback
	}

	recordScroll(scrollY: number): void {
		const now = Date.now()
		const direction: 'up' | 'down' = scrollY > this.lastScrollY ? 'down' : 'up'

		// Clean old events
		this.scrollHistory = this.scrollHistory.filter((e) => now - e.timestamp < this.windowMs)

		// Only record direction changes
		const lastEvent = this.scrollHistory[this.scrollHistory.length - 1]
		if (!lastEvent || lastEvent.direction !== direction) {
			this.scrollHistory.push({ timestamp: now, scrollY, direction })
		}

		this.lastScrollY = scrollY

		// Check for thrashing (direction reversals)
		if (this.scrollHistory.length >= this.threshold) {
			if (this.callback) {
				this.callback({
					timestamp: now,
					reversals: this.scrollHistory.length,
				})
			}
			this.scrollHistory = []
		}
	}

	reset(): void {
		this.scrollHistory = []
	}
}
