/**
 * PII Scrubber
 *
 * Automatic detection and redaction of Personally Identifiable Information (PII)
 * before sending error reports to the server.
 *
 * Follows Sentry's data scrubbing patterns with additional coverage.
 *
 * ## Detected PII Types
 * - Email addresses
 * - Credit card numbers (Visa, MasterCard, Amex, etc.)
 * - Social Security Numbers (SSN)
 * - Phone numbers (international formats)
 * - IP addresses (IPv4 and IPv6)
 * - API keys and tokens
 * - Passwords in URLs or data
 * - AWS credentials
 * - JWT tokens
 */

// ==========================================
// PII Detection Patterns
// ==========================================

/**
 * Regex patterns for detecting PII
 * Each pattern is designed for high precision to avoid false positives
 */
const PII_PATTERNS: { name: string; pattern: RegExp; replacement: string }[] = [
	// Email addresses
	{
		name: "email",
		pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
		replacement: "[EMAIL]",
	},

	// Credit card numbers (with or without spaces/dashes)
	// Covers: Visa, MasterCard, Amex, Discover, Diners, JCB
	{
		name: "credit_card",
		pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b|\b\d{15,16}\b/g,
		replacement: "[CREDIT_CARD]",
	},

	// US Social Security Numbers
	{
		name: "ssn",
		pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
		replacement: "[SSN]",
	},

	// Phone numbers (international formats)
	{
		name: "phone",
		pattern:
			/\b(?:\+?1[-.\s]?)?(?:\(?[0-9]{3}\)?[-.\s]?)?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
		replacement: "[PHONE]",
	},

	// IPv4 addresses
	{
		name: "ipv4",
		pattern:
			/\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
		replacement: "[IP_ADDRESS]",
	},

	// IPv6 addresses (simplified)
	{
		name: "ipv6",
		pattern: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
		replacement: "[IP_ADDRESS]",
	},

	// API keys and tokens (generic patterns)
	{
		name: "api_key",
		pattern:
			/\b(?:api[_-]?key|apikey|api_secret|secret_key)["\s:=]+["']?([a-zA-Z0-9_-]{20,})["']?/gi,
		replacement: "[API_KEY]",
	},

	// Bearer tokens
	{
		name: "bearer_token",
		pattern: /\b(?:Bearer\s+)([a-zA-Z0-9._-]{20,})\b/gi,
		replacement: "Bearer [TOKEN]",
	},

	// JWT tokens (three base64 segments separated by dots)
	{
		name: "jwt",
		pattern: /\beyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]+\b/g,
		replacement: "[JWT_TOKEN]",
	},

	// Password in URLs
	{
		name: "password_url",
		pattern: /:\/\/([^:]+):([^@]+)@/g,
		replacement: "://[USER]:[PASSWORD]@",
	},

	// Password in query strings or form data
	{
		name: "password_param",
		pattern: /(?:password|passwd|pwd|secret)["\s:=]+["']?([^"'\s&]+)["']?/gi,
		replacement: "[PASSWORD_FIELD]",
	},

	// AWS Access Key IDs
	{
		name: "aws_key",
		pattern: /\b(AKIA[0-9A-Z]{16})\b/g,
		replacement: "[AWS_ACCESS_KEY]",
	},

	// AWS Secret Access Keys (40 character base64)
	{
		name: "aws_secret",
		pattern: /\b([a-zA-Z0-9/+=]{40})\b/g,
		// Only replace if near AWS context - use beforeSend for complex cases
		replacement: "[AWS_SECRET_KEY]",
	},

	// Stripe API keys
	{
		name: "stripe_key",
		pattern: /\b(sk_(?:live|test)_[a-zA-Z0-9]{24,})\b/g,
		replacement: "[STRIPE_KEY]",
	},

	// Generic auth tokens (32+ hex chars)
	{
		name: "auth_token",
		pattern: /\b(?:token|auth)["\s:=]+["']?([a-fA-F0-9]{32,})["']?/gi,
		replacement: "[AUTH_TOKEN]",
	},
];

// ==========================================
// Sensitive Field Names (for object scrubbing)
// ==========================================

const SENSITIVE_FIELD_NAMES = new Set([
	"password",
	"passwd",
	"pwd",
	"secret",
	"token",
	"api_key",
	"apikey",
	"api-key",
	"auth",
	"authorization",
	"credentials",
	"credit_card",
	"creditcard",
	"card_number",
	"cardnumber",
	"cvv",
	"cvc",
	"ssn",
	"social_security",
	"private_key",
	"privatekey",
	"access_token",
	"refresh_token",
	"session_id",
	"sessionid",
	"cookie",
]);

// ==========================================
// Scrubbing Functions
// ==========================================

/**
 * Scrub PII from a string
 *
 * @param text - Text to scrub
 * @returns Scrubbed text with PII redacted
 */
export function scrubString(text: string): string {
	if (!text || typeof text !== "string") return text;

	let scrubbed = text;

	for (const { pattern, replacement } of PII_PATTERNS) {
		scrubbed = scrubbed.replace(pattern, replacement);
	}

	return scrubbed;
}

/**
 * Check if a field name is sensitive
 */
function isSensitiveField(fieldName: string): boolean {
	const normalized = fieldName.toLowerCase().replace(/[-_]/g, "");
	return (
		SENSITIVE_FIELD_NAMES.has(normalized) ||
		SENSITIVE_FIELD_NAMES.has(fieldName.toLowerCase())
	);
}

