/**
 * Smart Element Naming
 *
 * Generates human-readable names for captured elements.
 * Uses hierarchy of identifiers for stable, meaningful names.
 *
 * Priority:
 * 1. data-analytics / data-track attribute
 * 2. aria-label
 * 3. id
 * 4. name
 * 5. Text content
 * 6. Placeholder / value
 * 7. Generated from hierarchy
 */

import type { ElementData } from './types'

// ==========================================
// Name Generation
// ==========================================

/**
 * Generate a human-readable name for an element
 *
 * @param element - Element to name
 * @param ancestors - Parent elements (for context)
 * @returns Human-readable name
 */
export function generateElementName(element: Element, ancestors?: Element[]): string {
	// 1. Explicit analytics attribute
	const analyticsName = getAnalyticsAttribute(element)
	if (analyticsName) return analyticsName

	// 2. ARIA label
	const ariaLabel = element.getAttribute('aria-label')
	if (ariaLabel) return sanitizeText(ariaLabel)

	// 3. ID (if meaningful)
	const id = element.id
	if (id && isMeaningfulId(id)) return humanizeId(id)

	// 4. Name attribute
	const name = element.getAttribute('name')
	if (name) return humanizeName(name)

	// 5. Text content
	const text = getVisibleText(element)
	if (text) return sanitizeText(text)

	// 6. Placeholder / value
	const placeholder = element.getAttribute('placeholder')
	if (placeholder) return `${getElementType(element)} - ${sanitizeText(placeholder)}`

	const value = (element as HTMLInputElement).value
	if (value && element.tagName === 'BUTTON') return sanitizeText(value)

	// 7. Build from context
	return generateContextualName(element, ancestors)
}

/**
 * Generate an event name from element interaction
 *
 * @param element - Interacted element
 * @param eventType - Type of interaction
 * @returns Event name
 */
export function generateEventName(element: Element, eventType: string): string {
	const elementName = generateElementName(element)
	const action = getActionVerb(eventType, element)

	// Clean up the element name for event naming
	const cleanName = elementName
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '_')
		.replace(/-+/g, '_')
		.replace(/^_+|_+$/g, '')

	// Format: action_element
	// e.g., "clicked_signup_button", "submitted_contact_form", "changed_email_input"
	return `${action}_${cleanName}`
}

// ==========================================
// Attribute Helpers
// ==========================================

function getAnalyticsAttribute(element: Element): string | null {
	// Check various analytics attributes
	const attrs = [
		'data-analytics',
		'data-track',
		'data-event',
		'data-analytics-id',
		'data-testid', // Often meaningful for analytics
	]

	for (const attr of attrs) {
		const value = element.getAttribute(attr)
		if (value) return value
	}

	return null
}

function isMeaningfulId(id: string): boolean {
	// Filter out auto-generated IDs
	if (/^[a-f0-9]{8,}$/i.test(id)) return false // UUID-like
	if (/^:r[0-9]+:$/i.test(id)) return false // React auto-generated
	if (/^[a-z]+-[0-9]+$/i.test(id)) return false // component-123 pattern
	if (/^radix-/.test(id)) return false // Radix UI auto IDs
	if (/^headlessui-/.test(id)) return false // Headless UI auto IDs
	if (id.length > 50) return false // Too long = probably generated

	return true
}

function humanizeId(id: string): string {
	// Convert camelCase/snake_case/kebab-case to readable text
	return id
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/[_-]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
}

function humanizeName(name: string): string {
	// Similar to humanizeId but for form field names
	return name
		.replace(/\[\]/g, '') // Remove array notation
		.replace(/\[(\d+)\]/g, ' $1') // Convert [0] to 0
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/[_-]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
}

// ==========================================
// Text Extraction
// ==========================================

