/**
 * Notification Template Utilities
 *
 * Create and render notification templates.
 *
 * @example
 * ```typescript
 * import { createTemplate, renderNotification, COMMON_TEMPLATES } from '@sylphx/platform-sdk/notifications'
 *
 * // Create a custom template
 * const orderTemplate = createTemplate({
 *   id: 'order-shipped',
 *   name: 'Order Shipped',
 *   category: 'transactional',
 *   title: 'Your order #{{orderNumber}} has shipped!',
 *   body: 'Tracking: {{trackingNumber}}. Expected delivery: {{deliveryDate}}.',
 *   url: 'https://app.example.com/orders/{{orderId}}',
 * })
 *
 * // Render with data
 * const notification = renderNotification(orderTemplate, {
 *   orderNumber: '12345',
 *   orderId: 'abc123',
 *   trackingNumber: '1Z999AA10123456784',
 *   deliveryDate: 'Dec 25, 2024',
 * })
 *
 * // Use pre-built templates
 * const welcome = renderNotification(COMMON_TEMPLATES.welcome, {
 *   userName: 'John',
 * })
 * ```
 */

import type {
	NotificationTemplate,
	TemplateVariable,
	RenderedNotification,
	NotificationCategory,
	NotificationChannel,
	NotificationPriority,
} from './types'

// ============================================================================
// Template Creation
// ============================================================================

/**
 * Create a notification template
 *
 * @param config - Template configuration
 * @returns Notification template
 */
export function createTemplate(config: {
	id: string
	name: string
	category?: NotificationCategory
	channels?: NotificationChannel[]
	title: string
	body: string
	icon?: string
	image?: string
	url?: string
	variables?: TemplateVariable[]
	priority?: NotificationPriority
	ttl?: number
}): NotificationTemplate {
	const {
		id,
		name,
		category = 'transactional',
		channels = ['push', 'in-app'],
		title,
		body,
		icon,
		image,
		url,
		priority,
		ttl,
	} = config

	// Extract variables from templates if not provided
	const content = `${title} ${body} ${url ?? ''}`
	const variableMatches = content.match(/\{\{(\w+)\}\}/g) ?? []
	const templateVarNames = [...new Set(variableMatches.map((m) => m.slice(2, -2)))]

	const variables = config.variables ?? templateVarNames.map((name) => ({
		name,
		type: 'string' as const,
		required: true,
	}))

	return {
		id,
		name,
		category,
		channels,
		title,
		body,
		icon,
		image,
		url,
		variables,
		priority,
		ttl,
	}
}

// ============================================================================
// Template Rendering
// ============================================================================

/**
 * Render a notification template with data
 *
 * @param template - Notification template
 * @param data - Variable values
 * @returns Rendered notification
 */
export function renderNotification(
	template: NotificationTemplate,
	data: Record<string, unknown>
): RenderedNotification {
	// Validate required variables
	for (const variable of template.variables) {
		if (variable.required && !(variable.name in data) && !variable.default) {
			throw new Error(`Missing required variable: ${variable.name}`)
		}
	}

	// Build substitution map
	const values: Record<string, string> = {}
	for (const variable of template.variables) {
		const value = data[variable.name] ?? variable.default

		if (value !== undefined) {
			values[variable.name] = formatValue(value, variable.type)
		}
	}

	// Render each field
	const title = substituteVariables(template.title, values)
	const body = substituteVariables(template.body, values)
	const icon = template.icon ? substituteVariables(template.icon, values) : undefined
	const image = template.image ? substituteVariables(template.image, values) : undefined
	const url = template.url ? substituteVariables(template.url, values) : undefined

	return {
		title,
		body,
		icon,
		image,
		url,
		data: data as Record<string, unknown>,
	}
}

/**
 * Substitute variables in a string
 */
function substituteVariables(
	template: string,
	values: Record<string, string>
): string {
	return template.replace(/\{\{(\w+)\}\}/g, (match, name) => {
		return values[name] ?? match
	})
}

/**
 * Format a value for insertion
 */
function formatValue(value: unknown, type: string): string {
	if (value === null || value === undefined) return ''

	switch (type) {
		case 'date':
			if (value instanceof Date) {
				return value.toLocaleDateString('en-US', {
					year: 'numeric',
					month: 'short',
					day: 'numeric',
				})
			}
			return new Date(String(value)).toLocaleDateString()

		case 'number':
			return Number(value).toLocaleString()

		case 'boolean':
			return value ? 'Yes' : 'No'

		case 'url':
			return encodeURI(String(value))

		default:
			return String(value)
	}
}

// ============================================================================
// Template Validation
// ============================================================================

/**
 * Validate a notification template
 *
 * @param template - Template to validate
 * @returns Validation result
 */
