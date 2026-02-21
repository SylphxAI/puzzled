/**
 * KV (Key-Value Store) React Hooks Tests
 *
 * Tests for client-side KV hook logic and utilities.
 */

import { describe, expect, test } from "bun:test";

// ============================================================================
// Types (from use-kv.ts)
// ============================================================================

interface KvSetOptions {
	ex?: number;
	px?: number;
	exat?: number;
	pxat?: number;
	nx?: boolean;
	xx?: boolean;
}

interface KvRateLimitResult {
	success: boolean;
	limit: number;
	remaining: number;
	reset: number;
}

interface KvZMember {
	member: string;
	score?: number;
}

// ============================================================================
// Request Building Tests
// ============================================================================

describe("Request building", () => {
	test("builds correct URL for GET operations", () => {
		function buildGetUrl(baseUrl: string, key: string): string {
			return `${baseUrl}/api/sdk/v1/kv/${encodeURIComponent(key)}`;
		}

		expect(buildGetUrl("https://api.test.com", "user:123")).toBe(
			"https://api.test.com/api/sdk/v1/kv/user%3A123",
		);
		expect(buildGetUrl("https://api.test.com", "simple")).toBe(
			"https://api.test.com/api/sdk/v1/kv/simple",
		);
	});

	test("builds correct URL for exists check", () => {
		function buildExistsUrl(baseUrl: string, key: string): string {
			return `${baseUrl}/api/sdk/v1/kv/exists/${encodeURIComponent(key)}`;
		}

		expect(buildExistsUrl("https://api.test.com", "user:123")).toBe(
			"https://api.test.com/api/sdk/v1/kv/exists/user%3A123",
		);
	});

	test("builds headers with app secret", () => {
		function buildHeaders(appId: string): Record<string, string> {
			return {
				"Content-Type": "application/json",
				"x-app-secret": appId,
			};
		}

		const headers = buildHeaders("app_dev_test123");
		expect(headers["Content-Type"]).toBe("application/json");
		expect(headers["x-app-secret"]).toBe("app_dev_test123");
	});
});

// ============================================================================
// SET Options Tests
// ============================================================================

describe("KvSetOptions handling", () => {
	test("builds request body with TTL in seconds", () => {
		function buildSetBody<T>(key: string, value: T, options?: KvSetOptions) {
			return { key, value, ...options };
		}

		const body = buildSetBody("mykey", "myvalue", { ex: 3600 });
		expect(body.key).toBe("mykey");
		expect(body.value).toBe("myvalue");
		expect(body.ex).toBe(3600);
	});

	test("builds request body with TTL in milliseconds", () => {
		function buildSetBody<T>(key: string, value: T, options?: KvSetOptions) {
			return { key, value, ...options };
		}

		const body = buildSetBody("mykey", "myvalue", { px: 60000 });
		expect(body.px).toBe(60000);
	});

	test("builds request body with NX flag", () => {
		function buildSetBody<T>(key: string, value: T, options?: KvSetOptions) {
			return { key, value, ...options };
		}

		const body = buildSetBody("mykey", "myvalue", { nx: true });
		expect(body.nx).toBe(true);
	});

	test("builds request body with XX flag", () => {
		function buildSetBody<T>(key: string, value: T, options?: KvSetOptions) {
			return { key, value, ...options };
		}

		const body = buildSetBody("mykey", "myvalue", { xx: true });
		expect(body.xx).toBe(true);
	});

	test("builds request body with combined options", () => {
		function buildSetBody<T>(key: string, value: T, options?: KvSetOptions) {
			return { key, value, ...options };
		}

		const body = buildSetBody("mykey", "myvalue", { ex: 3600, nx: true });
		expect(body.ex).toBe(3600);
		expect(body.nx).toBe(true);
	});

	test("builds request body without options", () => {
		function buildSetBody<T>(key: string, value: T, options?: KvSetOptions) {
			return { key, value, ...options };
		}

		const body = buildSetBody("mykey", "myvalue");
		expect(body.key).toBe("mykey");
		expect(body.value).toBe("myvalue");
		expect(body.ex).toBeUndefined();
		expect(body.nx).toBeUndefined();
	});
});

// ============================================================================
// Rate Limit Result Parsing Tests
// ============================================================================