function getVisibleText(element: Element): string | null {
	// For buttons, links, etc. - get the visible text
	const tagName = element.tagName.toLowerCase()

	// For inputs, get label text
	if (tagName === 'input' || tagName === 'select' || tagName === 'textarea') {
		return getLabelText(element as HTMLInputElement)
	}

	// For other elements, get direct text content
	let text = ''

	const childNodes = Array.from(element.childNodes)
	for (const node of childNodes) {
		if (node.nodeType === Node.TEXT_NODE) {
			text += node.textContent?.trim() || ''
		}
	}

	// If no direct text, try innerText but limited
	if (!text) {
		const innerText = (element as HTMLElement).innerText
		if (innerText && innerText.length < 100) {
			text = innerText.trim()
		}
	}

	return text || null
}

function getLabelText(input: HTMLInputElement): string | null {
	// 1. Check for explicit label
	const id = input.id
	if (id) {
		const label = document.querySelector(`label[for="${id}"]`)
		if (label) return (label as HTMLElement).innerText?.trim() || null
	}

	// 2. Check for wrapping label
	const parentLabel = input.closest('label')
	if (parentLabel) {
		const labelText = parentLabel.innerText?.trim()
		if (labelText) return labelText
	}

	// 3. Check for aria-labelledby
	const labelledBy = input.getAttribute('aria-labelledby')
	if (labelledBy) {
		const label = document.getElementById(labelledBy)
		if (label) return label.innerText?.trim() || null
	}

	return null
}

// ==========================================
// Context Generation
// ==========================================

function generateContextualName(element: Element, ancestors?: Element[]): string {
	const tagName = element.tagName.toLowerCase()
	const type = getElementType(element)

	// Try to find context from ancestors
	if (ancestors && ancestors.length > 0) {
		for (const ancestor of ancestors) {
			const ancestorName = getContextFromAncestor(ancestor)
			if (ancestorName) {
				return `${type} in ${ancestorName}`
			}
		}
	}

	// Try to find context from surrounding elements
	const form = element.closest('form')
	if (form) {
		const formName = getFormName(form)
		if (formName) {
			return `${type} in ${formName}`
		}
	}

	const section = element.closest('section, article, aside, nav, header, footer, main')
	if (section) {
		const sectionName = getSectionName(section)
		if (sectionName) {
			return `${type} in ${sectionName}`
		}
	}

	// Fallback to just the type with position
	const index = getElementIndex(element)
	if (index > 0) {
		return `${type} ${index}`
	}

	return type
}

function getContextFromAncestor(ancestor: Element): string | null {
	const analyticsName = getAnalyticsAttribute(ancestor)
	if (analyticsName) return analyticsName

	const ariaLabel = ancestor.getAttribute('aria-label')
	if (ariaLabel) return sanitizeText(ariaLabel)

	const id = ancestor.id
	if (id && isMeaningfulId(id)) return humanizeId(id)

	return null
}

function getFormName(form: HTMLFormElement): string | null {
	const name = form.getAttribute('name')
	if (name) return `${humanizeName(name)} form`

	const id = form.id
	if (id && isMeaningfulId(id)) return `${humanizeId(id)} form`

	const ariaLabel = form.getAttribute('aria-label')
	if (ariaLabel) return `${sanitizeText(ariaLabel)} form`

	// Try to infer from heading or legend
	const legend = form.querySelector('legend')
	if (legend) return `${sanitizeText(legend.innerText)} form`

	const heading = form.querySelector('h1, h2, h3, h4, h5, h6')
	if (heading) return `${sanitizeText((heading as HTMLElement).innerText)} form`

	return 'form'
}

function getSectionName(section: Element): string | null {
	const ariaLabel = section.getAttribute('aria-label')
	if (ariaLabel) return sanitizeText(ariaLabel)

	const id = section.id
	if (id && isMeaningfulId(id)) return humanizeId(id)

	const role = section.getAttribute('role')
	if (role) return role

	const heading = section.querySelector('h1, h2, h3, h4, h5, h6')
	if (heading) return sanitizeText((heading as HTMLElement).innerText)

	return section.tagName.toLowerCase()
}

// ==========================================
// Element Type Helpers
// ==========================================