export function validateTemplate(
	template: NotificationTemplate
): { valid: boolean; errors: string[] } {
	const errors: string[] = []

	// Check required fields
	if (!template.id) errors.push('Template ID is required')
	if (!template.name) errors.push('Template name is required')
	if (!template.title) errors.push('Title is required')
	if (!template.body) errors.push('Body is required')

	// Check for unclosed variables
	const content = `${template.title} ${template.body} ${template.url ?? ''}`
	const openBraces = (content.match(/\{\{/g) ?? []).length
	const closeBraces = (content.match(/\}\}/g) ?? []).length

	if (openBraces !== closeBraces) {
		errors.push('Unclosed variable braces detected')
	}

	// Check for undefined variables
	const variableNames = new Set(template.variables.map((v) => v.name))
	const usedVariables = content.match(/\{\{(\w+)\}\}/g) ?? []

	for (const match of usedVariables) {
		const name = match.slice(2, -2)
		if (!variableNames.has(name)) {
			errors.push(`Undefined variable: ${name}`)
		}
	}

	// Check channels
	if (!template.channels || template.channels.length === 0) {
		errors.push('At least one channel is required')
	}

	return {
		valid: errors.length === 0,
		errors,
	}
}

/**
 * Extract variables from a template string
 */
export function extractVariables(template: string): string[] {
	const matches = template.match(/\{\{(\w+)\}\}/g) ?? []
	return [...new Set(matches.map((m) => m.slice(2, -2)))]
}

// ============================================================================
// Common Templates
// ============================================================================

/**
 * Pre-built common notification templates
 */
export const COMMON_TEMPLATES = {
	/**
	 * Welcome notification
	 */
	welcome: createTemplate({
		id: 'welcome',
		name: 'Welcome',
		category: 'transactional',
		title: 'Welcome, {{userName}}! 👋',
		body: 'Thanks for joining! Get started by exploring our features.',
		icon: '/icons/welcome.png',
		url: '/getting-started',
	}),

	/**
	 * New message notification
	 */
	newMessage: createTemplate({
		id: 'new-message',
		name: 'New Message',
		category: 'social',
		title: 'New message from {{senderName}}',
		body: '{{messagePreview}}',
		icon: '/icons/message.png',
		url: '/messages/{{conversationId}}',
	}),

	/**
	 * Order confirmation
	 */
	orderConfirmation: createTemplate({
		id: 'order-confirmation',
		name: 'Order Confirmation',
		category: 'transactional',
		title: 'Order #{{orderNumber}} confirmed! 🎉',
		body: 'Your order of {{itemCount}} items totaling {{orderTotal}} has been confirmed.',
		icon: '/icons/order.png',
		url: '/orders/{{orderId}}',
	}),

	/**
	 * Payment received
	 */
	paymentReceived: createTemplate({
		id: 'payment-received',
		name: 'Payment Received',
		category: 'transactional',
		title: 'Payment received: {{amount}}',
		body: 'We received your payment for invoice #{{invoiceNumber}}.',
		icon: '/icons/payment.png',
		url: '/billing/invoices/{{invoiceId}}',
	}),

	/**
	 * Comment notification
	 */
	newComment: createTemplate({
		id: 'new-comment',
		name: 'New Comment',
		category: 'social',
		title: '{{userName}} commented on your {{itemType}}',
		body: '"{{commentPreview}}"',
		icon: '/icons/comment.png',
		url: '/{{itemType}}s/{{itemId}}#comment-{{commentId}}',
	}),

	/**
	 * Reminder notification
	 */
	reminder: createTemplate({
		id: 'reminder',
		name: 'Reminder',
		category: 'reminders',
		title: 'Reminder: {{reminderTitle}}',
		body: '{{reminderDescription}}',
		icon: '/icons/reminder.png',
		url: '/reminders/{{reminderId}}',
	}),

	/**
	 * System alert
	 */
	systemAlert: createTemplate({
		id: 'system-alert',
		name: 'System Alert',
		category: 'alerts',
		title: '⚠️ {{alertTitle}}',
		body: '{{alertMessage}}',
		icon: '/icons/alert.png',
		url: '/system/alerts/{{alertId}}',
		priority: 'high',
	}),

	/**
	 * Feature announcement
	 */
	featureAnnouncement: createTemplate({
		id: 'feature-announcement',
		name: 'Feature Announcement',
		category: 'updates',
		title: '✨ New: {{featureName}}',
		body: '{{featureDescription}}',
		icon: '/icons/new-feature.png',
		url: '/changelog/{{changelogId}}',
	}),

	/**
	 * Security alert
	 */
	securityAlert: createTemplate({
		id: 'security-alert',
		name: 'Security Alert',
		category: 'alerts',
		title: '🔐 Security Alert',
		body: '{{alertMessage}} from {{location}} on {{device}}.',
		icon: '/icons/security.png',
		url: '/security/activity',
		priority: 'high',
	}),

	/**
	 * Subscription renewal
	 */
	subscriptionRenewal: createTemplate({
		id: 'subscription-renewal',
		name: 'Subscription Renewal',
		category: 'transactional',
		title: 'Your subscription renews soon',
		body: 'Your {{planName}} subscription will renew on {{renewalDate}} for {{amount}}.',
		icon: '/icons/subscription.png',
		url: '/billing/subscription',
	}),
}
