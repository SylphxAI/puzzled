/**
 * Feature Flags Targeting Tests
 *
 * Tests for targeting rules evaluation and context handling.
 */

import { describe, expect, test } from "bun:test";
import { findMatchingRule, mergeContext } from "../../src/lib/flags/targeting";
import type {
	EvaluationContext,
	TargetingRule,
} from "../../src/lib/flags/types";

// ============================================================================
// Test Helpers
// ============================================================================

function createRule(
	id: string,
	conditions: Array<{ attribute: string; operator: string; value: unknown }>,
	variant = "treatment",
): TargetingRule {
	return {
		id,
		conditions: conditions.map((c) => ({
			attribute: c.attribute,
			operator: c.operator as any,
			value: c.value,
		})),
		variant,
	};
}

// ============================================================================
// findMatchingRule Tests
// ============================================================================

describe("findMatchingRule", () => {
	describe("basic matching", () => {
		test("returns null for empty rules", () => {
			const context: EvaluationContext = { userId: "user-123" };
			const result = findMatchingRule([], context);
			expect(result).toBeNull();
		});

		test("matches rule with empty conditions", () => {
			const rules = [createRule("rule-1", [])];
			const context: EvaluationContext = { userId: "user-123" };

			const result = findMatchingRule(rules, context);
			expect(result?.id).toBe("rule-1");
		});

		test("returns first matching rule", () => {
			const rules = [
				createRule(
					"rule-1",
					[{ attribute: "plan", operator: "eq", value: "premium" }],
					"v1",
				),
				createRule(
					"rule-2",
					[{ attribute: "plan", operator: "eq", value: "premium" }],
					"v2",
				),
			];
			const context: EvaluationContext = { userId: "user", plan: "premium" };

			const result = findMatchingRule(rules, context);
			expect(result?.id).toBe("rule-1");
			expect(result?.variant).toBe("v1");
		});

		test("returns null when no rules match", () => {
			const rules = [
				createRule("rule-1", [
					{ attribute: "plan", operator: "eq", value: "premium" },
				]),
			];
			const context: EvaluationContext = { userId: "user", plan: "free" };

			const result = findMatchingRule(rules, context);
			expect(result).toBeNull();
		});
	});

	describe("AND logic (multiple conditions)", () => {
		test("matches when all conditions pass", () => {
			const rules = [
				createRule("rule-1", [
					{ attribute: "plan", operator: "eq", value: "premium" },
					{ attribute: "country", operator: "eq", value: "US" },
				]),
			];
			const context: EvaluationContext = {
				userId: "user",
				plan: "premium",
				country: "US",
			};

			const result = findMatchingRule(rules, context);
			expect(result?.id).toBe("rule-1");
		});

		test("fails when any condition fails", () => {
			const rules = [
				createRule("rule-1", [
					{ attribute: "plan", operator: "eq", value: "premium" },
					{ attribute: "country", operator: "eq", value: "US" },
				]),
			];
			const context: EvaluationContext = {
				userId: "user",
				plan: "premium",
				country: "UK",
			};

			const result = findMatchingRule(rules, context);
			expect(result).toBeNull();
		});
	});

	describe("equality operator (eq)", () => {
		test("matches equal strings", () => {
			const rules = [
				createRule("r", [
					{ attribute: "status", operator: "eq", value: "active" },
				]),
			];
			expect(
				findMatchingRule(rules, { userId: "u", status: "active" }),
			).not.toBeNull();
		});

		test("matches equal numbers", () => {
			const rules = [
				createRule("r", [{ attribute: "age", operator: "eq", value: 25 }]),
			];
			expect(findMatchingRule(rules, { userId: "u", age: 25 })).not.toBeNull();
		});

		test("matches with type coercion (string to number)", () => {
			const rules = [
				createRule("r", [{ attribute: "count", operator: "eq", value: 42 }]),
			];
			expect(
				findMatchingRule(rules, { userId: "u", count: "42" }),
			).not.toBeNull();
		});

		test("matches boolean with string true", () => {
			const rules = [
				createRule("r", [
					{ attribute: "active", operator: "eq", value: "true" },
				]),
			];
			expect(
				findMatchingRule(rules, { userId: "u", active: true }),
			).not.toBeNull();
		});

		test("fails for non-equal values", () => {
			const rules = [
				createRule("r", [
					{ attribute: "status", operator: "eq", value: "active" },
				]),
			];
			expect(
				findMatchingRule(rules, { userId: "u", status: "inactive" }),
			).toBeNull();
		});
	});

	describe("not equals operator (neq)", () => {
		test("matches when not equal", () => {
			const rules = [
				createRule("r", [
					{ attribute: "plan", operator: "neq", value: "free" },
				]),
			];
			expect(
				findMatchingRule(rules, { userId: "u", plan: "premium" }),
			).not.toBeNull();
		});

		test("fails when equal", () => {
			const rules = [
				createRule("r", [
					{ attribute: "plan", operator: "neq", value: "free" },
				]),
			];
			expect(findMatchingRule(rules, { userId: "u", plan: "free" })).toBeNull();
		});
	});

	describe("comparison operators (gt, gte, lt, lte)", () => {
		test("gt matches when actual > expected", () => {
			const rules = [
				createRule("r", [{ attribute: "age", operator: "gt", value: 18 }]),
			];
			expect(findMatchingRule(rules, { userId: "u", age: 25 })).not.toBeNull();
			expect(findMatchingRule(rules, { userId: "u", age: 18 })).toBeNull();
		});

		test("gte matches when actual >= expected", () => {
			const rules = [
				createRule("r", [{ attribute: "age", operator: "gte", value: 18 }]),
			];
			expect(findMatchingRule(rules, { userId: "u", age: 18 })).not.toBeNull();
			expect(findMatchingRule(rules, { userId: "u", age: 25 })).not.toBeNull();
			expect(findMatchingRule(rules, { userId: "u", age: 17 })).toBeNull();
		});

		test("lt matches when actual < expected", () => {
			const rules = [
				createRule("r", [{ attribute: "age", operator: "lt", value: 18 }]),
			];
			expect(findMatchingRule(rules, { userId: "u", age: 10 })).not.toBeNull();
			expect(findMatchingRule(rules, { userId: "u", age: 18 })).toBeNull();
		});

		test("lte matches when actual <= expected", () => {
			const rules = [
				createRule("r", [{ attribute: "age", operator: "lte", value: 18 }]),
			];
			expect(findMatchingRule(rules, { userId: "u", age: 18 })).not.toBeNull();
			expect(findMatchingRule(rules, { userId: "u", age: 10 })).not.toBeNull();
			expect(findMatchingRule(rules, { userId: "u", age: 25 })).toBeNull();
		});

		test("comparison with string numbers", () => {
			const rules = [
				createRule("r", [{ attribute: "score", operator: "gt", value: "50" }]),
			];
			expect(
				findMatchingRule(rules, { userId: "u", score: 75 }),
			).not.toBeNull();
		});
	});

	describe("contains operator", () => {
		test("matches substring in string", () => {
			const rules = [
				createRule("r", [
					{ attribute: "email", operator: "contains", value: "@company.com" },
				]),
			];
			expect(
				findMatchingRule(rules, { userId: "u", email: "user@company.com" }),
			).not.toBeNull();
		});

		test("case insensitive matching", () => {
			const rules = [
				createRule("r", [
					{ attribute: "name", operator: "contains", value: "JOHN" },
				]),
			];
			expect(
				findMatchingRule(rules, { userId: "u", name: "John Doe" }),
			).not.toBeNull();
		});

		test("matches item in array", () => {
			const rules = [
				createRule("r", [
					{ attribute: "tags", operator: "contains", value: "premium" },
				]),
			];
			expect(
				findMatchingRule(rules, {
					userId: "u",
					tags: ["basic", "premium", "active"],
				}),
			).not.toBeNull();
		});

		test("fails for non-matching substring", () => {
			const rules = [
				createRule("r", [
					{ attribute: "email", operator: "contains", value: "@gmail.com" },
				]),
			];
			expect(
				findMatchingRule(rules, { userId: "u", email: "user@company.com" }),
			).toBeNull();
		});
	});

	describe("not_contains operator", () => {
		test("matches when substring not found", () => {
			const rules = [
				createRule("r", [
					{ attribute: "email", operator: "not_contains", value: "@spam.com" },
				]),
			];
			expect(
				findMatchingRule(rules, { userId: "u", email: "user@company.com" }),
			).not.toBeNull();
		});

		test("matches when attribute is missing", () => {
			const rules = [
				createRule("r", [
					{ attribute: "banned", operator: "not_contains", value: "yes" },
				]),
			];
			expect(findMatchingRule(rules, { userId: "u" })).not.toBeNull();
		});

		test("fails when substring found", () => {
			const rules = [
				createRule("r", [
					{
						attribute: "email",
						operator: "not_contains",
						value: "@company.com",
					},
				]),
			];
			expect(
				findMatchingRule(rules, { userId: "u", email: "user@company.com" }),
			).toBeNull();
		});
	});

	describe("starts_with operator", () => {
		test("matches prefix", () => {
			const rules = [
				createRule("r", [
					{ attribute: "url", operator: "starts_with", value: "https://" },
				]),
			];
			expect(
				findMatchingRule(rules, { userId: "u", url: "https://example.com" }),
			).not.toBeNull();
		});

		test("case insensitive", () => {
			const rules = [
				createRule("r", [
					{ attribute: "name", operator: "starts_with", value: "JOHN" },
				]),
			];
			expect(
				findMatchingRule(rules, { userId: "u", name: "john doe" }),
			).not.toBeNull();
		});

		test("fails for non-matching prefix", () => {
			const rules = [
				createRule("r", [
					{ attribute: "url", operator: "starts_with", value: "http://" },
				]),
			];
			expect(
				findMatchingRule(rules, { userId: "u", url: "https://example.com" }),
			).toBeNull();
		});
	});

	describe("ends_with operator", () => {
		test("matches suffix", () => {
			const rules = [
				createRule("r", [
					{ attribute: "email", operator: "ends_with", value: "@gmail.com" },
				]),
			];
			expect(
				findMatchingRule(rules, { userId: "u", email: "user@gmail.com" }),
			).not.toBeNull();
		});

		test("case insensitive", () => {
			const rules = [
				createRule("r", [
					{ attribute: "domain", operator: "ends_with", value: ".COM" },
				]),
			];
			expect(
				findMatchingRule(rules, { userId: "u", domain: "example.com" }),
			).not.toBeNull();
		});

		test("fails for non-matching suffix", () => {
			const rules = [
				createRule("r", [
					{ attribute: "email", operator: "ends_with", value: "@gmail.com" },
				]),
			];
			expect(
				findMatchingRule(rules, { userId: "u", email: "user@yahoo.com" }),
			).toBeNull();
		});
	});

	describe("in operator", () => {
		test("matches when value in list", () => {
			const rules = [
				createRule("r", [
					{ attribute: "country", operator: "in", value: ["US", "CA", "UK"] },
				]),
			];
			expect(
				findMatchingRule(rules, { userId: "u", country: "US" }),
			).not.toBeNull();
		});

		test("fails when value not in list", () => {
			const rules = [
				createRule("r", [
					{ attribute: "country", operator: "in", value: ["US", "CA", "UK"] },
				]),
			];
			expect(
				findMatchingRule(rules, { userId: "u", country: "DE" }),
			).toBeNull();
		});

		test("fails when expected is not array", () => {
			const rules = [
				createRule("r", [
					{ attribute: "country", operator: "in", value: "US" },
				]),
			];
			expect(
				findMatchingRule(rules, { userId: "u", country: "US" }),
			).toBeNull();
		});
	});

	describe("not_in operator", () => {
		test("matches when value not in list", () => {
			const rules = [
				createRule("r", [
					{ attribute: "country", operator: "not_in", value: ["CN", "RU"] },
				]),
			];
			expect(
				findMatchingRule(rules, { userId: "u", country: "US" }),
			).not.toBeNull();
		});

		test("matches when attribute is missing", () => {
			const rules = [
				createRule("r", [
					{ attribute: "banned", operator: "not_in", value: ["true", "yes"] },
				]),
			];
			expect(findMatchingRule(rules, { userId: "u" })).not.toBeNull();
		});

		test("fails when value in list", () => {
			const rules = [
				createRule("r", [
					{ attribute: "country", operator: "not_in", value: ["CN", "RU"] },
				]),
			];
			expect(
				findMatchingRule(rules, { userId: "u", country: "CN" }),
			).toBeNull();
		});
	});

	describe("regex operator", () => {
		test("matches regex pattern", () => {
			const rules = [
				createRule("r", [
					{
						attribute: "email",
						operator: "regex",
						value: "^[a-z]+@company\\.com$",
					},
				]),
			];
			expect(
				findMatchingRule(rules, { userId: "u", email: "john@company.com" }),
			).not.toBeNull();
		});

		test("case insensitive matching", () => {
			const rules = [
				createRule("r", [
					{ attribute: "code", operator: "regex", value: "ABC123" },
				]),
			];
			expect(
				findMatchingRule(rules, { userId: "u", code: "abc123" }),
			).not.toBeNull();
		});

		test("fails for non-matching pattern", () => {
			const rules = [
				createRule("r", [
					{ attribute: "email", operator: "regex", value: "@company\\.com$" },
				]),
			];
			expect(
				findMatchingRule(rules, { userId: "u", email: "user@gmail.com" }),
			).toBeNull();
		});

		test("handles invalid regex gracefully", () => {
			const rules = [
				createRule("r", [
					{ attribute: "val", operator: "regex", value: "[invalid" },
				]),
			];
			expect(findMatchingRule(rules, { userId: "u", val: "test" })).toBeNull();
		});
	});

	describe("semver operators", () => {
		test("semver_gt matches greater version", () => {
			const rules = [
				createRule("r", [
					{ attribute: "version", operator: "semver_gt", value: "1.0.0" },
				]),
			];
			expect(
				findMatchingRule(rules, { userId: "u", version: "2.0.0" }),
			).not.toBeNull();
			expect(
				findMatchingRule(rules, { userId: "u", version: "1.0.1" }),
			).not.toBeNull();
			expect(
				findMatchingRule(rules, { userId: "u", version: "1.0.0" }),
			).toBeNull();
		});

		test("semver_gte matches greater or equal version", () => {
			const rules = [
				createRule("r", [
					{ attribute: "version", operator: "semver_gte", value: "1.0.0" },
				]),
			];
			expect(
				findMatchingRule(rules, { userId: "u", version: "1.0.0" }),
			).not.toBeNull();
			expect(
				findMatchingRule(rules, { userId: "u", version: "2.0.0" }),
			).not.toBeNull();
			expect(
				findMatchingRule(rules, { userId: "u", version: "0.9.0" }),
			).toBeNull();
		});

		test("semver_lt matches lesser version", () => {
			const rules = [
				createRule("r", [
					{ attribute: "version", operator: "semver_lt", value: "2.0.0" },
				]),
			];
			expect(
				findMatchingRule(rules, { userId: "u", version: "1.0.0" }),
			).not.toBeNull();
			expect(
				findMatchingRule(rules, { userId: "u", version: "2.0.0" }),
			).toBeNull();
		});

		test("semver_lte matches lesser or equal version", () => {
			const rules = [
				createRule("r", [
					{ attribute: "version", operator: "semver_lte", value: "2.0.0" },
				]),
			];
			expect(
				findMatchingRule(rules, { userId: "u", version: "2.0.0" }),
			).not.toBeNull();
			expect(
				findMatchingRule(rules, { userId: "u", version: "1.9.0" }),
			).not.toBeNull();
			expect(
				findMatchingRule(rules, { userId: "u", version: "2.0.1" }),
			).toBeNull();
		});

		test("handles v prefix", () => {
			const rules = [
				createRule("r", [
					{ attribute: "version", operator: "semver_gte", value: "v1.0.0" },
				]),
			];
			expect(
				findMatchingRule(rules, { userId: "u", version: "v1.5.0" }),
			).not.toBeNull();
		});

		test("prerelease versions have lower precedence", () => {
			const rules = [
				createRule("r", [
					{ attribute: "version", operator: "semver_gt", value: "1.0.0-alpha" },
				]),
			];
			expect(
				findMatchingRule(rules, { userId: "u", version: "1.0.0" }),
			).not.toBeNull();
		});
	});

	describe("nested attribute access", () => {
		test("accesses nested object attributes with dot notation", () => {
			const rules = [
				createRule("r", [
					{ attribute: "device.type", operator: "eq", value: "mobile" },
				]),
			];
			const context: EvaluationContext = {
				userId: "u",
				device: { type: "mobile", os: "iOS" },
			};
			expect(findMatchingRule(rules, context)).not.toBeNull();
		});

		test("accesses deeply nested attributes", () => {
			const rules = [
				createRule("r", [
					{ attribute: "user.settings.theme", operator: "eq", value: "dark" },
				]),
			];
			const context: EvaluationContext = {
				userId: "u",
				user: { settings: { theme: "dark" } },
			};
			expect(findMatchingRule(rules, context)).not.toBeNull();
		});

		test("returns undefined for missing nested path", () => {
			const rules = [
				createRule("r", [
					{ attribute: "missing.path", operator: "eq", value: "test" },
				]),
			];
			expect(findMatchingRule(rules, { userId: "u" })).toBeNull();
		});
	});

	describe("null/undefined attribute handling", () => {
		test("null attribute fails most operators", () => {
			const rules = [
				createRule("r", [
					{ attribute: "missing", operator: "eq", value: "test" },
				]),
			];
			expect(findMatchingRule(rules, { userId: "u" })).toBeNull();
		});

		test("not_in passes for null attribute", () => {
			const rules = [
				createRule("r", [
					{ attribute: "missing", operator: "not_in", value: ["a", "b"] },
				]),
			];
			expect(findMatchingRule(rules, { userId: "u" })).not.toBeNull();
		});

		test("not_contains passes for null attribute", () => {
			const rules = [
				createRule("r", [
					{ attribute: "missing", operator: "not_contains", value: "test" },
				]),
			];
			expect(findMatchingRule(rules, { userId: "u" })).not.toBeNull();
		});
	});
});

