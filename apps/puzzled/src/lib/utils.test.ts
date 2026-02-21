import { describe, expect, test } from "bun:test";
import {
	cn,
	formatNumber,
	generateId,
	getBaseUrl,
	getServerBaseUrl,
	sleep,
} from "./utils";

describe("cn", () => {
	test("merges class names", () => {
		expect(cn("foo", "bar")).toBe("foo bar");
	});

	test("handles conditional classes", () => {
		expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
	});

	test("merges tailwind classes correctly", () => {
		expect(cn("px-4", "px-8")).toBe("px-8");
		expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
	});
});

describe("formatNumber", () => {
	test("formats numbers with locale separators", () => {
		expect(formatNumber(1000, "en")).toBe("1,000");
		expect(formatNumber(1000000, "en")).toBe("1,000,000");
	});

	test("handles decimal numbers", () => {
		expect(formatNumber(1234.56, "en")).toBe("1,234.56");
	});
});

describe("sleep", () => {
	test("delays execution", async () => {
		const start = Date.now();
		await sleep(50);
		const elapsed = Date.now() - start;
		expect(elapsed).toBeGreaterThanOrEqual(45); // Allow some tolerance
	});
});

describe("generateId", () => {
	test("returns a valid UUID", () => {
		const id = generateId();
		// UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
		const uuidRegex =
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
		expect(id).toMatch(uuidRegex);
	});

	test("generates unique IDs", () => {
		const ids = Array.from({ length: 100 }, () => generateId());
		const uniqueIds = new Set(ids);
		expect(uniqueIds.size).toBe(100);
	});
});

describe("getBaseUrl", () => {
	test("returns localhost URL in server environment (default mode)", () => {
		// In Node/Bun test environment, window is undefined
		// Without VERCEL_URL or NEXT_PUBLIC_APP_URL, falls back to localhost
		const url = getBaseUrl();
		expect(url).toContain("localhost");
	});

	test("returns localhost URL in server environment (relative mode)", () => {
		const url = getBaseUrl("relative");
		expect(url).toContain("localhost");
	});

	test("returns localhost URL in server environment (origin mode)", () => {
		// In server environment, origin mode also returns absolute URL
		const url = getBaseUrl("origin");
		expect(url).toContain("localhost");
	});
});

describe("getServerBaseUrl", () => {
	test("returns absolute URL without browser check", () => {
		const url = getServerBaseUrl();
		expect(url).toContain("localhost");
		expect(url.startsWith("http")).toBe(true);
	});

	test("returns consistent URL across calls", () => {
		const url1 = getServerBaseUrl();
		const url2 = getServerBaseUrl();
		expect(url1).toBe(url2);
	});
});

describe("cn edge cases", () => {
	test("handles empty inputs", () => {
		expect(cn()).toBe("");
		expect(cn("")).toBe("");
	});

	test("handles null and undefined", () => {
		expect(cn(null, "foo", undefined)).toBe("foo");
	});

	test("handles arrays of classes", () => {
		expect(cn(["foo", "bar"])).toBe("foo bar");
	});

	test("handles objects with boolean values", () => {
		expect(cn({ foo: true, bar: false, baz: true })).toBe("foo baz");
	});
});

describe("formatNumber edge cases", () => {
	test("handles zero", () => {
		expect(formatNumber(0, "en")).toBe("0");
	});

	test("handles negative numbers", () => {
		expect(formatNumber(-1000, "en")).toBe("-1,000");
	});

	test("handles very large numbers", () => {
		const result = formatNumber(1000000000, "en");
		expect(result).toBe("1,000,000,000");
	});
});
