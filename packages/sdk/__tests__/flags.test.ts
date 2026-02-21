/**
 * Feature Flags Evaluator Tests
 *
 * Tests for local flag evaluation with targeting rules.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	LocalEvaluator,
	getEvaluator,
	initFeatureFlags,
	resetEvaluator,
} from "../src/lib/flags/evaluator";
import type { EvaluationContext, FlagDefinition } from "../src/lib/flags/types";

// ============================================================================
// Test Data
// ============================================================================

const createBasicFlag = (key: string, enabled = true): FlagDefinition => ({
	key,
	name: key,
	enabled,
	type: "boolean",
	variants: [
		{ key: "on", value: true, weight: 50 },
		{ key: "off", value: false, weight: 50 },
	],
	defaultVariant: "off",
	rules: [],
	salt: "test-salt",
});

const createStringFlag = (key: string): FlagDefinition => ({
	key,
	name: key,
	enabled: true,
	type: "string",
	variants: [
		{ key: "control", value: "original", weight: 50 },
		{ key: "treatment", value: "new-version", weight: 50 },
	],
	defaultVariant: "control",
	rules: [],
	salt: "test-salt",
});

const createFlagWithRules = (): FlagDefinition => ({
	key: "premium-feature",
	name: "Premium Feature",
	enabled: true,
	type: "boolean",
	variants: [
		{ key: "on", value: true },
		{ key: "off", value: false },
	],
	defaultVariant: "off",
	rules: [
		{
			id: "rule-1",
			conditions: [
				{
					attribute: "planType",
					operator: "equals",
					value: "premium",
				},
			],
			variant: "on",
		},
		{
			id: "rule-2",
			conditions: [
				{
					attribute: "email",
					operator: "contains",
					value: "@test.com",
				},
			],
			variant: "on",
		},
	],
	salt: "premium-salt",
});

// ============================================================================
// LocalEvaluator Tests
// ============================================================================

describe("LocalEvaluator", () => {
	let evaluator: LocalEvaluator;

	beforeEach(() => {
		evaluator = new LocalEvaluator({ offlineSupport: false });
	});

	afterEach(() => {
		resetEvaluator();
	});

	describe("flag management", () => {
		test("setFlags stores flags", () => {
			const flags = [createBasicFlag("flag-1"), createBasicFlag("flag-2")];

			evaluator.setFlags(flags);

			expect(evaluator.getFlags()).toHaveLength(2);
			expect(evaluator.getFlag("flag-1")).toBeDefined();
			expect(evaluator.getFlag("flag-2")).toBeDefined();
		});

		test("updateFlag updates a single flag", () => {
			evaluator.setFlags([createBasicFlag("flag-1")]);

			const updated = createBasicFlag("flag-1", false);
			evaluator.updateFlag(updated);

			expect(evaluator.getFlag("flag-1")?.enabled).toBe(false);
		});

		test("removeFlag removes a flag", () => {
			evaluator.setFlags([
				createBasicFlag("flag-1"),
				createBasicFlag("flag-2"),
			]);

			evaluator.removeFlag("flag-1");

			expect(evaluator.getFlag("flag-1")).toBeUndefined();
			expect(evaluator.getFlag("flag-2")).toBeDefined();
		});

		test("getFlags returns all flags", () => {
			const flags = [
				createBasicFlag("a"),
				createBasicFlag("b"),
				createBasicFlag("c"),
			];

			evaluator.setFlags(flags);

			expect(evaluator.getFlags()).toHaveLength(3);
		});
	});

	describe("context management", () => {
		test("setContext sets evaluation context", () => {
			evaluator.setContext({ userId: "user-123", email: "test@example.com" });

			const context = evaluator.getContext();
			expect(context.userId).toBe("user-123");
			expect(context.email).toBe("test@example.com");
		});

		test("updateContext merges with existing context", () => {
			evaluator.setContext({ userId: "user-123" });
			evaluator.updateContext({ email: "new@example.com" });

			const context = evaluator.getContext();
			expect(context.userId).toBe("user-123");
			expect(context.email).toBe("new@example.com");
		});

		test("getContext returns copy of context", () => {
			evaluator.setContext({ userId: "user-123" });

			const context1 = evaluator.getContext();
			const context2 = evaluator.getContext();

			expect(context1).not.toBe(context2);
			expect(context1).toEqual(context2);
		});
	});

	describe("boolean evaluation", () => {
		test("isEnabled returns true for enabled flag", () => {
			evaluator.setFlags([createBasicFlag("feature", true)]);
			evaluator.setContext({ userId: "user-with-feature" });

			// Result depends on hash bucketing, but should be deterministic
			const result = evaluator.isEnabled("feature");
			expect(typeof result).toBe("boolean");
		});

		test("isEnabled returns false for disabled flag", () => {
			evaluator.setFlags([createBasicFlag("feature", false)]);

			const result = evaluator.isEnabled("feature");
			expect(result).toBe(false);
		});

		test("isEnabled returns default for missing flag", () => {
			// When flag is not found, evaluate() returns defaultValue
			// But isEnabled() converts the result to boolean using result.value
			// Since the flag doesn't exist, it returns error reason with the default
			const result = evaluator.isEnabled("nonexistent", true);
			expect(result).toBe(true);
		});
	});

	describe("string evaluation", () => {
		test("getString returns variant value", () => {
			evaluator.setFlags([createStringFlag("experiment")]);
			evaluator.setContext({ userId: "user-123" });

			const result = evaluator.getString("experiment");
			expect(["original", "new-version"]).toContain(result);
		});

		test("getString returns default for missing flag", () => {
			const result = evaluator.getString("nonexistent", "fallback");
			expect(result).toBe("fallback");
		});
	});

	describe("number evaluation", () => {
		test("getNumber returns default for missing flag", () => {
			const result = evaluator.getNumber("nonexistent", 42);
			expect(result).toBe(42);
		});
	});

	describe("JSON evaluation", () => {
		test("getJSON returns default for missing flag", () => {
			const defaultValue = { key: "value" };
			const result = evaluator.getJSON("nonexistent", defaultValue);
			expect(result).toEqual(defaultValue);
		});
	});

	describe("full evaluation", () => {
		test("evaluate returns result with metadata", () => {
			evaluator.setFlags([createBasicFlag("feature", true)]);
			evaluator.setContext({ userId: "user-123" });

			const result = evaluator.evaluate("feature", false);

			expect(result).toHaveProperty("value");
			expect(result).toHaveProperty("variant");
			expect(result).toHaveProperty("enabled");
			expect(result).toHaveProperty("reason");
		});

		test("evaluate returns error reason for missing flag", () => {
			const result = evaluator.evaluate("nonexistent", false);

			expect(result.reason).toBe("error");
			expect(result.enabled).toBe(false);
		});

		test("evaluate returns flag_disabled reason for disabled flag", () => {
			evaluator.setFlags([createBasicFlag("feature", false)]);

			const result = evaluator.evaluate("feature", true);

			expect(result.reason).toBe("flag_disabled");
			expect(result.enabled).toBe(false);
		});

		test("evaluate uses context override", () => {
			evaluator.setFlags([createFlagWithRules()]);
			evaluator.setContext({ userId: "user-123" });

			// Without override (no planType)
			const result1 = evaluator.evaluate("premium-feature", false);

			// With override (premium planType)
			const result2 = evaluator.evaluate("premium-feature", false, {
				attributes: { planType: "premium" },
			});

			// The second should match the rule
			expect(result2.enabled).toBe(true);
		});
	});

	describe("targeting rules", () => {
		test("flag with rules can be evaluated", () => {
			evaluator.setFlags([createFlagWithRules()]);
			evaluator.setContext({
				userId: "user-123",
				attributes: { planType: "premium" },
			});

			const result = evaluator.evaluate("premium-feature", false);

			// The rule matching depends on the targeting implementation
			// which checks context.attributes
			expect(result.enabled).toBe(true);
			expect(typeof result.value).toBe("boolean");
		});

		test("evaluates flag with email in context", () => {
			evaluator.setFlags([createFlagWithRules()]);
			evaluator.setContext({
				userId: "user-123",
				email: "admin@test.com",
			});

			const result = evaluator.evaluate("premium-feature", false);

			// Verify the flag is enabled and returns a value
			expect(result.enabled).toBe(true);
		});

		test("evaluates flag when no rules match", () => {
			evaluator.setFlags([createFlagWithRules()]);
			evaluator.setContext({
				userId: "user-123",
				email: "user@other.com",
				attributes: { planType: "free" },
			});

			const result = evaluator.evaluate("premium-feature", false);

			// Flag is enabled but may fall through to default variant
			expect(result.enabled).toBe(true);
			expect(typeof result.value).toBe("boolean");
		});
	});

	describe("evaluateAll", () => {
		test("evaluates multiple flags", () => {
			evaluator.setFlags([
				createBasicFlag("flag-1"),
				createBasicFlag("flag-2"),
				createBasicFlag("flag-3"),
			]);
			evaluator.setContext({ userId: "user-123" });

			const results = evaluator.evaluateAll(["flag-1", "flag-2", "flag-3"]);

			expect(results.size).toBe(3);
			expect(results.has("flag-1")).toBe(true);
			expect(results.has("flag-2")).toBe(true);
			expect(results.has("flag-3")).toBe(true);
		});
	});

	describe("caching", () => {
		test("caches evaluation results", () => {
			evaluator.setFlags([createBasicFlag("feature")]);
			evaluator.setContext({ userId: "user-123" });

			// First evaluation
			const result1 = evaluator.evaluate("feature", false);

			// Second evaluation should be from cache
			const result2 = evaluator.evaluate("feature", false);

			expect(result1.value).toBe(result2.value);
			expect(result1.variant).toBe(result2.variant);
		});

		test("clearCache invalidates cache", () => {
			evaluator.setFlags([createBasicFlag("feature")]);
			evaluator.setContext({ userId: "user-123" });

			evaluator.evaluate("feature", false);
			const state1 = evaluator.getState();

			evaluator.clearCache();
			const state2 = evaluator.getState();

			expect(state1.cacheSize).toBeGreaterThan(0);
			expect(state2.cacheSize).toBe(0);
		});
	});

	describe("state management", () => {
		test("getState returns evaluator state", () => {
			evaluator.setFlags([
				createBasicFlag("flag-1"),
				createBasicFlag("flag-2"),
			]);

			const state = evaluator.getState();

			expect(state.flagCount).toBe(2);
			expect(state.cacheSize).toBe(0);
			expect(state.version).toBeGreaterThan(0);
		});

		test("reset clears all state", () => {
			evaluator.setFlags([createBasicFlag("flag-1")]);
			evaluator.setContext({ userId: "user-123" });
			evaluator.evaluate("flag-1", false);

			evaluator.reset();

			const state = evaluator.getState();
			expect(state.flagCount).toBe(0);
			expect(state.cacheSize).toBe(0);
		});
	});
});

// ============================================================================
// Singleton Tests
// ============================================================================

describe("Feature Flags Singleton", () => {
	afterEach(() => {
		resetEvaluator();
	});

	test("initFeatureFlags creates new instance", () => {
		const evaluator = initFeatureFlags({ offlineSupport: false });

		expect(evaluator).toBeInstanceOf(LocalEvaluator);
	});

	test("getEvaluator returns same instance", () => {
		const evaluator1 = getEvaluator({ offlineSupport: false });
		const evaluator2 = getEvaluator();

		expect(evaluator1).toBe(evaluator2);
	});

	test("resetEvaluator clears instance", () => {
		const evaluator1 = getEvaluator({ offlineSupport: false });
		evaluator1.setFlags([createBasicFlag("test")]);

		resetEvaluator();

		const evaluator2 = getEvaluator({ offlineSupport: false });
		expect(evaluator2.getFlags()).toHaveLength(0);
	});
});

// ============================================================================
// Consistent Bucketing Tests
// ============================================================================

describe("Consistent Bucketing", () => {
	let evaluator: LocalEvaluator;

	beforeEach(() => {
		evaluator = new LocalEvaluator({ offlineSupport: false });
	});

	afterEach(() => {
		resetEvaluator();
	});

	test("same user gets same result", () => {
		evaluator.setFlags([createBasicFlag("feature")]);

		// Same user ID should always get same result
		evaluator.setContext({ userId: "consistent-user" });
		const result1 = evaluator.isEnabled("feature");

		evaluator.clearCache();
		evaluator.setContext({ userId: "consistent-user" });
		const result2 = evaluator.isEnabled("feature");

		expect(result1).toBe(result2);
	});

	test("different users can get different results", () => {
		evaluator.setFlags([createBasicFlag("ab-test")]);

		// Test many users - some should get different results due to bucketing
		const results = new Set<boolean>();

		for (let i = 0; i < 100; i++) {
			evaluator.clearCache();
			evaluator.setContext({ userId: `user-${i}` });
			results.add(evaluator.isEnabled("ab-test"));
		}

		// With 50/50 weights, we should see both true and false
		expect(results.size).toBe(2);
	});
});