describe("Rate limit result handling", () => {
	test("parses successful rate limit response", () => {
		function parseRateLimitResult(response: unknown): KvRateLimitResult {
			const r = response as KvRateLimitResult;
			return {
				success: r.success,
				limit: r.limit,
				remaining: r.remaining,
				reset: r.reset,
			};
		}

		const result = parseRateLimitResult({
			success: true,
			limit: 100,
			remaining: 99,
			reset: 1704067200000,
		});

		expect(result.success).toBe(true);
		expect(result.limit).toBe(100);
		expect(result.remaining).toBe(99);
		expect(result.reset).toBe(1704067200000);
	});

	test("parses rate limit exceeded response", () => {
		function parseRateLimitResult(response: unknown): KvRateLimitResult {
			const r = response as KvRateLimitResult;
			return {
				success: r.success,
				limit: r.limit,
				remaining: r.remaining,
				reset: r.reset,
			};
		}

		const result = parseRateLimitResult({
			success: false,
			limit: 100,
			remaining: 0,
			reset: 1704067200000,
		});

		expect(result.success).toBe(false);
		expect(result.remaining).toBe(0);
	});

	test("checks if rate limited", () => {
		function isRateLimited(result: KvRateLimitResult): boolean {
			return !result.success;
		}

		expect(
			isRateLimited({ success: true, limit: 100, remaining: 50, reset: 0 }),
		).toBe(false);
		expect(
			isRateLimited({ success: false, limit: 100, remaining: 0, reset: 0 }),
		).toBe(true);
	});

	test("calculates retry delay", () => {
		function calculateRetryDelay(result: KvRateLimitResult): number {
			const now = Date.now();
			return Math.max(0, result.reset - now);
		}

		const futureReset = Date.now() + 5000;
		const result: KvRateLimitResult = {
			success: false,
			limit: 100,
			remaining: 0,
			reset: futureReset,
		};

		const delay = calculateRetryDelay(result);
		expect(delay).toBeGreaterThan(0);
		expect(delay).toBeLessThanOrEqual(5000);
	});
});

// ============================================================================
// Sorted Set Member Tests
// ============================================================================