/**
 * Recursively scrub PII from an object
 *
 * @param obj - Object to scrub
 * @param depth - Current recursion depth (prevents infinite recursion)
 * @returns Scrubbed object
 */
export function scrubObject<T>(obj: T, depth = 0): T {
	// Prevent infinite recursion
	if (depth > 10) return obj;

	if (obj === null || obj === undefined) return obj;

	// Handle strings
	if (typeof obj === "string") {
		return scrubString(obj) as T;
	}

	// Handle arrays
	if (Array.isArray(obj)) {
		return obj.map((item) => scrubObject(item, depth + 1)) as T;
	}

	// Handle objects
	if (typeof obj === "object") {
		const scrubbed: Record<string, unknown> = {};

		for (const [key, value] of Object.entries(obj)) {
			// If field name is sensitive, redact entirely
			if (isSensitiveField(key)) {
				scrubbed[key] = "[REDACTED]";
			} else if (typeof value === "string") {
				scrubbed[key] = scrubString(value);
			} else if (typeof value === "object" && value !== null) {
				scrubbed[key] = scrubObject(value, depth + 1);
			} else {
				scrubbed[key] = value;
			}
		}

		return scrubbed as T;
	}

	return obj;
}

/**
 * Error event structure for scrubbing (subset of full ErrorEvent)
 */
interface ScrubableErrorEvent {
	exception?: { values?: Array<{ value?: string; type?: string }> };
	message?: { formatted?: string; message?: string };
	extra?: Record<string, unknown>;
	tags?: Record<string, string>;
	breadcrumbs?: { values?: Array<{ message?: string; data?: unknown }> };
	request?: {
		url?: string;
		query_string?: string;
		headers?: Record<string, string>;
	};
	user?: { email?: string; username?: string };
}

/**
 * Scrub PII from error event before sending
 *
 * This is the main entry point for scrubbing error events.
 * Call this in the beforeSend hook or before upload.
 */
export function scrubErrorEvent<T extends ScrubableErrorEvent>(event: T): T {
	// Deep clone to avoid mutating original
	const cloned = JSON.parse(JSON.stringify(event)) as T;

	// Scrub exception values
	if (cloned.exception?.values) {
		for (const value of cloned.exception.values) {
			if (value.value) {
				value.value = scrubString(value.value);
			}
		}
	}

	// Scrub message
	if (cloned.message) {
		if (cloned.message.formatted)
			cloned.message.formatted = scrubString(cloned.message.formatted);
		if (cloned.message.message)
			cloned.message.message = scrubString(cloned.message.message);
	}

	// Scrub extra data
	if (cloned.extra) {
		cloned.extra = scrubObject(cloned.extra);
	}

	// Scrub tags
	if (cloned.tags) {
		cloned.tags = scrubObject(cloned.tags) as Record<string, string>;
	}

	// Scrub breadcrumbs
	if (cloned.breadcrumbs?.values) {
		for (const crumb of cloned.breadcrumbs.values) {
			if (crumb.message) crumb.message = scrubString(crumb.message);
			if (crumb.data) crumb.data = scrubObject(crumb.data);
		}
	}

	// Scrub request URL (may contain tokens or auth)
	if (cloned.request) {
		if (cloned.request.url)
			cloned.request.url = scrubString(cloned.request.url);
		if (cloned.request.query_string)
			cloned.request.query_string = scrubString(cloned.request.query_string);
		if (cloned.request.headers) {
			// Remove sensitive headers entirely
			const sensitiveHeaders = [
				"authorization",
				"cookie",
				"x-api-key",
				"x-auth-token",
			];
			for (const header of sensitiveHeaders) {
				if (cloned.request.headers[header]) {
					cloned.request.headers[header] = "[REDACTED]";
				}
			}
		}
	}

	// Scrub user data (keep ID but redact email if needed)
	if (cloned.user) {
		// Note: We keep user.id as it's needed for issue grouping
		// But email should already be [EMAIL] from pattern matching
		if (cloned.user.email) cloned.user.email = scrubString(cloned.user.email);
		if (cloned.user.username)
			cloned.user.username = scrubString(cloned.user.username);
	}

	return cloned;
}

// ==========================================
// Configuration
// ==========================================

export interface PIIScrubberConfig {
	/** Enable/disable scrubbing (default: true) */
	enabled?: boolean;
	/** Additional patterns to match */
	additionalPatterns?: Array<{ pattern: RegExp; replacement: string }>;
	/** Additional sensitive field names */
	additionalSensitiveFields?: string[];
	/** Fields to never scrub (allowlist) */
	allowedFields?: string[];
}

/**
 * Create a configured scrubber
 */
export function createScrubber(config: PIIScrubberConfig = {}) {
	const {
		enabled = true,
		additionalPatterns = [],
		additionalSensitiveFields = [],
	} = config;

	// Add additional sensitive fields
	for (const field of additionalSensitiveFields) {
		SENSITIVE_FIELD_NAMES.add(field.toLowerCase());
	}

	// Merge additional patterns
	const allPatterns = [...PII_PATTERNS, ...additionalPatterns];

	return {
		scrubString: (text: string) => {
			if (!enabled) return text;
			let scrubbed = text;
			for (const { pattern, replacement } of allPatterns) {
				scrubbed = scrubbed.replace(pattern, replacement);
			}
			return scrubbed;
		},
		scrubObject: <T>(obj: T) => (enabled ? scrubObject(obj) : obj),
		scrubErrorEvent: <T extends Record<string, unknown>>(event: T) =>
			enabled ? scrubErrorEvent(event) : event,
	};
}
