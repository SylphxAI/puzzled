/**
 * Session Replay Privacy Controls
 *
 * SOTA privacy features:
 * - Automatic PII detection
 * - Sensitive field pattern matching
 * - GDPR/CCPA compliant masking
 * - Smart content categorization
 */

import type { PrivacyMode } from "./types";

// ==========================================
// Sensitive Field Patterns
// ==========================================

/**
 * Patterns that indicate sensitive data in field names/labels
 */
const SENSITIVE_PATTERNS = {
	password: [/password/i, /passwd/i, /pwd/i, /secret/i],
	financial: [
		/credit.?card/i,
		/card.?number/i,
		/cvv/i,
		/cvc/i,
		/expir/i,
		/bank.?account/i,
		/routing.?number/i,
		/iban/i,
		/swift/i,
		/account.?number/i,
	],
	identity: [
		/ssn/i,
		/social.?security/i,
		/tax.?id/i,
		/passport/i,
		/driver.?license/i,
		/national.?id/i,
		/id.?number/i,
	],
	personal: [
		/birth.?date/i,
		/dob/i,
		/date.?of.?birth/i,
		/mother.?maiden/i,
		/maiden.?name/i,
	],
	health: [
		/health/i,
		/medical/i,
		/diagnosis/i,
		/prescription/i,
		/insurance.?id/i,
		/patient.?id/i,
	],
	authentication: [
		/api.?key/i,
		/token/i,
		/auth/i,
		/bearer/i,
		/access.?key/i,
		/private.?key/i,
	],
} as const;

/**
 * Input types that should always be masked
 */
const SENSITIVE_INPUT_TYPES = new Set(["password", "tel", "email"]);

/**
 * Autocomplete values that indicate sensitive data
 */
const SENSITIVE_AUTOCOMPLETE = new Set([
	"cc-name",
	"cc-number",
	"cc-exp",
	"cc-exp-month",
	"cc-exp-year",
	"cc-csc",
	"cc-type",
	"new-password",
	"current-password",
	"one-time-code",
	"tel",
	"tel-country-code",
	"tel-national",
	"email",
]);

// ==========================================
// Detection Functions
// ==========================================

/**
 * Check if text contains sensitive patterns
 */
function containsSensitivePattern(text: string): boolean {
	const allPatterns = Object.values(SENSITIVE_PATTERNS).flat();
	return allPatterns.some((pattern) => pattern.test(text));
}

/**
 * Get sensitivity category for an element
 */
function getSensitivityCategory(element: Element): string | null {
	const text = [
		element.getAttribute("name"),
		element.getAttribute("id"),
		element.getAttribute("aria-label"),
		element.getAttribute("placeholder"),
		(element as HTMLInputElement).type,
	]
		.filter(Boolean)
		.join(" ");

	for (const [category, patterns] of Object.entries(SENSITIVE_PATTERNS)) {
		if (patterns.some((pattern) => pattern.test(text))) {
			return category;
		}
	}

	return null;
}

/**
 * Check if element should be masked based on its attributes
 */
function shouldMaskElement(element: Element): boolean {
	// Check input type
	if (element instanceof HTMLInputElement) {
		if (SENSITIVE_INPUT_TYPES.has(element.type)) {
			return true;
		}
	}

	// Check autocomplete attribute
	const autocomplete = element.getAttribute("autocomplete");
	if (autocomplete && SENSITIVE_AUTOCOMPLETE.has(autocomplete)) {
		return true;
	}

	// Check data attribute for explicit masking
	if (
		element.hasAttribute("data-mask") ||
		element.hasAttribute("data-private")
	) {
		return true;
	}

	// Check name/id/label for sensitive patterns
	return getSensitivityCategory(element) !== null;
}

// ==========================================
// Public API
// ==========================================

/**
 * Detect all sensitive fields in the document
 * Returns CSS selectors for masking
 */
