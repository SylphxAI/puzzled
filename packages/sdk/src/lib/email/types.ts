/**
 * Email Types
 *
 * Type definitions for email validation and templates.
 */

// ============================================================================
// Email Address Types
// ============================================================================

/**
 * Email validation result
 */
export interface EmailValidationResult {
	/** Whether the email is valid */
	valid: boolean
	/** Normalized email (lowercase, trimmed) */
	normalized?: string
	/** Error message if invalid */
	error?: string
	/** Warning messages (valid but might have issues) */
	warnings?: string[]
	/** Parsed email parts */
	parsed?: ParsedEmail
}

/**
 * Parsed email address parts
 */
export interface ParsedEmail {
	/** Local part (before @) */
	local: string
	/** Domain part (after @) */
	domain: string
	/** Subdomain if present */
	subdomain?: string
	/** Top-level domain */
	tld: string
}

/**
 * Email provider information
 */
export interface EmailProvider {
	/** Provider name (e.g., 'Gmail', 'Outlook') */
	name: string
	/** Provider domains */
	domains: string[]
	/** Whether provider is free */
	isFree: boolean
	/** Whether disposable/temporary */
	isDisposable: boolean
}

// ============================================================================
// Template Types
// ============================================================================

/**
 * Email template variable
 */
export interface TemplateVariable {
	/** Variable name */
	name: string
	/** Variable type */
	type: 'string' | 'number' | 'boolean' | 'date' | 'url' | 'html'
	/** Whether required */
	required?: boolean
	/** Default value */
	default?: string
	/** Description */
	description?: string
}

/**
 * Email template definition
 */
export interface EmailTemplate {
	/** Template ID */
	id: string
	/** Template name */
	name: string
	/** Subject line (can contain {{variables}}) */
	subject: string
	/** HTML body template */
	html: string
	/** Plain text body template */
	text?: string
	/** Template variables */
	variables: TemplateVariable[]
	/** Template category */
	category?: 'transactional' | 'marketing' | 'notification'
}

/**
 * Rendered email
 */
export interface RenderedEmail {
	/** Rendered subject */
	subject: string
	/** Rendered HTML body */
	html: string
	/** Rendered plain text body */
	text: string
}

// ============================================================================
// Email Sending Types
// ============================================================================

/**
 * Email recipient
 */
export interface EmailRecipient {
	/** Email address */
	email: string
	/** Display name (optional) */
	name?: string
}

/**
 * Email attachment
 */
export interface EmailAttachment {
	/** Filename */
	filename: string
	/** Content (base64 or URL) */
	content: string
	/** Content type */
	contentType: string
	/** Whether content is a URL to fetch */
	isUrl?: boolean
}

/**
 * Email options for sending
 */
export interface EmailOptions {
	/** To recipients */
	to: EmailRecipient | EmailRecipient[] | string | string[]
	/** CC recipients */
	cc?: EmailRecipient | EmailRecipient[] | string | string[]
	/** BCC recipients */
	bcc?: EmailRecipient | EmailRecipient[] | string | string[]
	/** From address */
	from?: EmailRecipient | string
	/** Reply-to address */
	replyTo?: EmailRecipient | string
	/** Subject line */
	subject: string
	/** HTML body */
	html?: string
	/** Plain text body */
	text?: string
	/** Attachments */
	attachments?: EmailAttachment[]
	/** Custom headers */
	headers?: Record<string, string>
	/** Tags for analytics */
	tags?: string[]
	/** Scheduled send time (ISO string) */
	scheduledAt?: string
}

// ============================================================================
// Validation Options
// ============================================================================

/**
 * Email validation options
 */
export interface ValidationOptions {
	/** Check MX records (requires async) */
	checkMx?: boolean
	/** Allow plus addressing (user+tag@example.com) */
	allowPlusAddressing?: boolean
	/** Allow subdomains */
	allowSubdomains?: boolean
	/** Block disposable email providers */
	blockDisposable?: boolean
	/** Block free email providers */
	blockFree?: boolean
	/** Allowed domains (whitelist) */
	allowedDomains?: string[]
	/** Blocked domains (blacklist) */
	blockedDomains?: string[]
	/** Maximum local part length (default: 64) */
	maxLocalLength?: number
	/** Maximum domain length (default: 255) */
	maxDomainLength?: number
}

// ============================================================================
// Unsubscribe Types
// ============================================================================

/**
 * List-Unsubscribe header format
 */
export interface UnsubscribeHeader {
	/** One-click unsubscribe URL */
	url: string
	/** Mailto unsubscribe address */
	mailto?: string
}

/**
 * Unsubscribe link configuration
 */
export interface UnsubscribeConfig {
	/** Base URL for unsubscribe endpoint */
	baseUrl: string
	/** Secret for signing tokens */
	secret: string
	/** Token expiry in seconds (default: 7 days) */
	expirySeconds?: number
}
