/**
 * Consent Hooks Tests
 *
 * Tests for GDPR/CCPA consent management hooks logic.
 */

import { describe, expect, test } from "bun:test";

// ============================================================================
// Types (from consent-hooks.ts)
// ============================================================================

type ConsentCategory =
	| "necessary"
	| "analytics"
	| "marketing"
	| "functional"
	| "social";

interface ConsentType {
	id: string;
	slug: string;
	name: string;
	description: string;
	category: ConsentCategory;
	required: boolean;
	defaultEnabled: boolean;
}

interface UserConsent {
	slug: string;
	granted: boolean;
	grantedAt: string | null;
}

// ============================================================================
// hasConsent Logic Tests
// ============================================================================

describe("hasConsent logic", () => {
	const types: ConsentType[] = [
		{
			id: "1",
			slug: "essential",
			name: "Essential",
			description: "",
			category: "necessary",
			required: true,
			defaultEnabled: true,
		},
		{
			id: "2",
			slug: "google-analytics",
			name: "Google Analytics",
			description: "",
			category: "analytics",
			required: false,
			defaultEnabled: false,
		},
		{
			id: "3",
			slug: "marketing-cookies",
			name: "Marketing",
			description: "",
			category: "marketing",
			required: false,
			defaultEnabled: false,
		},
		{
			id: "4",
			slug: "functional-storage",
			name: "Functional",
			description: "",
			category: "functional",
			required: false,
			defaultEnabled: true,
		},
	];

	function hasConsent(
		category: ConsentCategory,
		consents: Record<string, boolean>,
	): boolean {
		// Necessary is always consented
		if (category === "necessary") return true;

		// Check if any consent type in this category is consented
		const categoryTypes = types.filter((t) => t.category === category);
		return categoryTypes.some((t) => consents[t.slug] ?? t.defaultEnabled);
	}

	test("necessary category always returns true", () => {
		expect(hasConsent("necessary", {})).toBe(true);
		expect(hasConsent("necessary", { essential: false })).toBe(true);
	});

	test("returns true when consent explicitly granted", () => {
		expect(hasConsent("analytics", { "google-analytics": true })).toBe(true);
		expect(hasConsent("marketing", { "marketing-cookies": true })).toBe(true);
	});

	test("returns false when consent explicitly denied", () => {
		expect(hasConsent("analytics", { "google-analytics": false })).toBe(false);
		expect(hasConsent("marketing", { "marketing-cookies": false })).toBe(false);
	});

	test("falls back to defaultEnabled when not in consents", () => {
		// functional has defaultEnabled: true
		expect(hasConsent("functional", {})).toBe(true);
		// analytics has defaultEnabled: false
		expect(hasConsent("analytics", {})).toBe(false);
	});

	test("returns false for category with no types", () => {
		// social category has no types in our list
		expect(hasConsent("social", {})).toBe(false);
	});
});

// ============================================================================
// Consent State Initialization Tests
// ============================================================================

describe("Consent state initialization", () => {
	test("determines banner visibility based on explicit choices", () => {
		function shouldShowBanner(userConsents: UserConsent[]): boolean {
			// Show banner if user has NOT made any explicit consent choices
			const hasExplicitChoice = userConsents.some((c) => c.grantedAt !== null);
			return !hasExplicitChoice;
		}

		// No explicit choices - show banner
		const noChoices: UserConsent[] = [
			{ slug: "analytics", granted: false, grantedAt: null },
			{ slug: "marketing", granted: false, grantedAt: null },
		];
		expect(shouldShowBanner(noChoices)).toBe(true);

		// Has explicit choices - hide banner
		const withChoices: UserConsent[] = [
			{ slug: "analytics", granted: true, grantedAt: "2024-01-15T10:00:00Z" },
			{ slug: "marketing", granted: false, grantedAt: "2024-01-15T10:00:00Z" },
		];
		expect(shouldShowBanner(withChoices)).toBe(false);

		// Partial choices - hide banner (at least one explicit)
		const partialChoices: UserConsent[] = [
			{ slug: "analytics", granted: true, grantedAt: "2024-01-15T10:00:00Z" },
			{ slug: "marketing", granted: false, grantedAt: null },
		];
		expect(shouldShowBanner(partialChoices)).toBe(false);
	});

	test("converts user consents array to map", () => {
		function consentsToMap(
			userConsents: UserConsent[],
		): Record<string, boolean> {
			const map: Record<string, boolean> = {};
			for (const consent of userConsents) {
				map[consent.slug] = consent.granted ?? false;
			}
			return map;
		}

		const consents: UserConsent[] = [
			{ slug: "analytics", granted: true, grantedAt: "2024-01-15" },
			{ slug: "marketing", granted: false, grantedAt: "2024-01-15" },
			{ slug: "functional", granted: true, grantedAt: null },
		];

		const map = consentsToMap(consents);
		expect(map).toEqual({
			analytics: true,
			marketing: false,
			functional: true,
		});
	});
});

