/**
 * Smart Autocapture
 *
 * Automatic event capture with intelligent element targeting.
 * Captures clicks, form submissions, and other interactions.
 */

import type { AutocaptureConfig, ElementData } from './types'
import { DEFAULT_AUTOCAPTURE_CONFIG } from './types'
import { generateElementName, generateEventName, buildElementChain } from './element-naming'

// ==========================================
// Types
// ==========================================

export interface AutocaptureEvent {
	eventType: 'click' | 'submit' | 'change' | 'focus' | 'blur'
	target: Element
	elements: ElementData[]
	elementName: string
	eventName: string
	timestamp: number
	properties: Record<string, unknown>
}

type AutocaptureCallback = (event: AutocaptureEvent) => void

// ==========================================
// Autocapture Class
// ==========================================

/**
 * Smart Autocapture
 *
 * Captures user interactions with meaningful event names.
 */
export class Autocapture {
	private config: AutocaptureConfig
	private callback: AutocaptureCallback
	private isEnabled = false
	private boundHandlers: Map<string, EventListener> = new Map()

	constructor(callback: AutocaptureCallback, config: Partial<AutocaptureConfig> = {}) {
		this.config = { ...DEFAULT_AUTOCAPTURE_CONFIG, ...config }
		this.callback = callback
	}

	// ==========================================
	// Lifecycle
	// ==========================================

	/**
	 * Start autocapture
	 */
	start(): void {
		if (typeof window === 'undefined') return
		if (this.isEnabled) return

		this.isEnabled = true
		this.attachListeners()
	}

	/**
	 * Stop autocapture
	 */
	stop(): void {
		if (!this.isEnabled) return

		this.isEnabled = false
		this.detachListeners()
	}

	/**
	 * Check if autocapture is enabled
	 */
	isActive(): boolean {
		return this.isEnabled
	}

	// ==========================================
	// Event Listeners
	// ==========================================

	private attachListeners(): void {
		const eventTypes = this.config.eventTypes || ['click', 'submit', 'change']

		for (const eventType of eventTypes) {
			const handler = this.createHandler(eventType)
			this.boundHandlers.set(eventType, handler)

			// Use capture phase to catch events before they might be stopped
			document.addEventListener(eventType, handler, true)
		}
	}

	private detachListeners(): void {
		for (const [eventType, handler] of this.boundHandlers) {
			document.removeEventListener(eventType, handler, true)
		}
		this.boundHandlers.clear()
	}

	private createHandler(eventType: string): EventListener {
		return (event: Event) => {
			if (!this.isEnabled) return

			const target = event.target as Element | null
			if (!target) return

			// Check if we should capture this element
			if (!this.shouldCapture(target, eventType)) return

			// Find the meaningful element (button inside a link, etc.)
			const meaningfulElement = this.findMeaningfulElement(target, eventType)
			if (!meaningfulElement) return

			// Build the autocapture event
			const autocaptureEvent = this.buildEvent(
				meaningfulElement,
				eventType as AutocaptureEvent['eventType'],
				event
			)

			// Dispatch to callback
			this.callback(autocaptureEvent)
		}
	}

	// ==========================================
	// Element Filtering
	// ==========================================

	private shouldCapture(element: Element, eventType: string): boolean {
		// Check exclude selectors first
		if (this.config.excludeSelectors) {
			for (const selector of this.config.excludeSelectors) {
				if (element.matches(selector) || element.closest(selector)) {
					return false
				}
			}
		}

		// Check for sensitive elements
		if (this.isSensitiveElement(element)) {
			return false
		}

		// Check for autocapture disabled attribute
		if (this.hasDisabledAttribute(element)) {
			return false
		}

		// Check if element is in allowed list
		if (this.config.elements) {
			const isAllowed = this.config.elements.some((selector) => {
				try {
					return element.matches(selector) || !!element.closest(selector)
				} catch {
					return false
				}
			})

			// For click events, be more permissive
			if (!isAllowed && eventType === 'click') {
				// Allow clickable elements
				return this.isClickable(element)
			}

			return isAllowed
		}

		return true
	}

	private isSensitiveElement(element: Element): boolean {
		const tagName = element.tagName.toLowerCase()
		const type = element.getAttribute('type')?.toLowerCase()

		// Password fields
		if (tagName === 'input' && type === 'password') return true

		// Credit card fields (common patterns)
		const name = element.getAttribute('name')?.toLowerCase() || ''
		const id = element.id?.toLowerCase() || ''
		const autocomplete = element.getAttribute('autocomplete')?.toLowerCase() || ''

		const sensitivePatterns = [
			'card',
			'credit',
			'cvv',
			'cvc',
			'ccv',
			'security-code',
			'expir',
			'ssn',
			'social-security',
			'tax-id',
			'pin',
		]

		for (const pattern of sensitivePatterns) {
			if (
				name.includes(pattern) ||
				id.includes(pattern) ||
				autocomplete.includes(pattern)
			) {
				return true
			}
		}

		// Check for data-sensitive attribute
		if (element.hasAttribute('data-sensitive') || element.hasAttribute('data-no-capture')) {
			return true
		}

		return false
	}

