/**
 * Security Utilities
 *
 * Safe redirect and URL validation functions to prevent XSS attacks.
 */

/**
 * Dangerous URL protocols that should never be allowed in redirects.
 */
const DANGEROUS_PROTOCOLS = ["javascript:", "data:", "vbscript:", "file:"];

/**
 * Regex to detect control characters and other dangerous chars.
 * Matches: ASCII 0-31 (control chars), DEL (127), and null byte.
 * These can be used to bypass protocol checks (e.g., "jav\x00ascript:").
 */
const CONTROL_CHAR_REGEX = /[\x00-\x1f\x7f]/;

/**
 * Check if a URL contains dangerous control characters.
 * These must be rejected before any other validation to prevent bypass attacks.
 *
 * @param url - URL to check
 * @returns true if URL contains control characters (unsafe)
 */
function hasControlCharacters(url: string): boolean {
	return CONTROL_CHAR_REGEX.test(url);
}

/**
 * Validate that a URL is safe for redirect.
 *
 * Checks:
 * 1. No dangerous protocols (javascript:, data:, vbscript:, file:)
 * 2. URL is parseable
 * 3. Either same-origin OR in allowed origins list
 *
 * @param url - URL to validate
 * @param options - Validation options
 * @returns true if URL is safe for redirect
 */
export function isValidRedirectUrl(
	url: string,
	options: {
		/** Current origin (default: window.location.origin) */
		origin?: string;
		/** Additional allowed origins (for OAuth etc) */
		allowedOrigins?: string[];
		/** Allow relative URLs (default: true) */
		allowRelative?: boolean;
	} = {},
): boolean {
	const {
		origin =
			typeof window !== "undefined" && window.location != null
				? window.location.origin
				: "",
		allowedOrigins = [],
		allowRelative = true,
	} = options;

	// Empty or whitespace-only URLs are invalid
	if (!url || !url.trim()) {
		return false;
	}

	const trimmedUrl = url.trim();

	// CRITICAL: Reject control characters first to prevent bypass attacks
	// e.g., "jav\x00ascript:" could bypass protocol checks
	if (hasControlCharacters(trimmedUrl)) {
		return false;
	}

	// Check for dangerous protocols (case-insensitive)
	const lowerUrl = trimmedUrl.toLowerCase();
	for (const protocol of DANGEROUS_PROTOCOLS) {
		if (lowerUrl.startsWith(protocol)) {
			return false;
		}
	}

	// Relative URLs starting with / are safe
	if (
		allowRelative &&
		trimmedUrl.startsWith("/") &&
		!trimmedUrl.startsWith("//")
	) {
		return true;
	}

	// Try to parse as URL
	try {
		const parsed = new URL(trimmedUrl, origin);

		// Only allow http and https protocols
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return false;
		}

		// Same-origin is always allowed
		if (parsed.origin === origin) {
			return true;
		}

		// Check against allowed origins
		if (allowedOrigins.includes(parsed.origin)) {
			return true;
		}

		// External URLs not in allowlist are rejected
		return false;
	} catch {
		// URL parsing failed - reject
		return false;
	}
}

/**
 * Safely redirect to a URL, with fallback if URL is invalid.
 *
 * @param url - URL to redirect to
 * @param options - Redirect options
 */
export function safeRedirect(
	url: string,
	options: {
		/** Fallback URL if the provided URL is invalid (default: '/') */
		fallback?: string;
		/** Current origin for validation */
		origin?: string;
		/** Additional allowed origins */
		allowedOrigins?: string[];
		/** Allow relative URLs (default: true) */
		allowRelative?: boolean;
	} = {},
): void {
	const { fallback = "/", ...validationOptions } = options;

	// Skip redirect if not in browser
	if (typeof window === "undefined") {
		return;
	}

	// Validate URL
	if (isValidRedirectUrl(url, validationOptions)) {
		window.location.href = url;
	} else {
		// Log warning in development
		if (process.env.NODE_ENV === "development") {
			console.warn(`[Sylphx] Blocked potentially unsafe redirect to: ${url}`);
		}
		// Use fallback
		window.location.href = fallback;
	}
}

/**
 * Sanitize a URL for safe use in the UI.
 *
 * Returns the original URL if safe, or null if dangerous.
 *
 * @param url - URL to sanitize
 * @returns Sanitized URL or null if unsafe
 */
export function sanitizeUrl(url: string): string | null {
	if (!url || !url.trim()) {
		return null;
	}

	const trimmedUrl = url.trim();

	// CRITICAL: Reject control characters first to prevent bypass attacks
	if (hasControlCharacters(trimmedUrl)) {
		return null;
	}

	const lowerUrl = trimmedUrl.toLowerCase();

	// Block dangerous protocols
	for (const protocol of DANGEROUS_PROTOCOLS) {
		if (lowerUrl.startsWith(protocol)) {
			return null;
		}
	}

	// Try to parse and normalize
	try {
		// For relative URLs, just validate they don't have dangerous content
		if (trimmedUrl.startsWith("/") && !trimmedUrl.startsWith("//")) {
			return trimmedUrl;
		}

		const parsed = new URL(trimmedUrl);

		// Only allow http and https
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return null;
		}

		return parsed.href;
	} catch {
		// If it looks like a relative URL without /, treat carefully
		if (!trimmedUrl.includes(":")) {
			return "/" + trimmedUrl;
		}
		return null;
	}
}