function getElementType(element: Element): string {
	const tagName = element.tagName.toLowerCase()
	const type = element.getAttribute('type')
	const role = element.getAttribute('role')

	// Role-based naming
	if (role) {
		const roleMap: Record<string, string> = {
			button: 'button',
			link: 'link',
			checkbox: 'checkbox',
			radio: 'radio',
			switch: 'switch',
			tab: 'tab',
			menuitem: 'menu item',
			option: 'option',
			textbox: 'input',
			searchbox: 'search',
			combobox: 'dropdown',
			listbox: 'list',
			slider: 'slider',
		}
		if (roleMap[role]) return roleMap[role]
	}

	// Tag-based naming
	const tagMap: Record<string, string> = {
		a: 'link',
		button: 'button',
		select: 'dropdown',
		textarea: 'text area',
		img: 'image',
		video: 'video',
		audio: 'audio',
	}
	if (tagMap[tagName]) return tagMap[tagName]

	// Input type-based naming
	if (tagName === 'input') {
		const typeMap: Record<string, string> = {
			submit: 'submit button',
			button: 'button',
			checkbox: 'checkbox',
			radio: 'radio',
			text: 'text input',
			email: 'email input',
			password: 'password input',
			search: 'search input',
			tel: 'phone input',
			url: 'URL input',
			number: 'number input',
			date: 'date input',
			time: 'time input',
			file: 'file input',
			color: 'color picker',
			range: 'slider',
		}
		return typeMap[type || ''] || 'input'
	}

	return tagName
}

function getActionVerb(eventType: string, element: Element): string {
	const tagName = element.tagName.toLowerCase()
	const type = element.getAttribute('type')

	// Event type based
	const actionMap: Record<string, string> = {
		click: 'clicked',
		submit: 'submitted',
		change: 'changed',
		focus: 'focused',
		blur: 'left',
		input: 'updated',
	}

	// Special cases for toggle elements
	if (eventType === 'change') {
		if (tagName === 'input' && (type === 'checkbox' || type === 'radio')) {
			return 'toggled'
		}
		if (tagName === 'select') {
			return 'selected'
		}
	}

	return actionMap[eventType] || eventType
}

function getElementIndex(element: Element): number {
	const parent = element.parentElement
	if (!parent) return 0

	const siblings = Array.from(parent.children).filter(
		(child) => child.tagName === element.tagName
	)

	if (siblings.length <= 1) return 0
	return siblings.indexOf(element) + 1
}

// ==========================================
// Text Sanitization
// ==========================================

function sanitizeText(text: string): string {
	return text
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 100) // Limit length
		.replace(/[<>]/g, '') // Remove potential HTML
}

// ==========================================
// Element Data Builder
// ==========================================

/**
 * Build element data from a DOM element
 */
export function buildElementData(element: Element): ElementData {
	const data: ElementData = {
		tag_name: element.tagName.toLowerCase(),
	}

	// Text content
	const text = getVisibleText(element)
	if (text) {
		data.$el_text = sanitizeText(text)
	}

	// Standard attributes
	const attrs = [
		'id',
		'class',
		'href',
		'name',
		'type',
		'value',
		'placeholder',
		'role',
		'aria-label',
		'data-testid',
		'data-analytics',
	]

	for (const attr of attrs) {
		const value = element.getAttribute(attr)
		if (value) {
			const key = `attr__${attr.replace(/-/g, '_')}`
			;(data as unknown as Record<string, unknown>)[key] = value.slice(0, 200) // Limit attribute length
		}
	}

	// Position in parent
	const parent = element.parentElement
	if (parent) {
		const siblings = Array.from(parent.children)
		const sameTagSiblings = siblings.filter((s) => s.tagName === element.tagName)

		data.nth_child = siblings.indexOf(element) + 1
		if (sameTagSiblings.length > 1) {
			data.nth_of_type = sameTagSiblings.indexOf(element) + 1
		}
	}

	return data
}

/**
 * Build element chain (element + ancestors)
 */
export function buildElementChain(element: Element, maxDepth: number = 5): ElementData[] {
	const chain: ElementData[] = []
	let current: Element | null = element
	let depth = 0

	while (current && depth < maxDepth) {
		// Skip html and body
		if (current.tagName === 'HTML' || current.tagName === 'BODY') {
			break
		}

		chain.push(buildElementData(current))
		current = current.parentElement
		depth++
	}

	return chain
}