// ============================================================================
// mergeContext Tests
// ============================================================================

describe("mergeContext", () => {
	describe("basic merging", () => {
		test("merges two contexts", () => {
			const ctx1: EvaluationContext = { userId: "user-1" };
			const ctx2: EvaluationContext = { email: "test@example.com" };

			const result = mergeContext(ctx1, ctx2);

			expect(result.userId).toBe("user-1");
			expect(result.email).toBe("test@example.com");
		});

		test("later values override earlier values", () => {
			const ctx1: EvaluationContext = { userId: "user-1", name: "John" };
			const ctx2: EvaluationContext = { name: "Jane" };

			const result = mergeContext(ctx1, ctx2);

			expect(result.userId).toBe("user-1");
			expect(result.name).toBe("Jane");
		});

		test("merges multiple contexts", () => {
			const ctx1: EvaluationContext = { userId: "user-1" };
			const ctx2: EvaluationContext = { email: "test@example.com" };
			const ctx3: EvaluationContext = { plan: "premium" };

			const result = mergeContext(ctx1, ctx2, ctx3);

			expect(result.userId).toBe("user-1");
			expect(result.email).toBe("test@example.com");
			expect(result.plan).toBe("premium");
		});
	});

	describe("deep merging", () => {
		test("deep merges nested objects", () => {
			const ctx1: EvaluationContext = {
				userId: "user-1",
				device: { type: "mobile" },
			};
			const ctx2: EvaluationContext = {
				device: { os: "iOS" },
			};

			const result = mergeContext(ctx1, ctx2);

			expect(result.device).toEqual({ type: "mobile", os: "iOS" });
		});

		test("nested override takes precedence", () => {
			const ctx1: EvaluationContext = {
				userId: "user-1",
				settings: { theme: "light", lang: "en" },
			};
			const ctx2: EvaluationContext = {
				settings: { theme: "dark" },
			};

			const result = mergeContext(ctx1, ctx2);

			expect(result.settings).toEqual({ theme: "dark", lang: "en" });
		});
	});

	describe("edge cases", () => {
		test("handles undefined contexts", () => {
			const ctx1: EvaluationContext = { userId: "user-1" };

			const result = mergeContext(ctx1, undefined);

			expect(result.userId).toBe("user-1");
		});

		test("handles all undefined contexts", () => {
			const result = mergeContext(undefined, undefined);
			expect(result).toEqual({});
		});

		test("skips undefined values", () => {
			const ctx1: EvaluationContext = { userId: "user-1", name: "John" };
			const ctx2: EvaluationContext = { name: undefined as any };

			const result = mergeContext(ctx1, ctx2);

			expect(result.name).toBe("John");
		});

		test("handles empty contexts", () => {
			const result = mergeContext({}, {});
			expect(result).toEqual({});
		});

		test("does not deep merge arrays", () => {
			const ctx1: EvaluationContext = { tags: ["a", "b"] };
			const ctx2: EvaluationContext = { tags: ["c", "d"] };

			const result = mergeContext(ctx1, ctx2);

			expect(result.tags).toEqual(["c", "d"]);
		});
	});
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("targeting integration", () => {
	test("beta user targeting", () => {
		const rules = [
			createRule("beta", [
				{ attribute: "attributes.beta", operator: "eq", value: true },
			]),
		];

		const betaUser: EvaluationContext = {
			userId: "user-1",
			attributes: { beta: true },
		};
		const normalUser: EvaluationContext = {
			userId: "user-2",
			attributes: { beta: false },
		};

		expect(findMatchingRule(rules, betaUser)?.id).toBe("beta");
		expect(findMatchingRule(rules, normalUser)).toBeNull();
	});

	test("geographic targeting", () => {
		const rules = [
			createRule("us-only", [
				{ attribute: "geo.country", operator: "eq", value: "US" },
			]),
			createRule("eu", [
				{
					attribute: "geo.country",
					operator: "in",
					value: ["DE", "FR", "UK", "IT"],
				},
			]),
		];

		const usUser: EvaluationContext = {
			userId: "us-user",
			geo: { country: "US", region: "CA" },
		};
		const euUser: EvaluationContext = {
			userId: "eu-user",
			geo: { country: "DE", region: "Berlin" },
		};
		const otherUser: EvaluationContext = {
			userId: "other",
			geo: { country: "JP" },
		};

		expect(findMatchingRule(rules, usUser)?.id).toBe("us-only");
		expect(findMatchingRule(rules, euUser)?.id).toBe("eu");
		expect(findMatchingRule(rules, otherUser)).toBeNull();
	});

	test("device targeting with merged context", () => {
		const baseContext: EvaluationContext = {
			userId: "user-123",
			attributes: { plan: "premium" },
		};

		const mobileContext: EvaluationContext = {
			device: { type: "mobile", os: "iOS" },
		};

		const rules = [
			createRule("mobile-feature", [
				{ attribute: "device.type", operator: "eq", value: "mobile" },
				{ attribute: "attributes.plan", operator: "eq", value: "premium" },
			]),
		];

		const merged = mergeContext(baseContext, mobileContext);
		expect(findMatchingRule(rules, merged)?.id).toBe("mobile-feature");
	});

	test("version-based rollout", () => {
		const rules = [
			createRule("new-ui", [
				{ attribute: "app.version", operator: "semver_gte", value: "2.0.0" },
			]),
		];

		const oldApp: EvaluationContext = {
			userId: "u1",
			app: { version: "1.5.0" },
		};
		const newApp: EvaluationContext = {
			userId: "u2",
			app: { version: "2.1.0" },
		};

		expect(findMatchingRule(rules, oldApp)).toBeNull();
		expect(findMatchingRule(rules, newApp)?.id).toBe("new-ui");
	});
});
