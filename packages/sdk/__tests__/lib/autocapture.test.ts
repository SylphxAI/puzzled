/**
 * Autocapture Tests
 *
 * Tests for pure utility functions from autocapture.ts.
 * DOM-dependent event handling tested via E2E tests.
 */

import { describe, expect, test } from "bun:test";
import { DEFAULT_AUTOCAPTURE_CONFIG } from "../../src/lib/analytics/types";

// ============================================================================
// Replicated Functions for Testing (Non-DOM)
// ============================================================================

// These match the private functions in autocapture.ts that don't require DOM

const SENSITIVE_PATTERNS = [
	"card",
	"credit",
	"cvv",
	"cvc",
	"ccv",
	"security-code",
	"expir",
	"ssn",
	"social-security",
	"tax-id",
	"pin",
];

function isSensitiveByPattern(
	name: string,
	id: string,
	autocomplete: string,
): boolean {
	const lowerName = name.toLowerCase();
	const lowerId = id.toLowerCase();
	const lowerAutocomplete = autocomplete.toLowerCase();

	for (const pattern of SENSITIVE_PATTERNS) {
		if (
			lowerName.includes(pattern) ||
			lowerId.includes(pattern) ||
			lowerAutocomplete.includes(pattern)
		) {
			return true;
		}
	}
	return false;
}

function isClickableTag(tagName: string): boolean {
	return ["a", "button", "input", "select", "textarea"].includes(
		tagName.toLowerCase(),
	);
}

function isClickableRole(role: string | null): boolean {
	if (!role) return false;
	return ["button", "link", "tab", "menuitem", "option"].includes(
		role.toLowerCase(),
	);
}

function isMeaningfulClickTarget(
	tagName: string,
	inputType?: string,
	role?: string,
): boolean {
	const lowerTag = tagName.toLowerCase();

	// Standard interactive elements
	if (["a", "button"].includes(lowerTag)) {
		return true;
	}

	// Input elements (buttons, etc.)
	if (lowerTag === "input") {
		if (["button", "submit", "reset"].includes(inputType || "")) {
			return true;
		}
	}

	// Role-based
	if (
		role &&
		["button", "link", "tab", "menuitem"].includes(role.toLowerCase())
	) {
		return true;
	}

	return false;
}

// ============================================================================
// Default Config Tests
// ============================================================================

describe("DEFAULT_AUTOCAPTURE_CONFIG", () => {
	test("has correct captureText default", () => {
		expect(DEFAULT_AUTOCAPTURE_CONFIG.captureText).toBe(true);
	});

	test("has correct maxTextLength default", () => {
		expect(DEFAULT_AUTOCAPTURE_CONFIG.maxTextLength).toBe(100);
	});

	test("has correct eventTypes defaults", () => {
		expect(DEFAULT_AUTOCAPTURE_CONFIG.eventTypes).toContain("click");
		expect(DEFAULT_AUTOCAPTURE_CONFIG.eventTypes).toContain("submit");
		expect(DEFAULT_AUTOCAPTURE_CONFIG.eventTypes).toContain("change");
		expect(DEFAULT_AUTOCAPTURE_CONFIG.eventTypes?.length).toBe(3);
	});

	test("has correct elements defaults", () => {
		const elements = DEFAULT_AUTOCAPTURE_CONFIG.elements!;
		expect(elements).toContain("button");
		expect(elements).toContain("a");
		expect(elements).toContain("input");
		expect(elements).toContain("select");
		expect(elements).toContain("textarea");
		expect(elements).toContain('[role="button"]');
		expect(elements).toContain("[data-track]");
	});

	test("has correct captureAttributes defaults", () => {
		const attrs = DEFAULT_AUTOCAPTURE_CONFIG.captureAttributes!;
		expect(attrs).toContain("id");
		expect(attrs).toContain("class");
		expect(attrs).toContain("href");
		expect(attrs).toContain("name");
		expect(attrs).toContain("type");
		expect(attrs).toContain("role");
		expect(attrs).toContain("aria-label");
		expect(attrs).toContain("data-testid");
		expect(attrs).toContain("data-analytics");
		expect(attrs).toContain("data-track");
	});
});

// ============================================================================
// Sensitive Pattern Detection Tests
// ============================================================================