export function detectSensitiveFields(): string[] {
	const selectors: string[] = [];
	const inputs = document.querySelectorAll("input, textarea, select");

	inputs.forEach((element) => {
		if (shouldMaskElement(element)) {
			// Build most specific selector possible
			if (element.id) {
				selectors.push(`#${CSS.escape(element.id)}`);
			} else if (element.getAttribute("name")) {
				const name = element.getAttribute("name")!;
				selectors.push(`[name="${CSS.escape(name)}"]`);
			} else {
				// Fallback to nth-child selector
				const parent = element.parentElement;
				if (parent) {
					const index = Array.from(parent.children).indexOf(element) + 1;
					const tagName = element.tagName.toLowerCase();
					selectors.push(`${tagName}:nth-child(${index})`);
				}
			}
		}
	});

	return [...new Set(selectors)]; // Dedupe
}

/**
 * Get rrweb masking options based on privacy mode
 */
export function getPrivacyOptions(
	mode: PrivacyMode,
	customMaskSelectors: string[] = [],
) {
	const autoDetectedSelectors = detectSensitiveFields();
	const allMaskSelectors = [...autoDetectedSelectors, ...customMaskSelectors];

	switch (mode) {
		case "strict":
			return {
				maskAllInputs: true,
				maskTextSelector: "*", // Mask all text
				maskInputOptions: {
					password: true,
					text: true,
					email: true,
					tel: true,
					url: true,
					number: true,
					search: true,
					textarea: true,
					select: true,
				},
				slimDOMOptions: {
					script: true,
					comment: true,
					headFavicon: true,
					headWhitespace: true,
					headMetaDescKeywords: true,
					headMetaSocial: true,
					headMetaRobots: true,
					headMetaHttpEquiv: true,
					headMetaAuthorship: true,
					headMetaVerification: true,
				},
			};

		case "balanced":
			return {
				maskAllInputs: false,
				maskTextSelector: allMaskSelectors.join(", ") || undefined,
				maskInputOptions: {
					password: true,
					email: true,
					tel: true,
				},
				slimDOMOptions: {
					script: true,
					comment: true,
					headFavicon: true,
					headWhitespace: true,
				},
			};

		case "minimal":
			return {
				maskAllInputs: false,
				maskTextSelector: customMaskSelectors.join(", ") || undefined,
				maskInputOptions: {
					password: true,
				},
				slimDOMOptions: {
					script: true,
					comment: true,
				},
			};
	}
}

/**
 * Sanitize a string for logging (redact PII)
 */
export function sanitizeForLogging(text: string): string {
	// Email pattern
	text = text.replace(
		/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
		"[EMAIL_REDACTED]",
	);

	// Phone pattern (various formats)
	text = text.replace(
		/(\+?1?[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
		"[PHONE_REDACTED]",
	);

	// Credit card pattern
	text = text.replace(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, "[CARD_REDACTED]");

	// SSN pattern
	text = text.replace(/\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, "[SSN_REDACTED]");

	// IP address pattern
	text = text.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[IP_REDACTED]");

	return text;
}

/**
 * Check if URL contains sensitive query parameters
 */
export function sanitizeUrl(url: string): string {
	try {
		const parsed = new URL(url);
		const sensitiveParams = [
			"token",
			"key",
			"password",
			"secret",
			"auth",
			"api_key",
			"apikey",
		];

		sensitiveParams.forEach((param) => {
			if (parsed.searchParams.has(param)) {
				parsed.searchParams.set(param, "[REDACTED]");
			}
		});

		return parsed.toString();
	} catch {
		return url;
	}
}

/**
 * Generate a privacy report for the current page
 */
export function generatePrivacyReport(): {
	sensitiveFields: Array<{ selector: string; category: string }>;
	totalInputs: number;
	maskedInputs: number;
	recommendations: string[];
} {
	const inputs = document.querySelectorAll("input, textarea, select");
	const sensitiveFields: Array<{ selector: string; category: string }> = [];
	const recommendations: string[] = [];

	inputs.forEach((element) => {
		const category = getSensitivityCategory(element);
		if (category) {
			const selector = element.id
				? `#${element.id}`
				: element.getAttribute("name") || element.tagName;

			sensitiveFields.push({ selector, category });
		}

		// Check for common privacy issues
		if (element instanceof HTMLInputElement) {
			if (element.type === "password" && !element.autocomplete) {
				recommendations.push(
					`Add autocomplete="current-password" or "new-password" to password field: ${element.name || element.id}`,
				);
			}
		}
	});

	return {
		sensitiveFields,
		totalInputs: inputs.length,
		maskedInputs: sensitiveFields.length,
		recommendations,
	};
}
