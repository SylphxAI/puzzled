/**
 * Email Template Utilities
 *
 * Build and render email templates with variable substitution.
 *
 * @example
 * ```typescript
 * import { createEmailTemplate, renderEmail, renderSubject } from '@sylphx/platform-sdk/email'
 *
 * // Create a template
 * const welcomeTemplate = createEmailTemplate({
 *   id: 'welcome',
 *   name: 'Welcome Email',
 *   subject: 'Welcome to {{appName}}, {{userName}}!',
 *   html: '<h1>Welcome, {{userName}}!</h1><p>Thanks for joining {{appName}}.</p>',
 *   variables: [
 *     { name: 'appName', type: 'string', required: true },
 *     { name: 'userName', type: 'string', required: true },
 *   ],
 * })
 *
 * // Render with data
 * const rendered = renderEmail(welcomeTemplate, {
 *   appName: 'Sylphx',
 *   userName: 'John',
 * })
 *
 * console.log(rendered.subject) // 'Welcome to Sylphx, John!'
 * console.log(rendered.html)    // '<h1>Welcome, John!</h1>...'
 * ```
 */

import type {
	EmailTemplate,
	TemplateVariable,
	RenderedEmail,
} from './types'

// ============================================================================
// Template Creation
// ============================================================================

/**
 * Create an email template
 *
 * @param config - Template configuration
 * @returns Validated email template
 */
export function createEmailTemplate(config: {
	id: string
	name: string
	subject: string
	html: string
	text?: string
	variables?: TemplateVariable[]
	category?: EmailTemplate['category']
}): EmailTemplate {
	const { id, name, subject, html, text, category = 'transactional' } = config

	// Extract variables from template if not provided
	const templateContent = subject + html + (text ?? '')
	const variableMatches = templateContent.match(/\{\{(\w+)\}\}/g) ?? []
	const templateVarNames = [...new Set(variableMatches.map((m) => m.slice(2, -2)))]

	const variables = config.variables ?? templateVarNames.map((name) => ({
		name,
		type: 'string' as const,
		required: true,
	}))

	// Validate all template variables are defined
	for (const varName of templateVarNames) {
		if (!variables.some((v) => v.name === varName)) {
			throw new Error(`Template variable '${varName}' is not defined`)
		}
	}

	return {
		id,
		name,
		subject,
		html,
		text,
		variables,
		category,
	}
}

// ============================================================================
// Template Rendering
// ============================================================================

/**
 * Render an email template with data
 *
 * @param template - Email template
 * @param data - Variable values
 * @returns Rendered email
 */
export function renderEmail(
	template: EmailTemplate,
	data: Record<string, unknown>
): RenderedEmail {
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

	// Render subject
	const subject = substituteVariables(template.subject, values)

	// Render HTML
	const html = substituteVariables(template.html, values)

	// Render text (generate from HTML if not provided)
	const text = template.text
		? substituteVariables(template.text, values)
		: htmlToText(html)

	return { subject, html, text }
}

/**
 * Render just the subject line
 */
export function renderSubject(
	template: EmailTemplate | string,
	data: Record<string, unknown>
): string {
	const subjectTemplate = typeof template === 'string' ? template : template.subject
	const values: Record<string, string> = {}

	for (const [key, value] of Object.entries(data)) {
		values[key] = formatValue(value, 'string')
	}

	return substituteVariables(subjectTemplate, values)
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
					month: 'long',
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

		case 'html':
			return String(value) // Don't escape HTML

		default:
			return escapeHtml(String(value))
	}
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
	const map: Record<string, string> = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#039;',
	}
	return text.replace(/[&<>"']/g, (c) => map[c])
}

/**
 * Convert HTML to plain text
 */
function htmlToText(html: string): string {
	return html
		// Remove script and style tags
		.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
		.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
		// Convert line breaks
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/p>/gi, '\n\n')
		.replace(/<\/div>/gi, '\n')
		.replace(/<\/h[1-6]>/gi, '\n\n')
		// Convert links to text with URL
		.replace(/<a[^>]+href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)')
		// Remove all other tags
		.replace(/<[^>]*>/g, '')
		// Decode HTML entities
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#039;/g, "'")
		// Clean up whitespace
		.replace(/\n\s*\n/g, '\n\n')
		.trim()
}

// ============================================================================
// Template Validation
// ============================================================================