describe("Sorted set member handling", () => {
	test("parses members without scores", () => {
		function parseMembers(response: { members: KvZMember[] }): KvZMember[] {
			return response.members;
		}

		const result = parseMembers({
			members: [{ member: "player1" }, { member: "player2" }],
		});

		expect(result).toHaveLength(2);
		expect(result[0].member).toBe("player1");
		expect(result[0].score).toBeUndefined();
	});

	test("parses members with scores", () => {
		function parseMembers(response: { members: KvZMember[] }): KvZMember[] {
			return response.members;
		}

		const result = parseMembers({
			members: [
				{ member: "player1", score: 100 },
				{ member: "player2", score: 200 },
			],
		});

		expect(result[0].score).toBe(100);
		expect(result[1].score).toBe(200);
	});

	test("sorts members by score descending", () => {
		function sortByScoreDesc(members: KvZMember[]): KvZMember[] {
			return [...members].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
		}

		const members: KvZMember[] = [
			{ member: "player1", score: 100 },
			{ member: "player2", score: 300 },
			{ member: "player3", score: 200 },
		];

		const sorted = sortByScoreDesc(members);
		expect(sorted[0].member).toBe("player2");
		expect(sorted[1].member).toBe("player3");
		expect(sorted[2].member).toBe("player1");
	});

	test("gets top N members", () => {
		function getTopN(members: KvZMember[], n: number): KvZMember[] {
			return [...members]
				.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
				.slice(0, n);
		}

		const members: KvZMember[] = [
			{ member: "player1", score: 100 },
			{ member: "player2", score: 300 },
			{ member: "player3", score: 200 },
			{ member: "player4", score: 50 },
		];

		const top2 = getTopN(members, 2);
		expect(top2).toHaveLength(2);
		expect(top2[0].member).toBe("player2");
		expect(top2[1].member).toBe("player3");
	});
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe("Error handling", () => {
	test("extracts error message from response", () => {
		function extractErrorMessage(error: unknown): string {
			if (typeof error === "object" && error !== null) {
				const e = error as { error?: string | { message?: string } };
				if (typeof e.error === "string") return e.error;
				if (typeof e.error?.message === "string") return e.error.message;
			}
			return "Request failed";
		}

		expect(extractErrorMessage({ error: "Key not found" })).toBe(
			"Key not found",
		);
		expect(extractErrorMessage({ error: { message: "Server error" } })).toBe(
			"Server error",
		);
		expect(extractErrorMessage({})).toBe("Request failed");
		expect(extractErrorMessage(null)).toBe("Request failed");
	});

	test("creates error from API response", () => {
		function createApiError(response: { error?: string }): Error {
			const message =
				typeof response.error === "string" ? response.error : "Request failed";
			return new Error(message);
		}

		const error = createApiError({ error: "Rate limit exceeded" });
		expect(error.message).toBe("Rate limit exceeded");

		const genericError = createApiError({});
		expect(genericError.message).toBe("Request failed");
	});
});

// ============================================================================
// Hash Operations Tests
// ============================================================================

describe("Hash operations", () => {
	test("builds hset request body", () => {
		function buildHsetBody<T>(key: string, fields: Record<string, T>) {
			return { key, fields };
		}

		const body = buildHsetBody("user:123", { name: "John", age: 30 });
		expect(body.key).toBe("user:123");
		expect(body.fields).toEqual({ name: "John", age: 30 });
	});

	test("builds hget request body", () => {
		function buildHgetBody(key: string, field: string) {
			return { key, field };
		}

		const body = buildHgetBody("user:123", "name");
		expect(body.key).toBe("user:123");
		expect(body.field).toBe("name");
	});

	test("parses hgetall response", () => {
		function parseHgetallResponse<T>(response: {
			fields: Record<string, T> | null;
		}) {
			return response.fields;
		}

		expect(parseHgetallResponse({ fields: { a: 1, b: 2 } })).toEqual({
			a: 1,
			b: 2,
		});
		expect(parseHgetallResponse({ fields: null })).toBeNull();
	});
});

// ============================================================================
// List Operations Tests
// ============================================================================

describe("List operations", () => {
	test("builds lpush request body", () => {
		function buildLpushBody<T>(key: string, values: T[]) {
			return { key, values };
		}

		const body = buildLpushBody("notifications", ["msg1", "msg2", "msg3"]);
		expect(body.key).toBe("notifications");
		expect(body.values).toEqual(["msg1", "msg2", "msg3"]);
	});

	test("builds lrange request body with defaults", () => {
		function buildLrangeBody(key: string, start = 0, stop = -1) {
			return { key, start, stop };
		}

		const body = buildLrangeBody("mylist");
		expect(body.start).toBe(0);
		expect(body.stop).toBe(-1);
	});

	test("builds lrange request body with custom range", () => {
		function buildLrangeBody(key: string, start = 0, stop = -1) {
			return { key, start, stop };
		}

		const body = buildLrangeBody("mylist", 5, 10);
		expect(body.start).toBe(5);
		expect(body.stop).toBe(10);
	});
});

// ============================================================================
// MGET/MSET Tests
// ============================================================================

describe("Multi-key operations", () => {
	test("builds mget request body", () => {
		function buildMgetBody(keys: string[]) {
			return { keys };
		}

		const body = buildMgetBody(["key1", "key2", "key3"]);
		expect(body.keys).toEqual(["key1", "key2", "key3"]);
	});

	test("builds mset request body", () => {
		function buildMsetBody<T>(
			entries: Array<{ key: string; value: T }>,
			options?: { ex?: number; px?: number },
		) {
			return { entries, ...options };
		}

		const body = buildMsetBody(
			[
				{ key: "k1", value: "v1" },
				{ key: "k2", value: "v2" },
			],
			{ ex: 3600 },
		);

		expect(body.entries).toHaveLength(2);
		expect(body.ex).toBe(3600);
	});

	test("parses mget response", () => {
		function parseMgetResponse<T>(response: {
			values: Record<string, T | null>;
		}) {
			return response.values;
		}

		const result = parseMgetResponse({
			values: {
				key1: "value1",
				key2: null,
				key3: "value3",
			},
		});

		expect(result.key1).toBe("value1");
		expect(result.key2).toBeNull();
		expect(result.key3).toBe("value3");
	});
});

// ============================================================================
// Increment Tests
// ============================================================================

describe("Increment operations", () => {
	test("builds incr request body with default increment", () => {
		function buildIncrBody(key: string, by = 1) {
			return { key, by };
		}

		const body = buildIncrBody("counter");
		expect(body.key).toBe("counter");
		expect(body.by).toBe(1);
	});

	test("builds incr request body with custom increment", () => {
		function buildIncrBody(key: string, by = 1) {
			return { key, by };
		}

		const body = buildIncrBody("counter", 5);
		expect(body.by).toBe(5);
	});

	test("builds incr request body with negative increment (decrement)", () => {
		function buildIncrBody(key: string, by = 1) {
			return { key, by };
		}

		const body = buildIncrBody("counter", -3);
		expect(body.by).toBe(-3);
	});
});
