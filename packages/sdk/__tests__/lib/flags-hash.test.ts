/**
 * Feature Flags Hashing Tests
 *
 * Tests for consistent hashing and bucketing functions.
 */

import { describe, expect, test } from "bun:test";
import {
	getBucket,
	getUserBucket,
	isInPercentage,
	murmurHash3,
	selectVariant,
} from "../../src/lib/flags/hash";

// ============================================================================
// MurmurHash3 Tests
// ============================================================================

describe("murmurHash3", () => {
	describe("basic hashing", () => {
		test("returns a number", () => {
			const result = murmurHash3("test");
			expect(typeof result).toBe("number");
		});

		test("returns consistent results for same input", () => {
			const result1 = murmurHash3("hello");
			const result2 = murmurHash3("hello");
			expect(result1).toBe(result2);
		});

		test("returns different results for different inputs", () => {
			const result1 = murmurHash3("hello");
			const result2 = murmurHash3("world");
			expect(result1).not.toBe(result2);
		});

		test("returns unsigned 32-bit integer", () => {
			const result = murmurHash3("test");
			expect(result).toBeGreaterThanOrEqual(0);
			expect(result).toBeLessThanOrEqual(0xffffffff);
		});
	});

	describe("seed variations", () => {
		test("same input with different seeds produces different results", () => {
			const result1 = murmurHash3("test", 0);
			const result2 = murmurHash3("test", 1);
			expect(result1).not.toBe(result2);
		});

		test("default seed is 0", () => {
			const result1 = murmurHash3("test");
			const result2 = murmurHash3("test", 0);
			expect(result1).toBe(result2);
		});
	});

	describe("edge cases", () => {
		test("handles empty string", () => {
			const result = murmurHash3("");
			expect(typeof result).toBe("number");
		});

		test("handles single character", () => {
			const result = murmurHash3("a");
			expect(typeof result).toBe("number");
		});

		test("handles long strings", () => {
			const longString = "a".repeat(1000);
			const result = murmurHash3(longString);
			expect(typeof result).toBe("number");
		});

		test("handles strings of various lengths (alignment)", () => {
			// Test strings of length 1, 2, 3, 4, 5 to cover alignment edge cases
			const lengths = [1, 2, 3, 4, 5, 6, 7, 8];
			for (const len of lengths) {
				const result = murmurHash3("a".repeat(len));
				expect(typeof result).toBe("number");
			}
		});

		test("handles unicode characters", () => {
			const result = murmurHash3("日本語");
			expect(typeof result).toBe("number");
		});

		test("handles emoji", () => {
			const result = murmurHash3("🎉🚀");
			expect(typeof result).toBe("number");
		});
	});

	describe("distribution quality", () => {
		test("produces reasonable distribution", () => {
			// Hash 1000 random-ish strings and check distribution
			const buckets = new Array(10).fill(0);

			for (let i = 0; i < 1000; i++) {
				const hash = murmurHash3(`user-${i}`);
				const bucket = hash % 10;
				buckets[bucket]++;
			}

			// Each bucket should have between 50 and 150 items (roughly)
			for (const count of buckets) {
				expect(count).toBeGreaterThan(50);
				expect(count).toBeLessThan(150);
			}
		});
	});
});

// ============================================================================
// getBucket Tests
// ============================================================================

describe("getBucket", () => {
	describe("basic functionality", () => {
		test("returns a number between 0 and 99", () => {
			const bucket = getBucket("test-key");
			expect(bucket).toBeGreaterThanOrEqual(0);
			expect(bucket).toBeLessThan(100);
		});

		test("returns consistent results for same key", () => {
			const bucket1 = getBucket("user-123");
			const bucket2 = getBucket("user-123");
			expect(bucket1).toBe(bucket2);
		});

		test("different keys produce different buckets (usually)", () => {
			const buckets = new Set<number>();
			for (let i = 0; i < 100; i++) {
				buckets.add(getBucket(`key-${i}`));
			}
			// Should have reasonable distribution (not all same bucket)
			expect(buckets.size).toBeGreaterThan(50);
		});
	});

	describe("salt parameter", () => {
		test("same key with different salts produces different buckets", () => {
			const bucket1 = getBucket("user-123", "salt-a");
			const bucket2 = getBucket("user-123", "salt-b");
			expect(bucket1).not.toBe(bucket2);
		});

		test("default salt is empty string", () => {
			const bucket1 = getBucket("user-123");
			const bucket2 = getBucket("user-123", "");
			expect(bucket1).toBe(bucket2);
		});
	});

	describe("edge cases", () => {
		test("handles empty key", () => {
			const bucket = getBucket("");
			expect(bucket).toBeGreaterThanOrEqual(0);
			expect(bucket).toBeLessThan(100);
		});

		test("handles very long key", () => {
			const bucket = getBucket("a".repeat(10000));
			expect(bucket).toBeGreaterThanOrEqual(0);
			expect(bucket).toBeLessThan(100);
		});
	});
});

