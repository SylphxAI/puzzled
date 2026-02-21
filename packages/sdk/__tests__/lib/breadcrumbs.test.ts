/**
 * Breadcrumb Collection Tests
 *
 * Tests for breadcrumb store functions.
 * Note: Browser-dependent capture functions are tested separately in E2E.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	addBreadcrumb,
	clearBreadcrumbs,
	getBreadcrumbs,
	setMaxBreadcrumbs,
} from "../../src/lib/monitoring/error-tracking/breadcrumbs";
import type { Breadcrumb } from "../../src/lib/monitoring/error-tracking/types";

// ============================================================================
// Test Setup
// ============================================================================

beforeEach(() => {
	clearBreadcrumbs();
});

afterEach(() => {
	clearBreadcrumbs();
	setMaxBreadcrumbs(100); // Reset to default
});

// ============================================================================
// addBreadcrumb Tests
// ============================================================================

describe("addBreadcrumb", () => {
	describe("basic functionality", () => {
		test("adds a breadcrumb", () => {
			addBreadcrumb({
				type: "ui",
				category: "ui.click",
				message: "Button clicked",
				level: "info",
			});

			const breadcrumbs = getBreadcrumbs();
			expect(breadcrumbs.length).toBe(1);
		});

		test("adds multiple breadcrumbs", () => {
			addBreadcrumb({
				type: "ui",
				category: "click",
				message: "First",
				level: "info",
			});
			addBreadcrumb({
				type: "ui",
				category: "click",
				message: "Second",
				level: "info",
			});
			addBreadcrumb({
				type: "ui",
				category: "click",
				message: "Third",
				level: "info",
			});

			const breadcrumbs = getBreadcrumbs();
			expect(breadcrumbs.length).toBe(3);
		});

		test("preserves breadcrumb data", () => {
			const breadcrumb: Breadcrumb = {
				type: "http",
				category: "fetch",
				message: "GET /api/users",
				data: {
					method: "GET",
					url: "/api/users",
					status_code: 200,
				},
				level: "info",
			};

			addBreadcrumb(breadcrumb);

			const stored = getBreadcrumbs()[0];
			expect(stored.type).toBe("http");
			expect(stored.category).toBe("fetch");
			expect(stored.message).toBe("GET /api/users");
			expect(stored.data).toEqual({
				method: "GET",
				url: "/api/users",
				status_code: 200,
			});
			expect(stored.level).toBe("info");
		});
	});

	describe("timestamp handling", () => {
		test("adds timestamp if not provided", () => {
			const before = Date.now();

			addBreadcrumb({
				type: "debug",
				category: "console",
				message: "Test",
				level: "info",
			});

			const after = Date.now();
			const breadcrumb = getBreadcrumbs()[0];

			expect(breadcrumb.timestamp).toBeDefined();
			expect(breadcrumb.timestamp).toBeGreaterThanOrEqual(before);
			expect(breadcrumb.timestamp).toBeLessThanOrEqual(after);
		});

		test("preserves provided timestamp", () => {
			const customTimestamp = 1234567890;

			addBreadcrumb({
				type: "debug",
				category: "console",
				message: "Test",
				level: "info",
				timestamp: customTimestamp,
			});

			const breadcrumb = getBreadcrumbs()[0];
			expect(breadcrumb.timestamp).toBe(customTimestamp);
		});
	});

	describe("breadcrumb types", () => {
		test("supports ui type", () => {
			addBreadcrumb({
				type: "ui",
				category: "ui.click",
				message: "Button clicked",
				level: "info",
			});

			expect(getBreadcrumbs()[0].type).toBe("ui");
		});

		test("supports http type", () => {
			addBreadcrumb({
				type: "http",
				category: "fetch",
				message: "GET /api",
				level: "info",
			});

			expect(getBreadcrumbs()[0].type).toBe("http");
		});

		test("supports navigation type", () => {
			addBreadcrumb({
				type: "navigation",
				category: "navigation",
				message: "Page change",
				level: "info",
			});

			expect(getBreadcrumbs()[0].type).toBe("navigation");
		});

		test("supports debug type", () => {
			addBreadcrumb({
				type: "debug",
				category: "console.log",
				message: "Debug message",
				level: "debug",
			});

			expect(getBreadcrumbs()[0].type).toBe("debug");
		});

		test("supports error type", () => {
			addBreadcrumb({
				type: "error",
				category: "exception",
				message: "Error occurred",
				level: "error",
			});

			expect(getBreadcrumbs()[0].type).toBe("error");
		});
	});

	describe("error levels", () => {
		test("supports info level", () => {
			addBreadcrumb({
				type: "debug",
				category: "test",
				message: "Info",
				level: "info",
			});

			expect(getBreadcrumbs()[0].level).toBe("info");
		});

		test("supports warning level", () => {
			addBreadcrumb({
				type: "debug",
				category: "test",
				message: "Warning",
				level: "warning",
			});

			expect(getBreadcrumbs()[0].level).toBe("warning");
		});

		test("supports error level", () => {
			addBreadcrumb({
				type: "debug",
				category: "test",
				message: "Error",
				level: "error",
			});

			expect(getBreadcrumbs()[0].level).toBe("error");
		});

		test("supports debug level", () => {
			addBreadcrumb({
				type: "debug",
				category: "test",
				message: "Debug",
				level: "debug",
			});

			expect(getBreadcrumbs()[0].level).toBe("debug");
		});
	});
});

// ============================================================================
// getBreadcrumbs Tests
// ============================================================================

describe("getBreadcrumbs", () => {
	test("returns empty array when no breadcrumbs", () => {
		expect(getBreadcrumbs()).toEqual([]);
	});

	test("returns copy of breadcrumbs array", () => {
		addBreadcrumb({
			type: "ui",
			category: "test",
			message: "Test",
			level: "info",
		});

		const breadcrumbs1 = getBreadcrumbs();
		const breadcrumbs2 = getBreadcrumbs();

		// Should be different array instances
		expect(breadcrumbs1).not.toBe(breadcrumbs2);
		// But same content
		expect(breadcrumbs1).toEqual(breadcrumbs2);
	});

	test("modifying returned array does not affect store", () => {
		addBreadcrumb({
			type: "ui",
			category: "test",
			message: "Original",
			level: "info",
		});

		const breadcrumbs = getBreadcrumbs();
		breadcrumbs.push({
			type: "ui",
			category: "fake",
			message: "Fake",
			level: "info",
			timestamp: 0,
		});

		expect(getBreadcrumbs().length).toBe(1);
	});

	test("returns breadcrumbs in order added", () => {
		addBreadcrumb({
			type: "ui",
			category: "test",
			message: "First",
			level: "info",
		});
		addBreadcrumb({
			type: "ui",
			category: "test",
			message: "Second",
			level: "info",
		});
		addBreadcrumb({
			type: "ui",
			category: "test",
			message: "Third",
			level: "info",
		});

		const breadcrumbs = getBreadcrumbs();
		expect(breadcrumbs[0].message).toBe("First");
		expect(breadcrumbs[1].message).toBe("Second");
		expect(breadcrumbs[2].message).toBe("Third");
	});
});

// ============================================================================
// clearBreadcrumbs Tests
// ============================================================================

describe("clearBreadcrumbs", () => {
	test("removes all breadcrumbs", () => {
		addBreadcrumb({
			type: "ui",
			category: "test",
			message: "One",
			level: "info",
		});
		addBreadcrumb({
			type: "ui",
			category: "test",
			message: "Two",
			level: "info",
		});
		addBreadcrumb({
			type: "ui",
			category: "test",
			message: "Three",
			level: "info",
		});

		clearBreadcrumbs();

		expect(getBreadcrumbs()).toEqual([]);
	});

	test("allows adding new breadcrumbs after clear", () => {
		addBreadcrumb({
			type: "ui",
			category: "test",
			message: "Before",
			level: "info",
		});
		clearBreadcrumbs();
		addBreadcrumb({
			type: "ui",
			category: "test",
			message: "After",
			level: "info",
		});

		const breadcrumbs = getBreadcrumbs();
		expect(breadcrumbs.length).toBe(1);
		expect(breadcrumbs[0].message).toBe("After");
	});
});

// ============================================================================
// setMaxBreadcrumbs Tests
// ============================================================================

describe("setMaxBreadcrumbs", () => {
	test("limits number of stored breadcrumbs", () => {
		setMaxBreadcrumbs(3);

		addBreadcrumb({
			type: "ui",
			category: "test",
			message: "1",
			level: "info",
		});
		addBreadcrumb({
			type: "ui",
			category: "test",
			message: "2",
			level: "info",
		});
		addBreadcrumb({
			type: "ui",
			category: "test",
			message: "3",
			level: "info",
		});
		addBreadcrumb({
			type: "ui",
			category: "test",
			message: "4",
			level: "info",
		});
		addBreadcrumb({
			type: "ui",
			category: "test",
			message: "5",
			level: "info",
		});

		const breadcrumbs = getBreadcrumbs();
		expect(breadcrumbs.length).toBe(3);
	});

	test("keeps most recent breadcrumbs", () => {
		setMaxBreadcrumbs(2);

		addBreadcrumb({
			type: "ui",
			category: "test",
			message: "Old",
			level: "info",
		});
		addBreadcrumb({
			type: "ui",
			category: "test",
			message: "Recent",
			level: "info",
		});
		addBreadcrumb({
			type: "ui",
			category: "test",
			message: "Newest",
			level: "info",
		});

		const breadcrumbs = getBreadcrumbs();
		expect(breadcrumbs.length).toBe(2);
		expect(breadcrumbs[0].message).toBe("Recent");
		expect(breadcrumbs[1].message).toBe("Newest");
	});

	test("trims existing breadcrumbs when lowered", () => {
		addBreadcrumb({
			type: "ui",
			category: "test",
			message: "1",
			level: "info",
		});
		addBreadcrumb({
			type: "ui",
			category: "test",
			message: "2",
			level: "info",
		});
		addBreadcrumb({
			type: "ui",
			category: "test",
			message: "3",
			level: "info",
		});
		addBreadcrumb({
			type: "ui",
			category: "test",
			message: "4",
			level: "info",
		});
		addBreadcrumb({
			type: "ui",
			category: "test",
			message: "5",
			level: "info",
		});

		setMaxBreadcrumbs(2);

		const breadcrumbs = getBreadcrumbs();
		expect(breadcrumbs.length).toBe(2);
	});

	test("allows max of 1", () => {
		setMaxBreadcrumbs(1);

		addBreadcrumb({
			type: "ui",
			category: "test",
			message: "First",
			level: "info",
		});
		addBreadcrumb({
			type: "ui",
			category: "test",
			message: "Second",
			level: "info",
		});

		const breadcrumbs = getBreadcrumbs();
		expect(breadcrumbs.length).toBe(1);
		expect(breadcrumbs[0].message).toBe("Second");
	});
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("breadcrumbs integration", () => {
	test("typical error debugging scenario", () => {
		// Simulate user activity leading to an error
		addBreadcrumb({
			type: "navigation",
			category: "navigation",
			message: "Navigated to /dashboard",
			data: { from: "/", to: "/dashboard" },
			level: "info",
		});

		addBreadcrumb({
			type: "ui",
			category: "ui.click",
			message: 'Clicked "Settings" button',
			data: { selector: "#settings-btn" },
			level: "info",
		});

		addBreadcrumb({
			type: "http",
			category: "fetch",
			message: "GET /api/settings",
			data: { method: "GET", url: "/api/settings", status_code: 200 },
			level: "info",
		});

		addBreadcrumb({
			type: "ui",
			category: "ui.input",
			message: "Input: email field",
			data: { selector: "#email", type: "email" },
			level: "info",
		});

		addBreadcrumb({
			type: "http",
			category: "fetch",
			message: "POST /api/settings (failed)",
			data: { method: "POST", url: "/api/settings", status_code: 500 },
			level: "error",
		});

		addBreadcrumb({
			type: "error",
			category: "exception",
			message: "Unhandled error: Failed to save settings",
			level: "error",
		});

		const breadcrumbs = getBreadcrumbs();
		expect(breadcrumbs.length).toBe(6);

		// Check chronological order
		expect(breadcrumbs[0].category).toBe("navigation");
		expect(breadcrumbs[5].category).toBe("exception");

		// Check data is preserved
		const httpBreadcrumb = breadcrumbs.find((b) => b.data?.status_code === 500);
		expect(httpBreadcrumb).toBeDefined();
		expect(httpBreadcrumb?.level).toBe("error");
	});

	test("console log simulation", () => {
		const levels = ["debug", "info", "warning", "error"] as const;

		levels.forEach((level, index) => {
			addBreadcrumb({
				type: "debug",
				category: `console.${level === "warning" ? "warn" : level}`,
				message: `Console ${level} message`,
				level,
			});
		});

		const breadcrumbs = getBreadcrumbs();
		expect(breadcrumbs.length).toBe(4);

		expect(breadcrumbs[0].category).toBe("console.debug");
		expect(breadcrumbs[1].category).toBe("console.info");
		expect(breadcrumbs[2].category).toBe("console.warn");
		expect(breadcrumbs[3].category).toBe("console.error");
	});

	test("high-volume breadcrumb scenario", () => {
		setMaxBreadcrumbs(50);

		// Simulate rapid user interactions
		for (let i = 0; i < 100; i++) {
			addBreadcrumb({
				type: "ui",
				category: "ui.click",
				message: `Click ${i}`,
				level: "info",
			});
		}

		const breadcrumbs = getBreadcrumbs();
		expect(breadcrumbs.length).toBe(50);

		// Should have the most recent clicks (50-99)
		expect(breadcrumbs[0].message).toBe("Click 50");
		expect(breadcrumbs[49].message).toBe("Click 99");
	});
});
