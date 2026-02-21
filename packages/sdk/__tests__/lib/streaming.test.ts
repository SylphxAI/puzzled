/**
 * Feature Flags Streaming Tests
 *
 * Tests for streaming utilities and pure functions from streaming.ts.
 * EventSource-dependent code is tested via E2E tests.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { LocalEvaluator } from "../../src/lib/flags/evaluator";
import { fetchFlags, pollFlags } from "../../src/lib/flags/streaming";
import type { FlagDefinition } from "../../src/lib/flags/types";

// ============================================================================
// Mock Fetch
// ============================================================================

const originalFetch = global.fetch;

// ============================================================================
// Test Data
// ============================================================================

const mockFlags: FlagDefinition[] = [
	{
		key: "feature-a",
		name: "Feature A",
		enabled: true,
		defaultVariant: "control",
		variants: [
			{ key: "control", value: false, weight: 50 },
			{ key: "treatment", value: true, weight: 50 },
		],
		rules: [],
		salt: "test-salt",
	},
	{
		key: "feature-b",
		name: "Feature B",
		enabled: true,
		defaultVariant: "on",
		variants: [{ key: "on", value: true, weight: 100 }],
		rules: [],
		salt: "test-salt-b",
	},
];

// ============================================================================
// fetchFlags Tests
// ============================================================================

describe("fetchFlags", () => {
	beforeEach(() => {
		// Reset fetch mock
		global.fetch = mock((url: string) => {
			return Promise.resolve({
				ok: true,
				status: 200,
				json: () => Promise.resolve(mockFlags),
			} as Response);
		});
	});

	afterEach(() => {
		global.fetch = originalFetch;
	});

	describe("basic functionality", () => {
		test("fetches flags from endpoint", async () => {
			const flags = await fetchFlags("https://api.example.com/flags");
			expect(flags).toEqual(mockFlags);
		});

		test("includes Accept header", async () => {
			await fetchFlags("https://api.example.com/flags");

			expect(global.fetch).toHaveBeenCalledTimes(1);
			const [, options] = (global.fetch as ReturnType<typeof mock>).mock
				.calls[0];
			expect(options?.headers).toEqual({ Accept: "application/json" });
		});

		test("builds URL with base endpoint", async () => {
			await fetchFlags("https://api.example.com/flags");

			const [url] = (global.fetch as ReturnType<typeof mock>).mock.calls[0];
			expect(url).toContain("https://api.example.com/flags");
		});
	});

	describe("environment key", () => {
		test("appends environment key as query parameter", async () => {
			await fetchFlags("https://api.example.com/flags", "env-123");

			const [url] = (global.fetch as ReturnType<typeof mock>).mock.calls[0];
			expect(url).toContain("key=env-123");
		});

		test("works without environment key", async () => {
			await fetchFlags("https://api.example.com/flags");

			const [url] = (global.fetch as ReturnType<typeof mock>).mock.calls[0];
			expect(url).not.toContain("key=");
		});
	});

	describe("error handling", () => {
		test("throws on non-OK response", async () => {
			global.fetch = mock(() =>
				Promise.resolve({
					ok: false,
					status: 500,
				} as Response),
			);

			await expect(fetchFlags("https://api.example.com/flags")).rejects.toThrow(
				"Failed to fetch flags: 500",
			);
		});

		test("throws on 404", async () => {
			global.fetch = mock(() =>
				Promise.resolve({
					ok: false,
					status: 404,
				} as Response),
			);

			await expect(fetchFlags("https://api.example.com/flags")).rejects.toThrow(
				"Failed to fetch flags: 404",
			);
		});

		test("propagates network errors", async () => {
			global.fetch = mock(() => Promise.reject(new Error("Network error")));

			await expect(fetchFlags("https://api.example.com/flags")).rejects.toThrow(
				"Network error",
			);
		});
	});
});

// ============================================================================
// pollFlags Tests
// ============================================================================

describe("pollFlags", () => {
	let evaluator: LocalEvaluator;
	let fetchCallCount: number;

	beforeEach(() => {
		fetchCallCount = 0;
		evaluator = new LocalEvaluator({ offlineSupport: false, debug: false });

		global.fetch = mock(() => {
			fetchCallCount++;
			return Promise.resolve({
				ok: true,
				status: 200,
				json: () => Promise.resolve(mockFlags),
			} as Response);
		});
	});

	afterEach(() => {
		global.fetch = originalFetch;
	});

	describe("initial fetch", () => {
		test("fetches flags immediately on start", async () => {
			const cleanup = pollFlags(evaluator, "https://api.example.com/flags", {
				interval: 60000, // Long interval so we only test initial fetch
			});

			// Wait a tick for the initial fetch
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(fetchCallCount).toBe(1);
			cleanup();
		});

		test("updates evaluator with fetched flags", async () => {
			const cleanup = pollFlags(evaluator, "https://api.example.com/flags", {
				interval: 60000,
			});

			// Wait for initial fetch
			await new Promise((resolve) => setTimeout(resolve, 10));

			const flags = evaluator.getFlags();
			expect(flags.length).toBe(2);
			expect(flags.map((f) => f.key)).toContain("feature-a");
			expect(flags.map((f) => f.key)).toContain("feature-b");

			cleanup();
		});
	});

	describe("polling behavior", () => {
		test("polls at specified interval", async () => {
			const cleanup = pollFlags(evaluator, "https://api.example.com/flags", {
				interval: 50, // Short interval for testing
			});

			// Wait for initial fetch + one interval
			await new Promise((resolve) => setTimeout(resolve, 80));

			expect(fetchCallCount).toBeGreaterThanOrEqual(2);
			cleanup();
		});

		test("cleanup stops polling", async () => {
			const cleanup = pollFlags(evaluator, "https://api.example.com/flags", {
				interval: 50,
			});

			// Wait for initial fetch
			await new Promise((resolve) => setTimeout(resolve, 10));
			const countAfterInit = fetchCallCount;

			cleanup();

			// Wait for what would be another interval
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Should not have fetched again
			expect(fetchCallCount).toBe(countAfterInit);
		});
	});

	describe("environment key", () => {
		test("passes environment key to fetch", async () => {
			const cleanup = pollFlags(evaluator, "https://api.example.com/flags", {
				environmentKey: "env-key-123",
				interval: 60000,
			});

			await new Promise((resolve) => setTimeout(resolve, 10));

			const [url] = (global.fetch as ReturnType<typeof mock>).mock.calls[0];
			expect(url).toContain("key=env-key-123");

			cleanup();
		});
	});

	describe("error handling", () => {
		test("calls onError callback on fetch failure", async () => {
			const errors: Error[] = [];

			global.fetch = mock(() =>
				Promise.resolve({
					ok: false,
					status: 500,
				} as Response),
			);

			const cleanup = pollFlags(evaluator, "https://api.example.com/flags", {
				interval: 60000,
				onError: (error) => errors.push(error),
			});

			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(errors.length).toBe(1);
			expect(errors[0].message).toContain("Failed to fetch flags");

			cleanup();
		});

		test("continues polling after error", async () => {
			let callCount = 0;
			global.fetch = mock(() => {
				callCount++;
				if (callCount === 1) {
					return Promise.reject(new Error("Network error"));
				}
				return Promise.resolve({
					ok: true,
					status: 200,
					json: () => Promise.resolve(mockFlags),
				} as Response);
			});

			const cleanup = pollFlags(evaluator, "https://api.example.com/flags", {
				interval: 30,
				onError: () => {},
			});

			// Wait for initial (failed) + retry
			await new Promise((resolve) => setTimeout(resolve, 80));

			expect(callCount).toBeGreaterThanOrEqual(2);
			cleanup();
		});
	});

	describe("default interval", () => {
		test("uses default polling interval when not specified", async () => {
			const cleanup = pollFlags(evaluator, "https://api.example.com/flags");

			// Just verify it starts without error
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(fetchCallCount).toBe(1);

			cleanup();
		});
	});
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("streaming integration", () => {
	beforeEach(() => {
		global.fetch = mock(() =>
			Promise.resolve({
				ok: true,
				status: 200,
				json: () => Promise.resolve(mockFlags),
			} as Response),
		);
	});

	afterEach(() => {
		global.fetch = originalFetch;
	});

	test("evaluator returns correct values after polling", async () => {
		const evaluator = new LocalEvaluator({ offlineSupport: false });
		evaluator.setContext({ userId: "user-123" });

		const cleanup = pollFlags(evaluator, "https://api.example.com/flags", {
			interval: 60000,
		});

		await new Promise((resolve) => setTimeout(resolve, 10));

		// Feature A is boolean flag with variants
		const featureA = evaluator.evaluate("feature-a", false);
		expect(typeof featureA.value).toBe("boolean");
		expect(featureA.enabled).toBe(true);

		// Feature B is always on
		const featureB = evaluator.isEnabled("feature-b");
		expect(featureB).toBe(true);

		cleanup();
	});
});