describe("isSensitiveByPattern", () => {
	describe("credit card patterns", () => {
		test("detects card in name", () => {
			expect(isSensitiveByPattern("card_number", "", "")).toBe(true);
			expect(isSensitiveByPattern("credit-card", "", "")).toBe(true);
		});

		test("detects card in id", () => {
			expect(isSensitiveByPattern("", "cardNumber", "")).toBe(true);
		});

		test("detects credit card autocomplete", () => {
			expect(isSensitiveByPattern("", "", "cc-number")).toBe(false); // cc not in patterns
			expect(isSensitiveByPattern("", "", "credit-card")).toBe(true);
		});

		test("detects cvv/cvc", () => {
			expect(isSensitiveByPattern("cvv", "", "")).toBe(true);
			expect(isSensitiveByPattern("cvc", "", "")).toBe(true);
			expect(isSensitiveByPattern("ccv", "", "")).toBe(true);
		});

		test("detects security code", () => {
			expect(isSensitiveByPattern("security-code", "", "")).toBe(true);
		});

		test("detects expiration", () => {
			expect(isSensitiveByPattern("expiry_date", "", "")).toBe(true);
			expect(isSensitiveByPattern("card_expiration", "", "")).toBe(true);
		});
	});

	describe("social security patterns", () => {
		test("detects ssn", () => {
			expect(isSensitiveByPattern("ssn", "", "")).toBe(true);
		});

		test("detects social-security", () => {
			expect(isSensitiveByPattern("social-security-number", "", "")).toBe(true);
		});

		test("detects tax-id", () => {
			expect(isSensitiveByPattern("tax-id", "", "")).toBe(true);
			// Note: 'taxId' doesn't match because the pattern is 'tax-id' with hyphen
			expect(isSensitiveByPattern("taxId", "", "")).toBe(false);
			// But 'tax_id' or 'tax-id-number' would match
			expect(isSensitiveByPattern("tax-id-number", "", "")).toBe(true);
		});
	});

	describe("pin patterns", () => {
		test("detects pin in name", () => {
			expect(isSensitiveByPattern("pin", "", "")).toBe(true);
			expect(isSensitiveByPattern("pin_code", "", "")).toBe(true);
		});
	});

	describe("non-sensitive fields", () => {
		test("allows normal field names", () => {
			expect(isSensitiveByPattern("email", "", "")).toBe(false);
			expect(isSensitiveByPattern("name", "", "")).toBe(false);
			expect(isSensitiveByPattern("phone", "", "")).toBe(false);
			expect(isSensitiveByPattern("address", "", "")).toBe(false);
			expect(isSensitiveByPattern("city", "", "")).toBe(false);
		});

		test("allows generic form fields", () => {
			expect(isSensitiveByPattern("first_name", "", "")).toBe(false);
			expect(isSensitiveByPattern("last_name", "", "")).toBe(false);
			expect(isSensitiveByPattern("message", "", "")).toBe(false);
			expect(isSensitiveByPattern("description", "", "")).toBe(false);
		});
	});

	describe("case insensitivity", () => {
		test("detects patterns regardless of case", () => {
			expect(isSensitiveByPattern("CARD_NUMBER", "", "")).toBe(true);
			expect(isSensitiveByPattern("CardNumber", "", "")).toBe(true);
			expect(isSensitiveByPattern("CreditCard", "", "")).toBe(true);
		});
	});
});

// ============================================================================
// Clickable Element Tests
// ============================================================================

describe("isClickableTag", () => {
	test("identifies standard clickable tags", () => {
		expect(isClickableTag("a")).toBe(true);
		expect(isClickableTag("button")).toBe(true);
		expect(isClickableTag("input")).toBe(true);
		expect(isClickableTag("select")).toBe(true);
		expect(isClickableTag("textarea")).toBe(true);
	});

	test("identifies uppercase tags", () => {
		expect(isClickableTag("A")).toBe(true);
		expect(isClickableTag("BUTTON")).toBe(true);
		expect(isClickableTag("INPUT")).toBe(true);
	});

	test("rejects non-clickable tags", () => {
		expect(isClickableTag("div")).toBe(false);
		expect(isClickableTag("span")).toBe(false);
		expect(isClickableTag("p")).toBe(false);
		expect(isClickableTag("section")).toBe(false);
		expect(isClickableTag("article")).toBe(false);
	});
});

describe("isClickableRole", () => {
	test("identifies clickable roles", () => {
		expect(isClickableRole("button")).toBe(true);
		expect(isClickableRole("link")).toBe(true);
		expect(isClickableRole("tab")).toBe(true);
		expect(isClickableRole("menuitem")).toBe(true);
		expect(isClickableRole("option")).toBe(true);
	});

	test("handles uppercase roles", () => {
		expect(isClickableRole("BUTTON")).toBe(true);
		expect(isClickableRole("LINK")).toBe(true);
	});

	test("rejects non-clickable roles", () => {
		expect(isClickableRole("presentation")).toBe(false);
		expect(isClickableRole("img")).toBe(false);
		expect(isClickableRole("list")).toBe(false);
		expect(isClickableRole("listitem")).toBe(false);
	});

	test("handles null/undefined role", () => {
		expect(isClickableRole(null)).toBe(false);
	});
});

// ============================================================================
// Meaningful Click Target Tests
// ============================================================================