/**
 * Validate template syntax
 *
 * @param template - Template to validate
 * @returns Validation result
 */
export function validateTemplate(
	template: EmailTemplate
): { valid: boolean; errors: string[] } {
	const errors: string[] = []

	// Check for required fields
	if (!template.id) errors.push('Template ID is required')
	if (!template.name) errors.push('Template name is required')
	if (!template.subject) errors.push('Subject is required')
	if (!template.html) errors.push('HTML body is required')

	// Check for unclosed variables
	const content = template.subject + template.html + (template.text ?? '')
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

	// Check for unused variables
	for (const variable of template.variables) {
		const pattern = new RegExp(`\\{\\{${variable.name}\\}\\}`)
		if (!pattern.test(content)) {
			errors.push(`Unused variable: ${variable.name}`)
		}
	}

	return {
		valid: errors.length === 0,
		errors,
	}
}

/**
 * Get variables used in a template string
 */
export function extractVariables(template: string): string[] {
	const matches = template.match(/\{\{(\w+)\}\}/g) ?? []
	return [...new Set(matches.map((m) => m.slice(2, -2)))]
}

// ============================================================================
// Common Templates
// ============================================================================

/**
 * Pre-built common email templates
 */
export const COMMON_TEMPLATES = {
	/**
	 * Welcome email template
	 */
	welcome: createEmailTemplate({
		id: 'welcome',
		name: 'Welcome',
		subject: 'Welcome to {{appName}}!',
		html: `
			<h1>Welcome, {{userName}}!</h1>
			<p>Thanks for joining {{appName}}. We're excited to have you.</p>
			<p><a href="{{ctaUrl}}">Get Started</a></p>
		`,
		variables: [
			{ name: 'appName', type: 'string', required: true },
			{ name: 'userName', type: 'string', required: true },
			{ name: 'ctaUrl', type: 'url', required: true },
		],
	}),

	/**
	 * Password reset template
	 */
	passwordReset: createEmailTemplate({
		id: 'password-reset',
		name: 'Password Reset',
		subject: 'Reset your {{appName}} password',
		html: `
			<h1>Reset Your Password</h1>
			<p>Hi {{userName}},</p>
			<p>We received a request to reset your password. Click the button below to create a new password:</p>
			<p><a href="{{resetUrl}}">Reset Password</a></p>
			<p>This link expires in {{expiryTime}}.</p>
			<p>If you didn't request this, you can safely ignore this email.</p>
		`,
		variables: [
			{ name: 'appName', type: 'string', required: true },
			{ name: 'userName', type: 'string', required: true },
			{ name: 'resetUrl', type: 'url', required: true },
			{ name: 'expiryTime', type: 'string', default: '1 hour' },
		],
	}),

	/**
	 * Email verification template
	 */
	verifyEmail: createEmailTemplate({
		id: 'verify-email',
		name: 'Verify Email',
		subject: 'Verify your email address',
		html: `
			<h1>Verify Your Email</h1>
			<p>Hi {{userName}},</p>
			<p>Please verify your email address by clicking the button below:</p>
			<p><a href="{{verifyUrl}}">Verify Email</a></p>
			<p>This link expires in {{expiryTime}}.</p>
		`,
		variables: [
			{ name: 'userName', type: 'string', required: true },
			{ name: 'verifyUrl', type: 'url', required: true },
			{ name: 'expiryTime', type: 'string', default: '24 hours' },
		],
	}),

	/**
	 * Invoice template
	 */
	invoice: createEmailTemplate({
		id: 'invoice',
		name: 'Invoice',
		subject: 'Invoice #{{invoiceNumber}} from {{appName}}',
		html: `
			<h1>Invoice #{{invoiceNumber}}</h1>
			<p>Hi {{customerName}},</p>
			<p>Here's your invoice for {{amount}}.</p>
			<p>Due date: {{dueDate}}</p>
			<p><a href="{{invoiceUrl}}">View Invoice</a></p>
		`,
		variables: [
			{ name: 'appName', type: 'string', required: true },
			{ name: 'invoiceNumber', type: 'string', required: true },
			{ name: 'customerName', type: 'string', required: true },
			{ name: 'amount', type: 'string', required: true },
			{ name: 'dueDate', type: 'date', required: true },
			{ name: 'invoiceUrl', type: 'url', required: true },
		],
		category: 'transactional',
	}),
}