	private hasDisabledAttribute(element: Element): boolean {
		// Check element and ancestors for disabled autocapture
		let current: Element | null = element
		while (current) {
			if (
				current.hasAttribute('data-autocapture-disabled') ||
				current.hasAttribute('data-no-track')
			) {
				return true
			}
			current = current.parentElement
		}
		return false
	}

	private isClickable(element: Element): boolean {
		const tagName = element.tagName.toLowerCase()

		// Standard clickable elements
		if (['a', 'button', 'input', 'select', 'textarea'].includes(tagName)) {
			return true
		}

		// Role-based clickable
		const role = element.getAttribute('role')
		if (role && ['button', 'link', 'tab', 'menuitem', 'option'].includes(role)) {
			return true
		}

		// Has click handler (check for event listeners or onclick)
		if (element.hasAttribute('onclick')) {
			return true
		}

		// Check cursor style
		const style = window.getComputedStyle(element)
		if (style.cursor === 'pointer') {
			return true
		}

		return false
	}

	// ==========================================
	// Element Resolution
	// ==========================================

	private findMeaningfulElement(target: Element, eventType: string): Element | null {
		// For submit events, the form is the meaningful element
		if (eventType === 'submit') {
			const form = target.closest('form')
			return form || target
		}

		// For change/focus/blur, the input itself is meaningful
		if (['change', 'focus', 'blur'].includes(eventType)) {
			return target
		}

		// For click, find the most meaningful ancestor
		let current: Element | null = target
		let bestMatch: Element | null = null

		while (current && current !== document.body) {
			// Stop at form boundaries
			if (current.tagName === 'FORM') break

			// Check if this is a good match
			if (this.isMeaningfulClickTarget(current)) {
				bestMatch = current
				// Keep looking for a better match (e.g., the button's link parent)
			}

			current = current.parentElement
		}

		return bestMatch || target
	}

	private isMeaningfulClickTarget(element: Element): boolean {
		const tagName = element.tagName.toLowerCase()

		// Standard interactive elements
		if (['a', 'button'].includes(tagName)) {
			return true
		}

		// Input elements (buttons, etc.)
		if (tagName === 'input') {
			const type = element.getAttribute('type')
			if (['button', 'submit', 'reset'].includes(type || '')) {
				return true
			}
		}

		// Role-based
		const role = element.getAttribute('role')
		if (role && ['button', 'link', 'tab', 'menuitem'].includes(role)) {
			return true
		}

		// Has explicit analytics attribute
		if (
			element.hasAttribute('data-analytics') ||
			element.hasAttribute('data-track')
		) {
			return true
		}

		return false
	}

	// ==========================================
	// Event Building
	// ==========================================

	private buildEvent(
		element: Element,
		eventType: AutocaptureEvent['eventType'],
		originalEvent: Event
	): AutocaptureEvent {
		const elementName = generateElementName(element)
		const eventName = generateEventName(element, eventType)
		const elements = buildElementChain(element)

		const properties: Record<string, unknown> = {
			$event_type: eventType,
			$element_name: elementName,
		}

		// Add element-specific properties
		if (element.tagName === 'A') {
			const href = element.getAttribute('href')
			if (href) {
				properties.$element_href = href
				// Check if external link
				try {
					const url = new URL(href, window.location.origin)
					properties.$external_link = url.origin !== window.location.origin
				} catch {
					// Invalid URL
				}
			}
		}

		// Form submission data
		if (eventType === 'submit' && element.tagName === 'FORM') {
			properties.$form_name = element.getAttribute('name') || element.id || undefined
			properties.$form_action = element.getAttribute('action') || undefined
			properties.$form_method = element.getAttribute('method') || 'GET'
		}

		// Input change data (without values for privacy)
		if (eventType === 'change') {
			const input = element as HTMLInputElement
			properties.$input_type = input.type || element.tagName.toLowerCase()
			properties.$input_name = input.name || undefined

			// For checkboxes/radios, we can capture checked state
			if (input.type === 'checkbox' || input.type === 'radio') {
				properties.$input_checked = input.checked
			}

			// For select, capture selected option text (not value)
			if (element.tagName === 'SELECT') {
				const select = element as HTMLSelectElement
				const selectedOption = select.options[select.selectedIndex]
				if (selectedOption && this.config.captureText) {
					properties.$selected_text = selectedOption.text?.slice(0, 100)
				}
			}
		}

		return {
			eventType,
			target: element,
			elements,
			elementName,
			eventName,
			timestamp: Date.now(),
			properties,
		}
	}
}

// ==========================================
// Factory
// ==========================================

let autocaptureInstance: Autocapture | null = null

/**
 * Initialize autocapture
 */
export function initAutocapture(
	callback: AutocaptureCallback,
	config?: Partial<AutocaptureConfig>
): Autocapture {
	autocaptureInstance = new Autocapture(callback, config)
	return autocaptureInstance
}

/**
 * Get autocapture instance
 */
function getAutocapture(): Autocapture | null {
	return autocaptureInstance
}

/**
 * Start autocapture
 */
function startAutocapture(): void {
	autocaptureInstance?.start()
}

/**
 * Stop autocapture
 */
function stopAutocapture(): void {
	autocaptureInstance?.stop()
}