describe("isMeaningfulClickTarget", () => {
	describe("standard interactive elements", () => {
		test("identifies anchor tags", () => {
			expect(isMeaningfulClickTarget("a")).toBe(true);
			expect(isMeaningfulClickTarget("A")).toBe(true);
		});

		test("identifies button tags", () => {
			expect(isMeaningfulClickTarget("button")).toBe(true);
			expect(isMeaningfulClickTarget("BUTTON")).toBe(true);
		});
	});

	describe("input elements", () => {
		test("identifies button type inputs", () => {
			expect(isMeaningfulClickTarget("input", "button")).toBe(true);
			expect(isMeaningfulClickTarget("input", "submit")).toBe(true);
			expect(isMeaningfulClickTarget("input", "reset")).toBe(true);
		});

		test("rejects text inputs", () => {
			expect(isMeaningfulClickTarget("input", "text")).toBe(false);
			expect(isMeaningfulClickTarget("input", "email")).toBe(false);
			expect(isMeaningfulClickTarget("input", "password")).toBe(false);
			expect(isMeaningfulClickTarget("input", "number")).toBe(false);
		});

		test("rejects checkbox/radio without role", () => {
			expect(isMeaningfulClickTarget("input", "checkbox")).toBe(false);
			expect(isMeaningfulClickTarget("input", "radio")).toBe(false);
		});
	});

	describe("role-based elements", () => {
		test("identifies button role", () => {
			expect(isMeaningfulClickTarget("div", undefined, "button")).toBe(true);
			expect(isMeaningfulClickTarget("span", undefined, "button")).toBe(true);
		});

		test("identifies link role", () => {
			expect(isMeaningfulClickTarget("div", undefined, "link")).toBe(true);
		});

		test("identifies tab role", () => {
			expect(isMeaningfulClickTarget("div", undefined, "tab")).toBe(true);
		});

		test("identifies menuitem role", () => {
			expect(isMeaningfulClickTarget("li", undefined, "menuitem")).toBe(true);
		});
	});

	describe("non-meaningful elements", () => {
		test("rejects plain divs", () => {
			expect(isMeaningfulClickTarget("div")).toBe(false);
		});

		test("rejects spans without role", () => {
			expect(isMeaningfulClickTarget("span")).toBe(false);
		});

		test("rejects sections", () => {
			expect(isMeaningfulClickTarget("section")).toBe(false);
		});

		test("rejects form element itself", () => {
			expect(isMeaningfulClickTarget("form")).toBe(false);
		});
	});
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("autocapture integration", () => {
	test("common button scenarios", () => {
		// Primary button
		expect(isMeaningfulClickTarget("button")).toBe(true);

		// Submit input
		expect(isMeaningfulClickTarget("input", "submit")).toBe(true);

		// Link
		expect(isMeaningfulClickTarget("a")).toBe(true);

		// Custom button (div with role)
		expect(isMeaningfulClickTarget("div", undefined, "button")).toBe(true);
	});

	test("form input scenarios", () => {
		// Text input - not a meaningful click target
		expect(isMeaningfulClickTarget("input", "text")).toBe(false);

		// But if it has button role, it is
		expect(isMeaningfulClickTarget("input", "text", "button")).toBe(true);
	});

	test("sensitive field detection for common patterns", () => {
		// Payment fields
		expect(isSensitiveByPattern("card_number", "cardNum", "cc-number")).toBe(
			true,
		);
		expect(isSensitiveByPattern("", "cvv", "")).toBe(true);

		// Normal fields
		expect(isSensitiveByPattern("email", "email", "email")).toBe(false);
		expect(isSensitiveByPattern("name", "fullName", "name")).toBe(false);
	});

	test("default config handles typical form elements", () => {
		const elements = DEFAULT_AUTOCAPTURE_CONFIG.elements!;

		// Should include all form inputs
		expect(elements).toContain("button");
		expect(elements).toContain("a");
		expect(elements).toContain("input");
		expect(elements).toContain("select");
		expect(elements).toContain("textarea");

		// Should include ARIA role buttons
		expect(elements).toContain('[role="button"]');

		// Should include tracked elements
		expect(elements).toContain("[data-track]");
	});

	test("default attributes capture common identifiers", () => {
		const attrs = DEFAULT_AUTOCAPTURE_CONFIG.captureAttributes!;

		// Standard identifiers
		expect(attrs).toContain("id");
		expect(attrs).toContain("class");
		expect(attrs).toContain("name");

		// Test IDs for automation
		expect(attrs).toContain("data-testid");

		// Analytics attributes
		expect(attrs).toContain("data-analytics");
		expect(attrs).toContain("data-track");

		// Accessibility
		expect(attrs).toContain("aria-label");
		expect(attrs).toContain("role");
	});
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("edge cases", () => {
	test("handles empty strings", () => {
		expect(isSensitiveByPattern("", "", "")).toBe(false);
		expect(isClickableTag("")).toBe(false);
		expect(isClickableRole("")).toBe(false);
		expect(isMeaningfulClickTarget("", "", "")).toBe(false);
	});

	test("handles partial matches", () => {
		// "card" appears in "discard" but we want to catch it
		expect(isSensitiveByPattern("discard_item", "", "")).toBe(true);

		// "pin" appears in "pincode" and "spinning"
		expect(isSensitiveByPattern("spinning_loader", "", "")).toBe(true);
		// This is a false positive, but security > convenience
	});

	test("handles special characters in field names", () => {
		expect(isSensitiveByPattern("card[number]", "", "")).toBe(true);
		expect(isSensitiveByPattern("user.card.number", "", "")).toBe(true);
	});
});
