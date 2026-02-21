/**
 * Local Flag Evaluator Tests
 *
 * Tests for client-side feature flag evaluation.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
	LocalEvaluator,
	getEvaluator,
	initFeatureFlags,
	resetEvaluator,
} from "../../src/lib/flags/evaluator";
import type {
	EvaluationContext,
	FlagDefinition,
	FlagVariant,
} from "../../src/lib/flags/types";

// ============================================================================
// Test Fixtures
// ============================================================================

function createFlag(overrides: Partial<FlagDefinition> = {}): FlagDefinition {
	return {
		key: "test-flag",
		enabled: true,
		defaultVariant: "control",
		variants: [
			{ key: "control", value: false, weight: 50 },
			{ key: "treatment", value: true, weight: 50 },
		],
		rules: [],
		salt: "test-salt",
		...overrides,
	};
}

function createBooleanFlag(
	key: string,
	enabled: boolean,
	defaultValue = true,
): FlagDefinition {
	return {
		key,
		enabled,
		defaultVariant: defaultValue ? "on" : "off",
		variants: [
			{ key: "on", value: true },
			{ key: "off", value: false },
		],
		rules: [],
	};
}

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
			const flags = [
				createBooleanFlag("flag-1", true),
				createBooleanFlag("flag-2", false),
			];

			evaluator.setFlags(flags);
			expect(evaluator.getFlags().length).toBe(2);
		});

		test("getFlag retrieves specific flag", () => {
			const flag = createBooleanFlag("my-flag", true);
			evaluator.setFlags([flag]);

			expect(evaluator.getFlag("my-flag")).toBeDefined();
			expect(evaluator.getFlag("non-existent")).toBeUndefined();
		});

		test("updateFlag updates existing flag", () => {
			evaluator.setFlags([createBooleanFlag("flag", true)]);
			evaluator.updateFlag(createBooleanFlag("flag", false));

			const updated = evaluator.getFlag("flag");
			expect(updated?.enabled).toBe(false);
		});

		test("removeFlag removes flag", () => {
			evaluator.setFlags([createBooleanFlag("flag", true)]);
			evaluator.removeFlag("flag");

			expect(evaluator.getFlag("flag")).toBeUndefined();
		});

		test("setFlags increments version", () => {
			const initialVersion = evaluator.getState().version;
			evaluator.setFlags([createBooleanFlag("flag", true)]);
			expect(evaluator.getState().version).toBeGreaterThan(initialVersion);
		});
	});

	describe("context management", () => {
		test("setContext sets evaluation context", () => {
			const context = { userId: "user-123", email: "test@example.com" };
			evaluator.setContext(context);

			expect(evaluator.getContext()).toEqual(context);
		});

		test("updateContext merges with existing", () => {
			evaluator.setContext({ userId: "user-123" });
			evaluator.updateContext({ email: "test@example.com" });

			const ctx = evaluator.getContext();
			expect(ctx.userId).toBe("user-123");
			expect(ctx.email).toBe("test@example.com");
		});

		test("getContext returns copy", () => {
			evaluator.setContext({ userId: "user-123" });
			const ctx = evaluator.getContext();
			ctx.userId = "modified";

			expect(evaluator.getContext().userId).toBe("user-123");
		});
	});

	describe("isEnabled", () => {
		test("returns true for enabled flag", () => {
			evaluator.setFlags([createBooleanFlag("feature", true)]);
			expect(evaluator.isEnabled("feature")).toBe(true);
		});

		test("returns default variant value for disabled flag", () => {
			// Disabled flag returns its default variant's value (not the default param)
			evaluator.setFlags([createBooleanFlag("feature", false, false)]); // default variant 'off' = false
			expect(evaluator.isEnabled("feature")).toBe(false);

			// Even with default variant 'on', disabled flag returns variant value
			evaluator.setFlags([createBooleanFlag("feature", false, true)]);
			expect(evaluator.isEnabled("feature")).toBe(true); // default variant 'on' = true
		});

		test("returns default for missing flag", () => {
			// Use different flag keys to avoid caching effects
			expect(evaluator.isEnabled("missing-1", true)).toBe(true);
			expect(evaluator.isEnabled("missing-2", false)).toBe(false);
		});
	});

	describe("getString", () => {
		test("returns string variant value", () => {
			const flag: FlagDefinition = {
				key: "greeting",
				enabled: true,
				defaultVariant: "english",
				variants: [
					{ key: "english", value: "Hello" },
					{ key: "spanish", value: "Hola" },
				],
				rules: [],
			};
			evaluator.setFlags([flag]);

			const result = evaluator.getString("greeting");
			expect(["Hello", "Hola"]).toContain(result);
		});

		test("returns default for missing flag", () => {
			expect(evaluator.getString("missing", "default")).toBe("default");
		});
	});

	describe("getNumber", () => {
		test("returns number variant value", () => {
			const flag: FlagDefinition = {
				key: "limit",
				enabled: true,
				defaultVariant: "standard",
				variants: [
					{ key: "standard", value: 10 },
					{ key: "premium", value: 100 },
				],
				rules: [],
			};
			evaluator.setFlags([flag]);

			const result = evaluator.getNumber("limit");
			expect([10, 100]).toContain(result);
		});

		test("returns default for missing flag", () => {
			expect(evaluator.getNumber("missing", 42)).toBe(42);
		});
	});

	describe("getJSON", () => {
		test("returns JSON variant value", () => {
			const flag: FlagDefinition = {
				key: "config",
				enabled: true,
				defaultVariant: "default",
				variants: [{ key: "default", value: { maxItems: 10, theme: "light" } }],
				rules: [],
			};
			evaluator.setFlags([flag]);

			const result = evaluator.getJSON("config", { maxItems: 0, theme: "" });
			expect(result).toEqual({ maxItems: 10, theme: "light" });
		});
	});

	describe("evaluate", () => {
		test("returns full evaluation result", () => {
			evaluator.setFlags([createBooleanFlag("feature", true)]);

			const result = evaluator.evaluate<boolean>("feature", false);

			expect(result).toHaveProperty("value");
			expect(result).toHaveProperty("variant");
			expect(result).toHaveProperty("enabled");
			expect(result).toHaveProperty("reason");
		});

		test("returns error reason for missing flag", () => {
			const result = evaluator.evaluate("missing", "default");

			expect(result.reason).toBe("error");
			expect(result.value).toBe("default");
			expect(result.enabled).toBe(false);
		});

		test("returns flag_disabled reason for disabled flag", () => {
			evaluator.setFlags([createBooleanFlag("feature", false)]);

			const result = evaluator.evaluate("feature", true);

			expect(result.reason).toBe("flag_disabled");
			expect(result.enabled).toBe(false);
		});

		test("accepts context override", () => {
			const flag: FlagDefinition = {
				key: "vip-feature",
				enabled: true,
				defaultVariant: "off",
				variants: [
					{ key: "on", value: true },
					{ key: "off", value: false },
				],
				rules: [
					{
						id: "vip-rule",
						variant: "on",
						conditions: [
							{
								attribute: "attributes.plan",
								operator: "eq",
								value: "premium",
							},
						],
					},
				],
			};
			evaluator.setFlags([flag]);

			// Without override
			const result1 = evaluator.evaluate("vip-feature", false);

			// With override
			const result2 = evaluator.evaluate("vip-feature", false, {
				attributes: { plan: "premium" },
			});

			expect(result2.value).toBe(true);
			expect(result2.matchedRule).toBe("vip-rule");
		});
	});

	describe("evaluateAll", () => {
		test("evaluates multiple flags", () => {
			evaluator.setFlags([
				createBooleanFlag("flag-1", true),
				createBooleanFlag("flag-2", true),
				createBooleanFlag("flag-3", false),
			]);

			const results = evaluator.evaluateAll(["flag-1", "flag-2", "flag-3"]);

			expect(results.size).toBe(3);
			expect(results.has("flag-1")).toBe(true);
			expect(results.has("flag-2")).toBe(true);
			expect(results.has("flag-3")).toBe(true);
		});
	});

	describe("targeting rules", () => {
		test("matches rule condition", () => {
			const flag: FlagDefinition = {
				key: "beta-feature",
				enabled: true,
				defaultVariant: "off",
				variants: [
					{ key: "on", value: true },
					{ key: "off", value: false },
				],
				rules: [
					{
						id: "beta-users",
						variant: "on",
						conditions: [
							{
								attribute: "email",
								operator: "ends_with",
								value: "@beta.com",
							},
						],
					},
				],
			};
			evaluator.setFlags([flag]);
			evaluator.setContext({ email: "user@beta.com" });

			const result = evaluator.evaluate("beta-feature", false);

			expect(result.value).toBe(true);
			expect(result.matchedRule).toBe("beta-users");
			expect(result.reason).toBe("rule_match");
		});

		test("respects percentage rollout in rule", () => {
			const flag: FlagDefinition = {
				key: "gradual-rollout",
				enabled: true,
				defaultVariant: "off",
				variants: [
					{ key: "on", value: true },
					{ key: "off", value: false },
				],
				rules: [
					{
						id: "rollout",
						variant: "on",
						percentage: 0, // 0% rollout
						conditions: [],
					},
				],
				salt: "test",
			};
			evaluator.setFlags([flag]);
			evaluator.setContext({ userId: "test-user" });

			const result = evaluator.evaluate("gradual-rollout", false);

			expect(result.value).toBe(false);
			expect(result.reason).toBe("percentage_rollout");
		});
	});

	describe("variant selection", () => {
		test("selects variant based on user bucket", () => {
			const flag: FlagDefinition = {
				key: "ab-test",
				enabled: true,
				defaultVariant: "control",
				variants: [
					{ key: "control", value: "A", weight: 50 },
					{ key: "treatment", value: "B", weight: 50 },
				],
				rules: [],
				salt: "test-salt",
			};
			evaluator.setFlags([flag]);

			// Same user should always get same variant
			evaluator.setContext({ userId: "consistent-user" });
			const result1 = evaluator.evaluate("ab-test", "default");
			const result2 = evaluator.evaluate("ab-test", "default");

			expect(result1.variant).toBe(result2.variant);
		});

		test("consistent bucketing across evaluator instances", () => {
			const flag = createFlag({ key: "consistent-flag", salt: "same-salt" });

			const evaluator1 = new LocalEvaluator({ offlineSupport: false });
			const evaluator2 = new LocalEvaluator({ offlineSupport: false });

			evaluator1.setFlags([flag]);
			evaluator2.setFlags([flag]);

			evaluator1.setContext({ userId: "user-123" });
			evaluator2.setContext({ userId: "user-123" });

			const result1 = evaluator1.evaluate("consistent-flag", false);
			const result2 = evaluator2.evaluate("consistent-flag", false);

			expect(result1.variant).toBe(result2.variant);
		});
	});

	describe("caching", () => {
		test("caches evaluation results", () => {
			let evaluationCount = 0;
			const evaluator = new LocalEvaluator({
				offlineSupport: false,
				onEvaluation: () => {
					evaluationCount++;
				},
			});

			evaluator.setFlags([createBooleanFlag("cached-flag", true)]);
			evaluator.setContext({ userId: "user-123" });

			// First evaluation
			evaluator.evaluate("cached-flag", false);
			// Second evaluation should use cache
			evaluator.evaluate("cached-flag", false);

			// Only one actual evaluation (cache hit on second)
			expect(evaluationCount).toBe(1);
		});

		test("clearCache clears evaluation cache", () => {
			const evaluator = new LocalEvaluator({ offlineSupport: false });
			evaluator.setFlags([createBooleanFlag("flag", true)]);
			evaluator.evaluate("flag", false);

			expect(evaluator.getState().cacheSize).toBeGreaterThan(0);

			evaluator.clearCache();

			expect(evaluator.getState().cacheSize).toBe(0);
		});

		test("context change clears cache", () => {
			evaluator.setFlags([createBooleanFlag("flag", true)]);
			evaluator.setContext({ userId: "user-1" });
			evaluator.evaluate("flag", false);

			expect(evaluator.getState().cacheSize).toBeGreaterThan(0);

			evaluator.setContext({ userId: "user-2" });

			expect(evaluator.getState().cacheSize).toBe(0);
		});
	});

	describe("getState", () => {
		test("returns evaluator state", () => {
			evaluator.setFlags([createBooleanFlag("flag", true)]);
			evaluator.evaluate("flag", false);

			const state = evaluator.getState();

			expect(state).toHaveProperty("flagCount");
			expect(state).toHaveProperty("cacheSize");
			expect(state).toHaveProperty("fetchedAt");
			expect(state).toHaveProperty("version");
			expect(state).toHaveProperty("isStale");
		});

		test("flagCount reflects number of flags", () => {
			evaluator.setFlags([
				createBooleanFlag("flag-1", true),
				createBooleanFlag("flag-2", true),
			]);

			expect(evaluator.getState().flagCount).toBe(2);
		});
	});

	describe("reset", () => {
		test("resets all state", () => {
			evaluator.setFlags([createBooleanFlag("flag", true)]);
			evaluator.setContext({ userId: "user" });
			evaluator.evaluate("flag", false);

			evaluator.reset();

			expect(evaluator.getFlags().length).toBe(0);
			expect(evaluator.getContext()).toEqual({});
			expect(evaluator.getState().cacheSize).toBe(0);
			expect(evaluator.getState().version).toBe(0);
		});
	});
});

// ============================================================================
// Singleton Functions Tests
// ============================================================================

describe("singleton functions", () => {
	afterEach(() => {
		resetEvaluator();
	});

	describe("getEvaluator", () => {
		test("returns same instance on multiple calls", () => {
			const evaluator1 = getEvaluator();
			const evaluator2 = getEvaluator();

			expect(evaluator1).toBe(evaluator2);
		});
	});

	describe("initFeatureFlags", () => {
		test("creates new evaluator instance", () => {
			const evaluator1 = initFeatureFlags({ debug: false });
			const evaluator2 = initFeatureFlags({ debug: true });

			// Each init creates a new instance
			expect(evaluator1).not.toBe(evaluator2);
		});
	});

	describe("resetEvaluator", () => {
		test("resets singleton", () => {
			const evaluator1 = getEvaluator();
			evaluator1.setFlags([createBooleanFlag("flag", true)]);

			resetEvaluator();

			const evaluator2 = getEvaluator();
			expect(evaluator2.getFlags().length).toBe(0);
		});
	});
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("evaluator integration", () => {
	let evaluator: LocalEvaluator;

	beforeEach(() => {
		evaluator = new LocalEvaluator({ offlineSupport: false });
	});

	afterEach(() => {
		resetEvaluator();
	});

	test("evaluation with different user contexts", () => {
		// Simple flag for email-based targeting
		const flag: FlagDefinition = {
			key: "beta-feature",
			enabled: true,
			defaultVariant: "off",
			variants: [
				{ key: "on", value: true },
				{ key: "off", value: false },
			],
			rules: [
				{
					id: "beta-testers",
					variant: "on",
					conditions: [
						{ attribute: "email", operator: "ends_with", value: "@beta.com" },
					],
				},
			],
		};

		// Beta user (matches rule)
		const betaEvaluator = new LocalEvaluator({ offlineSupport: false });
		betaEvaluator.setFlags([flag]);
		betaEvaluator.setContext({ email: "user@beta.com" });
		const betaResult = betaEvaluator.evaluate("beta-feature", false);
		expect(betaResult.value).toBe(true);
		expect(betaResult.matchedRule).toBe("beta-testers");

		// Regular user (no rule match)
		const regularEvaluator = new LocalEvaluator({ offlineSupport: false });
		regularEvaluator.setFlags([flag]);
		regularEvaluator.setContext({ email: "user@regular.com" });
		const regularResult = regularEvaluator.evaluate("beta-feature", false);
		expect(regularResult.value).toBe(false);
		expect(regularResult.matchedRule).toBeUndefined();
	});

	test("callback invocation", () => {
		const evaluations: string[] = [];
		const flagUpdates: number[] = [];

		const evaluator = new LocalEvaluator({
			offlineSupport: false,
			onEvaluation: (key) => evaluations.push(key),
			onFlagsUpdated: (flags) => flagUpdates.push(flags.length),
		});

		evaluator.setFlags([
			createBooleanFlag("flag-1", true),
			createBooleanFlag("flag-2", true),
		]);

		evaluator.evaluate("flag-1", false);
		evaluator.clearCache(); // Clear cache to trigger new evaluation
		evaluator.evaluate("flag-2", false);

		expect(flagUpdates).toContain(2);
		expect(evaluations).toContain("flag-1");
		expect(evaluations).toContain("flag-2");
	});

	test("debug mode logging", () => {
		const consoleLogs: string[] = [];
		const originalLog = console.log;
		console.log = (...args) => {
			consoleLogs.push(args.join(" "));
		};

		try {
			const evaluator = new LocalEvaluator({
				offlineSupport: false,
				debug: true,
			});

			evaluator.setFlags([createBooleanFlag("flag", true)]);
			evaluator.setContext({ userId: "user" });
			evaluator.evaluate("flag", false);

			expect(consoleLogs.some((log) => log.includes("[FeatureFlags]"))).toBe(
				true,
			);
		} finally {
			console.log = originalLog;
		}
	});
});