// ============================================================================
// isInPercentage Tests
// ============================================================================

describe("isInPercentage", () => {
	describe("boundary tests", () => {
		test("bucket 0 is in 1%", () => {
			expect(isInPercentage(0, 1)).toBe(true);
		});

		test("bucket 1 is not in 1%", () => {
			expect(isInPercentage(1, 1)).toBe(false);
		});

		test("bucket 49 is in 50%", () => {
			expect(isInPercentage(49, 50)).toBe(true);
		});

		test("bucket 50 is not in 50%", () => {
			expect(isInPercentage(50, 50)).toBe(false);
		});

		test("bucket 99 is in 100%", () => {
			expect(isInPercentage(99, 100)).toBe(true);
		});

		test("bucket 0 is not in 0%", () => {
			expect(isInPercentage(0, 0)).toBe(false);
		});
	});

	describe("percentage ranges", () => {
		test("all buckets in 100%", () => {
			for (let i = 0; i < 100; i++) {
				expect(isInPercentage(i, 100)).toBe(true);
			}
		});

		test("no buckets in 0%", () => {
			for (let i = 0; i < 100; i++) {
				expect(isInPercentage(i, 0)).toBe(false);
			}
		});

		test("exactly 50 buckets in 50%", () => {
			let count = 0;
			for (let i = 0; i < 100; i++) {
				if (isInPercentage(i, 50)) count++;
			}
			expect(count).toBe(50);
		});

		test("exactly 10 buckets in 10%", () => {
			let count = 0;
			for (let i = 0; i < 100; i++) {
				if (isInPercentage(i, 10)) count++;
			}
			expect(count).toBe(10);
		});
	});
});

// ============================================================================
// getUserBucket Tests
// ============================================================================

describe("getUserBucket", () => {
	describe("user identification", () => {
		test("uses userId when available", () => {
			const bucket1 = getUserBucket("flag-key", "user-123", undefined);
			const bucket2 = getUserBucket("flag-key", "user-123", "anon-456");

			// Both should use userId, so same bucket
			expect(bucket1).toBe(bucket2);
		});

		test("falls back to anonymousId when no userId", () => {
			const bucket = getUserBucket("flag-key", undefined, "anon-123");
			expect(bucket).toBeGreaterThanOrEqual(0);
			expect(bucket).toBeLessThan(100);
		});

		test('uses "anonymous" when neither provided', () => {
			const bucket1 = getUserBucket("flag-key", undefined, undefined);
			const bucket2 = getUserBucket("flag-key", undefined, undefined);

			expect(bucket1).toBe(bucket2);
		});
	});

	describe("flag key differentiation", () => {
		test("different flags get different buckets for same user", () => {
			const bucket1 = getUserBucket("flag-a", "user-123", undefined);
			const bucket2 = getUserBucket("flag-b", "user-123", undefined);

			// Usually different due to flag key being part of hash input
			// This test might occasionally fail if they hash to same bucket
			// Running with multiple flag pairs to reduce false positives
			let foundDifferent = false;
			for (let i = 0; i < 10; i++) {
				const b1 = getUserBucket(`flag-${i}`, "user-123", undefined);
				const b2 = getUserBucket(`flag-${i + 100}`, "user-123", undefined);
				if (b1 !== b2) {
					foundDifferent = true;
					break;
				}
			}
			expect(foundDifferent).toBe(true);
		});
	});

	describe("salt parameter", () => {
		test("different salts produce different buckets", () => {
			const bucket1 = getUserBucket("flag", "user", undefined, "salt-1");
			const bucket2 = getUserBucket("flag", "user", undefined, "salt-2");

			expect(bucket1).not.toBe(bucket2);
		});
	});
});

// ============================================================================
// selectVariant Tests
// ============================================================================