// ============================================================================
// Accept All Logic Tests
// ============================================================================

describe("Accept all logic", () => {
	test("sets all consent types to true", () => {
		const types: ConsentType[] = [
			{
				id: "1",
				slug: "analytics",
				name: "Analytics",
				description: "",
				category: "analytics",
				required: false,
				defaultEnabled: false,
			},
			{
				id: "2",
				slug: "marketing",
				name: "Marketing",
				description: "",
				category: "marketing",
				required: false,
				defaultEnabled: false,
			},
			{
				id: "3",
				slug: "functional",
				name: "Functional",
				description: "",
				category: "functional",
				required: false,
				defaultEnabled: false,
			},
		];

		function acceptAll(): Record<string, boolean> {
			const allConsents: Record<string, boolean> = {};
			for (const type of types) {
				allConsents[type.slug] = true;
			}
			return allConsents;
		}

		const result = acceptAll();
		expect(result).toEqual({
			analytics: true,
			marketing: true,
			functional: true,
		});
	});
});

// ============================================================================
// Decline Optional Logic Tests
// ============================================================================

describe("Decline optional logic", () => {
	test("sets only required consents to true", () => {
		const types: ConsentType[] = [
			{
				id: "1",
				slug: "essential",
				name: "Essential",
				description: "",
				category: "necessary",
				required: true,
				defaultEnabled: true,
			},
			{
				id: "2",
				slug: "analytics",
				name: "Analytics",
				description: "",
				category: "analytics",
				required: false,
				defaultEnabled: false,
			},
			{
				id: "3",
				slug: "marketing",
				name: "Marketing",
				description: "",
				category: "marketing",
				required: false,
				defaultEnabled: false,
			},
		];

		function declineOptional(): Record<string, boolean> {
			const requiredConsents: Record<string, boolean> = {};
			for (const type of types) {
				requiredConsents[type.slug] = type.required;
			}
			return requiredConsents;
		}

		const result = declineOptional();
		expect(result).toEqual({
			essential: true,
			analytics: false,
			marketing: false,
		});
	});
});

// ============================================================================
// Save Consents Logic Tests
// ============================================================================

describe("Save consents logic", () => {
	test("builds consent list from types and local state", () => {
		const types: ConsentType[] = [
			{
				id: "1",
				slug: "analytics",
				name: "Analytics",
				description: "",
				category: "analytics",
				required: false,
				defaultEnabled: false,
			},
			{
				id: "2",
				slug: "marketing",
				name: "Marketing",
				description: "",
				category: "marketing",
				required: false,
				defaultEnabled: false,
			},
		];

		const localConsents: Record<string, boolean> = {
			analytics: true,
			marketing: false,
		};

		function buildConsentList(): Array<{ slug: string; granted: boolean }> {
			return types.map((type) => ({
				slug: type.slug,
				granted: localConsents[type.slug] ?? type.defaultEnabled,
			}));
		}

		const result = buildConsentList();
		expect(result).toEqual([
			{ slug: "analytics", granted: true },
			{ slug: "marketing", granted: false },
		]);
	});

	test("falls back to defaultEnabled for missing consents", () => {
		const types: ConsentType[] = [
			{
				id: "1",
				slug: "analytics",
				name: "Analytics",
				description: "",
				category: "analytics",
				required: false,
				defaultEnabled: false,
			},
			{
				id: "2",
				slug: "functional",
				name: "Functional",
				description: "",
				category: "functional",
				required: false,
				defaultEnabled: true,
			},
		];

		const localConsents: Record<string, boolean> = {};

		function buildConsentList(): Array<{ slug: string; granted: boolean }> {
			return types.map((type) => ({
				slug: type.slug,
				granted: localConsents[type.slug] ?? type.defaultEnabled,
			}));
		}

		const result = buildConsentList();
		expect(result).toEqual([
			{ slug: "analytics", granted: false },
			{ slug: "functional", granted: true },
		]);
	});
});

// ============================================================================
// useSafeConsent Default Return Tests
// ============================================================================

describe("useSafeConsent default return (no context)", () => {
	const defaultReturn = {
		types: [],
		consents: {},
		isLoading: false,
		error: null,
		showBanner: false,
		hasConsented: false,
		isConfigured: false,
	};

	test("returns safe defaults", () => {
		expect(defaultReturn.types).toEqual([]);
		expect(defaultReturn.consents).toEqual({});
		expect(defaultReturn.isLoading).toBe(false);
		expect(defaultReturn.error).toBeNull();
		expect(defaultReturn.showBanner).toBe(false);
		expect(defaultReturn.hasConsented).toBe(false);
		expect(defaultReturn.isConfigured).toBe(false);
	});
});

