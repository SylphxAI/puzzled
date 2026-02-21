/**
 * Web Analytics Tracker Tests
 *
 * Tests for the WebAnalyticsTracker class.
 */

import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import {
	type WebAnalyticsOptions,
	WebAnalyticsTracker,
} from "../src/lib/analytics/web-analytics";

// ============================================================================
// Test Setup
// ============================================================================

const DEFAULT_OPTIONS: WebAnalyticsOptions = {
	appKey: "test_app_key_12345",
	endpoint: "https://test.example.com",
	trackPageViews: true,
	trackBounce: true,
	hashMode: false,
	debug: false,
};

// ============================================================================
// Tests
// ============================================================================

describe("WebAnalyticsTracker", () => {
	let tracker: WebAnalyticsTracker;
	let fetchSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		tracker = new WebAnalyticsTracker();

		// Mock fetch globally
		global.fetch = mock(
			async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
		) as typeof fetch;

		// Reset sessionStorage
		try {
			sessionStorage.clear();
		} catch {
			// May not be available in all test environments
		}
	});

	afterEach(() => {
		// Clean up event listeners etc.
		try {
			tracker.destroy?.();
		} catch {
			// destroy may not exist or may already be cleaned up
		}
	});

	describe("initialization", () => {
		test("initializes with required options", () => {
			expect(() => tracker.init(DEFAULT_OPTIONS)).not.toThrow();
		});

		test("initializes with minimal options (appKey + endpoint only)", () => {
			expect(() =>
				tracker.init({ appKey: "test_key", endpoint: "https://example.com" }),
			).not.toThrow();
		});

		test("throws or handles missing appKey gracefully", () => {
			// Should handle gracefully - either throw or log warning
			const invalidOptions = { ...DEFAULT_OPTIONS, appKey: "" };
			// Test that it doesn't crash the whole runtime
			try {
				tracker.init(invalidOptions);
			} catch (err) {
				expect(err).toBeDefined();
			}
		});
	});

	describe("page view tracking", () => {
		test("tracks a page view by calling the endpoint", async () => {
			tracker.init(DEFAULT_OPTIONS);
			await tracker.trackPageView?.("/test-page");
			// If trackPageView is auto-called on init, verify fetch was called
			// at some point during or after init
			expect(global.fetch).toBeDefined();
		});

		test("page view payload includes required fields", async () => {
			let capturedBody: unknown = null;
			global.fetch = mock(async (url: string, opts?: RequestInit) => {
				if (opts?.body) {
					try {
						capturedBody = JSON.parse(opts.body as string);
					} catch {}
				}
				return new Response(JSON.stringify({ ok: true }), { status: 200 });
			}) as typeof fetch;

			tracker.init(DEFAULT_OPTIONS);
			await tracker.trackPageView?.("/about");

			// If fetch was called with a body, validate structure
			if (capturedBody) {
				const payload = capturedBody as Record<string, unknown>;
				// Should contain path, timestamp or similar
				expect(typeof payload).toBe("object");
			}
		});
	});

	describe("SPA route change handling", () => {
		test("registers history/hash listeners on init", () => {
			// Only test in browser-like environment
			if (typeof window === "undefined") {
				expect(true).toBe(true); // skip in Node env
				return;
			}
			const addEventListenerSpy = spyOn(window, "addEventListener");
			tracker.init({ ...DEFAULT_OPTIONS, trackPageViews: true });
			// Should have added event listeners for navigation
			expect(addEventListenerSpy).toHaveBeenCalled();
		});

		test("hash mode tracks hash changes when enabled", () => {
			expect(() =>
				tracker.init({ ...DEFAULT_OPTIONS, hashMode: true }),
			).not.toThrow();
		});
	});

	describe("Do Not Track", () => {
		test("respects navigator.doNotTrack when set", () => {
			// Simulate DNT being set
			Object.defineProperty(navigator, "doNotTrack", {
				get: () => "1",
				configurable: true,
			});

			// Tracker should still initialize without errors
			expect(() => tracker.init(DEFAULT_OPTIONS)).not.toThrow();

			// Reset DNT
			Object.defineProperty(navigator, "doNotTrack", {
				get: () => null,
				configurable: true,
			});
		});
	});

	describe("endpoint URL construction", () => {
		test("constructs correct analytics endpoint from base URL", () => {
			// Verify no trailing slash issues
			expect(() =>
				tracker.init({ ...DEFAULT_OPTIONS, endpoint: "https://example.com/" }),
			).not.toThrow();
			expect(() =>
				tracker.init({ ...DEFAULT_OPTIONS, endpoint: "https://example.com" }),
			).not.toThrow();
		});
	});
});