describe("selectVariant", () => {
	describe("single variant", () => {
		test("returns the only variant", () => {
			const variants = [{ key: "control", weight: 100 }];
			const result = selectVariant(variants, 50);
			expect(result).toBe("control");
		});
	});

	describe("two variants", () => {
		test("selects first variant when bucket < weight", () => {
			const variants = [
				{ key: "control", weight: 50 },
				{ key: "treatment", weight: 50 },
			];

			expect(selectVariant(variants, 0)).toBe("control");
			expect(selectVariant(variants, 25)).toBe("control");
			expect(selectVariant(variants, 49)).toBe("control");
		});

		test("selects second variant when bucket >= first weight", () => {
			const variants = [
				{ key: "control", weight: 50 },
				{ key: "treatment", weight: 50 },
			];

			expect(selectVariant(variants, 50)).toBe("treatment");
			expect(selectVariant(variants, 75)).toBe("treatment");
			expect(selectVariant(variants, 99)).toBe("treatment");
		});

		test("handles 10/90 split", () => {
			const variants = [
				{ key: "feature", weight: 10 },
				{ key: "control", weight: 90 },
			];

			expect(selectVariant(variants, 5)).toBe("feature");
			expect(selectVariant(variants, 10)).toBe("control");
			expect(selectVariant(variants, 50)).toBe("control");
		});
	});

	describe("multiple variants", () => {
		test("selects correct variant from three options", () => {
			const variants = [
				{ key: "a", weight: 33 },
				{ key: "b", weight: 33 },
				{ key: "c", weight: 34 },
			];

			expect(selectVariant(variants, 0)).toBe("a");
			expect(selectVariant(variants, 32)).toBe("a");
			expect(selectVariant(variants, 33)).toBe("b");
			expect(selectVariant(variants, 65)).toBe("b");
			expect(selectVariant(variants, 66)).toBe("c");
			expect(selectVariant(variants, 99)).toBe("c");
		});
	});

	describe("weight normalization", () => {
		test("handles weights that dont sum to 100", () => {
			const variants = [
				{ key: "a", weight: 1 },
				{ key: "b", weight: 1 },
			];

			// Total weight is 2, so bucket is normalized
			const aCount = [0, 25, 49].filter(
				(b) => selectVariant(variants, b) === "a",
			).length;
			const bCount = [50, 75, 99].filter(
				(b) => selectVariant(variants, b) === "b",
			).length;

			// Should have reasonable split
			expect(aCount + bCount).toBeGreaterThan(0);
		});
	});

	describe("edge cases", () => {
		test("throws error for empty variants", () => {
			expect(() => selectVariant([], 50)).toThrow("No variants provided");
		});

		test("handles bucket 0", () => {
			const variants = [
				{ key: "a", weight: 50 },
				{ key: "b", weight: 50 },
			];
			expect(selectVariant(variants, 0)).toBe("a");
		});

		test("handles bucket 99", () => {
			const variants = [
				{ key: "a", weight: 50 },
				{ key: "b", weight: 50 },
			];
			expect(selectVariant(variants, 99)).toBe("b");
		});

		test("handles zero weight variants", () => {
			const variants = [
				{ key: "a", weight: 0 },
				{ key: "b", weight: 100 },
			];
			expect(selectVariant(variants, 50)).toBe("b");
		});
	});
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("hashing integration", () => {
	test("consistent bucketing across sessions", () => {
		// Simulating multiple "sessions" with same user
		const userId = "persistent-user-123";
		const flagKey = "ab-test-flag";

		const bucket1 = getUserBucket(flagKey, userId, undefined, "test-salt");
		const bucket2 = getUserBucket(flagKey, userId, undefined, "test-salt");
		const bucket3 = getUserBucket(flagKey, userId, undefined, "test-salt");

		expect(bucket1).toBe(bucket2);
		expect(bucket2).toBe(bucket3);
	});

	test("experiment assignment consistency", () => {
		const variants = [
			{ key: "control", weight: 50 },
			{ key: "treatment", weight: 50 },
		];

		// Same user should always get same variant
		const userId = "test-user";
		const bucket = getUserBucket("experiment", userId, undefined);
		const variant1 = selectVariant(variants, bucket);
		const variant2 = selectVariant(variants, bucket);

		expect(variant1).toBe(variant2);
	});

	test("rollout percentage accuracy", () => {
		// Test 10% rollout
		const percentage = 10;
		let included = 0;

		for (let i = 0; i < 1000; i++) {
			const bucket = getUserBucket("rollout-flag", `user-${i}`, undefined);
			if (isInPercentage(bucket, percentage)) {
				included++;
			}
		}

		// Should be roughly 10% (between 7% and 13%)
		expect(included).toBeGreaterThan(70);
		expect(included).toBeLessThan(130);
	});
});