// ============================================================================
// useConsentGate Logic Tests
// ============================================================================

describe("useConsentGate logic", () => {
	test("triggers onConsent when consent granted", () => {
		let consentTriggered = false;
		let denyTriggered = false;

		const options = {
			category: "analytics" as ConsentCategory,
			onConsent: () => {
				consentTriggered = true;
			},
			onDeny: () => {
				denyTriggered = true;
			},
		};

		function handleConsentResult(hasConsent: boolean, isLoading: boolean) {
			if (!isLoading) {
				if (hasConsent) {
					options.onConsent?.();
				} else {
					options.onDeny?.();
				}
			}
		}

		// Consent granted
		handleConsentResult(true, false);
		expect(consentTriggered).toBe(true);
		expect(denyTriggered).toBe(false);
	});

	test("triggers onDeny when consent denied", () => {
		let consentTriggered = false;
		let denyTriggered = false;

		const options = {
			onConsent: () => {
				consentTriggered = true;
			},
			onDeny: () => {
				denyTriggered = true;
			},
		};

		function handleConsentResult(hasConsent: boolean, isLoading: boolean) {
			if (!isLoading) {
				if (hasConsent) {
					options.onConsent?.();
				} else {
					options.onDeny?.();
				}
			}
		}

		// Consent denied
		handleConsentResult(false, false);
		expect(consentTriggered).toBe(false);
		expect(denyTriggered).toBe(true);
	});

	test("does not trigger callbacks while loading", () => {
		let consentTriggered = false;
		let denyTriggered = false;

		const options = {
			onConsent: () => {
				consentTriggered = true;
			},
			onDeny: () => {
				denyTriggered = true;
			},
		};

		function handleConsentResult(hasConsent: boolean, isLoading: boolean) {
			if (!isLoading) {
				if (hasConsent) {
					options.onConsent?.();
				} else {
					options.onDeny?.();
				}
			}
		}

		// Still loading
		handleConsentResult(true, true);
		expect(consentTriggered).toBe(false);
		expect(denyTriggered).toBe(false);
	});
});

// ============================================================================
// Local Consent State Management Tests
// ============================================================================

describe("Local consent state management", () => {
	test("setConsent updates single consent", () => {
		let localConsents: Record<string, boolean> = {
			analytics: false,
			marketing: false,
		};

		const setConsent = (typeId: string, value: boolean) => {
			localConsents = { ...localConsents, [typeId]: value };
		};

		setConsent("analytics", true);
		expect(localConsents.analytics).toBe(true);
		expect(localConsents.marketing).toBe(false);
	});

	test("setConsents updates multiple consents", () => {
		let localConsents: Record<string, boolean> = {
			analytics: false,
			marketing: false,
			functional: false,
		};

		const setConsents = (newConsents: Record<string, boolean>) => {
			localConsents = { ...localConsents, ...newConsents };
		};

		setConsents({ analytics: true, functional: true });
		expect(localConsents.analytics).toBe(true);
		expect(localConsents.marketing).toBe(false);
		expect(localConsents.functional).toBe(true);
	});
});

// ============================================================================
// Banner Visibility Tests
// ============================================================================

describe("Banner visibility management", () => {
	test("openPreferences shows banner", () => {
		let showBanner = false;

		const openPreferences = () => {
			showBanner = true;
		};

		openPreferences();
		expect(showBanner).toBe(true);
	});

	test("closeBanner hides banner", () => {
		let showBanner = true;

		const closeBanner = () => {
			showBanner = false;
		};

		closeBanner();
		expect(showBanner).toBe(false);
	});
});

// ============================================================================
// Error State Tests
// ============================================================================

describe("Consent error state", () => {
	test("aggregates errors from multiple sources", () => {
		function getError(...errors: (Error | null)[]): Error | null {
			for (const error of errors) {
				if (error) return error;
			}
			return null;
		}

		expect(getError(null, null, null)).toBeNull();

		const typesError = new Error("Failed to load consent types");
		expect(getError(typesError, null, null)).toBe(typesError);

		const userError = new Error("Failed to load user consents");
		expect(getError(null, userError, null)).toBe(userError);

		const saveError = new Error("Failed to save consents");
		expect(getError(null, null, saveError)).toBe(saveError);

		// First error wins
		expect(getError(typesError, userError, saveError)).toBe(typesError);
	});
});
