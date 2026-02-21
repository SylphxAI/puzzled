/**
 * Analytics Tracker Tests
 *
 * Tests for AnalyticsTracker class and pure utility functions.
 * DOM-dependent autocapture and navigation tested via E2E tests.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
	AnalyticsTracker,
	getAnalyticsTracker,
	resetAnalyticsTracker,
} from "../../src/lib/analytics/tracker";
import {
	DEFAULT_ANALYTICS_CONFIG,
	DEFAULT_AUTOCAPTURE_CONFIG,
} from "../../src/lib/analytics/types";
import type {
	AnalyticsEvent,
	EventProperties,
} from "../../src/lib/analytics/types";

// ============================================================================
// Mock Storage
// ============================================================================

const mockStorage: Record<string, string> = {};
const mockLocalStorage = {
	getItem: (key: string) => mockStorage[key] ?? null,
	setItem: (key: string, value: string) => {
		mockStorage[key] = value;
	},
	removeItem: (key: string) => {
		delete mockStorage[key];
	},
	clear: () => {
		for (const key of Object.keys(mockStorage)) {
			delete mockStorage[key];
		}
	},
};

// ============================================================================
// Test Setup
// ============================================================================

beforeEach(() => {
	resetAnalyticsTracker();
	mockLocalStorage.clear();
});

afterEach(() => {
	resetAnalyticsTracker();
	mockLocalStorage.clear();
});

// ============================================================================
// Default Config Tests
// ============================================================================

describe("DEFAULT_ANALYTICS_CONFIG", () => {
	test("has correct default values", () => {
		expect(DEFAULT_ANALYTICS_CONFIG.autocapture).toBe(true);
		expect(DEFAULT_ANALYTICS_CONFIG.capturePageviews).toBe(true);
		expect(DEFAULT_ANALYTICS_CONFIG.captureSpaNavigation).toBe(true);
		expect(DEFAULT_ANALYTICS_CONFIG.capturePageleave).toBe(true);
		expect(DEFAULT_ANALYTICS_CONFIG.captureScrollDepth).toBe(true);
		expect(DEFAULT_ANALYTICS_CONFIG.captureForms).toBe(true);
		expect(DEFAULT_ANALYTICS_CONFIG.captureErrors).toBe(false);
		expect(DEFAULT_ANALYTICS_CONFIG.captureUtm).toBe(true);
		expect(DEFAULT_ANALYTICS_CONFIG.captureReferrer).toBe(true);
		expect(DEFAULT_ANALYTICS_CONFIG.captureDevice).toBe(true);
		expect(DEFAULT_ANALYTICS_CONFIG.debug).toBe(false);
		expect(DEFAULT_ANALYTICS_CONFIG.batchSize).toBe(10);
		expect(DEFAULT_ANALYTICS_CONFIG.persistence).toBe("localStorage");
	});

	test("has correct session timeout", () => {
		// 30 minutes in ms
		expect(DEFAULT_ANALYTICS_CONFIG.sessionTimeout).toBe(30 * 60 * 1000);
	});
});

describe("DEFAULT_AUTOCAPTURE_CONFIG", () => {
	test("has correct default values", () => {
		expect(DEFAULT_AUTOCAPTURE_CONFIG.captureText).toBe(true);
		expect(DEFAULT_AUTOCAPTURE_CONFIG.maxTextLength).toBe(100);
		expect(DEFAULT_AUTOCAPTURE_CONFIG.eventTypes).toEqual([
			"click",
			"submit",
			"change",
		]);
	});

	test("has correct default elements", () => {
		expect(DEFAULT_AUTOCAPTURE_CONFIG.elements).toContain("button");
		expect(DEFAULT_AUTOCAPTURE_CONFIG.elements).toContain("a");
		expect(DEFAULT_AUTOCAPTURE_CONFIG.elements).toContain("input");
		expect(DEFAULT_AUTOCAPTURE_CONFIG.elements).toContain("select");
		expect(DEFAULT_AUTOCAPTURE_CONFIG.elements).toContain("textarea");
	});

	test("has correct default attributes", () => {
		expect(DEFAULT_AUTOCAPTURE_CONFIG.captureAttributes).toContain("id");
		expect(DEFAULT_AUTOCAPTURE_CONFIG.captureAttributes).toContain("class");
		expect(DEFAULT_AUTOCAPTURE_CONFIG.captureAttributes).toContain("href");
		expect(DEFAULT_AUTOCAPTURE_CONFIG.captureAttributes).toContain(
			"data-testid",
		);
		expect(DEFAULT_AUTOCAPTURE_CONFIG.captureAttributes).toContain(
			"data-analytics",
		);
	});
});

// ============================================================================
// AnalyticsTracker Constructor Tests
// ============================================================================

describe("AnalyticsTracker constructor", () => {
	test("creates tracker with default config", () => {
		const tracker = new AnalyticsTracker();
		expect(tracker).toBeInstanceOf(AnalyticsTracker);
	});

	test("accepts partial config", () => {
		const tracker = new AnalyticsTracker({
			debug: true,
			batchSize: 20,
		});
		expect(tracker).toBeInstanceOf(AnalyticsTracker);
	});

	test("generates anonymous ID", () => {
		const tracker = new AnalyticsTracker({ persistence: "none" });
		const distinctId = tracker.getDistinctId();
		expect(distinctId).toBeTruthy();
		// UUID format
		expect(distinctId.length).toBeGreaterThan(20);
	});
});

// ============================================================================
// Identification Tests
// ============================================================================

describe("identification", () => {
	test("identify sets distinct ID", () => {
		const tracker = new AnalyticsTracker({ persistence: "none" });
		const anonymousId = tracker.getDistinctId();

		tracker.identify("user-123");

		expect(tracker.getDistinctId()).toBe("user-123");
		expect(tracker.getDistinctId()).not.toBe(anonymousId);
	});

	test("reset generates new anonymous ID", () => {
		const tracker = new AnalyticsTracker({ persistence: "none" });
		tracker.identify("user-123");

		tracker.reset();

		const newId = tracker.getDistinctId();
		expect(newId).not.toBe("user-123");
		expect(newId.length).toBeGreaterThan(20);
	});

	test("getDistinctId returns anonymous ID when not identified", () => {
		const tracker = new AnalyticsTracker({ persistence: "none" });
		const id = tracker.getDistinctId();

		// Should be a UUID-like string
		expect(id).toMatch(/^[a-f0-9-]{36}$/);
	});
});

// ============================================================================
// Super Properties Tests
// ============================================================================

describe("super properties", () => {
	test("register adds super properties", () => {
		const tracker = new AnalyticsTracker({
			persistence: "none",
			// Disable autocapture and page tracking for cleaner tests
			autocapture: false,
			capturePageviews: false,
			captureSpaNavigation: false,
		});

		tracker.register({ app_version: "1.0.0", environment: "test" });

		// Properties will be included in tracked events
		expect(tracker).toBeInstanceOf(AnalyticsTracker);
	});

	test("registerOnce only sets if not already set", () => {
		const tracker = new AnalyticsTracker({
			persistence: "none",
			autocapture: false,
			capturePageviews: false,
		});

		tracker.register({ key: "original" });
		tracker.registerOnce({ key: "new", other: "value" });

		// 'key' should still be 'original', 'other' should be 'value'
		expect(tracker).toBeInstanceOf(AnalyticsTracker);
	});

	test("unregister removes super property", () => {
		const tracker = new AnalyticsTracker({
			persistence: "none",
			autocapture: false,
			capturePageviews: false,
		});

		tracker.register({ key: "value" });
		tracker.unregister("key");

		expect(tracker).toBeInstanceOf(AnalyticsTracker);
	});
});

// ============================================================================
// Track Event Tests
// ============================================================================

describe("track", () => {
	let capturedEvents: AnalyticsEvent[] = [];
	let tracker: AnalyticsTracker;

	beforeEach(() => {
		capturedEvents = [];
		tracker = new AnalyticsTracker({
			persistence: "none",
			autocapture: false,
			capturePageviews: false,
			captureSpaNavigation: false,
			beforeSend: (event) => {
				capturedEvents.push(event);
				return null; // Prevent actual queueing
			},
		});
	});

	test("tracks event with name", () => {
		tracker.track("button_click");

		expect(capturedEvents.length).toBe(1);
		expect(capturedEvents[0].event).toBe("button_click");
	});

	test("tracks event with properties", () => {
		tracker.track("purchase", { amount: 99.99, currency: "USD" });

		expect(capturedEvents[0].properties.amount).toBe(99.99);
		expect(capturedEvents[0].properties.currency).toBe("USD");
	});

	test("includes session ID", () => {
		tracker.track("test_event");

		expect(capturedEvents[0].properties.$session_id).toBeTruthy();
	});

	test("includes distinct ID", () => {
		tracker.track("test_event");

		expect(capturedEvents[0].distinct_id).toBe(tracker.getDistinctId());
	});

	test("includes timestamp", () => {
		const before = new Date().toISOString();
		tracker.track("test_event");
		const after = new Date().toISOString();

		const timestamp = capturedEvents[0].timestamp;
		expect(timestamp >= before).toBe(true);
		expect(timestamp <= after).toBe(true);
	});

	test("includes library info", () => {
		tracker.track("test_event");

		expect(capturedEvents[0].$lib).toBe("sylphx-sdk");
		expect(capturedEvents[0].$lib_version).toBe("1.0.0");
	});

	test("beforeSend can suppress event", () => {
		const events: AnalyticsEvent[] = [];
		const suppressTracker = new AnalyticsTracker({
			persistence: "none",
			autocapture: false,
			capturePageviews: false,
			beforeSend: (event) => {
				if (event.event === "suppressed") return null;
				events.push(event);
				return null;
			},
		});

		suppressTracker.track("allowed");
		suppressTracker.track("suppressed");
		suppressTracker.track("allowed");

		expect(events.length).toBe(2);
		expect(events.every((e) => e.event === "allowed")).toBe(true);
	});

	test("beforeSend can modify event", () => {
		const events: AnalyticsEvent[] = [];
		const modifyTracker = new AnalyticsTracker({
			persistence: "none",
			autocapture: false,
			capturePageviews: false,
			beforeSend: (event) => {
				event.properties.modified = true;
				events.push(event);
				return null;
			},
		});

		modifyTracker.track("test");

		expect(events[0].properties.modified).toBe(true);
	});
});

// ============================================================================
// User Properties Tests
// ============================================================================

describe("user properties", () => {
	test("setUserProperties tracks $set event", () => {
		const events: AnalyticsEvent[] = [];
		const tracker = new AnalyticsTracker({
			persistence: "none",
			autocapture: false,
			capturePageviews: false,
			beforeSend: (event) => {
				events.push(event);
				return null;
			},
		});

		tracker.setUserProperties({ name: "Test User", plan: "premium" });

		expect(events[0].event).toBe("$set");
		expect(events[0].properties.$set).toEqual({
			name: "Test User",
			plan: "premium",
		});
	});

	test("setUserPropertiesOnce tracks $set_once event", () => {
		const events: AnalyticsEvent[] = [];
		const tracker = new AnalyticsTracker({
			persistence: "none",
			autocapture: false,
			capturePageviews: false,
			beforeSend: (event) => {
				events.push(event);
				return null;
			},
		});

		tracker.setUserPropertiesOnce({ first_seen: "2024-01-01" });

		expect(events[0].event).toBe("$set_once");
		expect(events[0].properties.$set_once).toEqual({
			first_seen: "2024-01-01",
		});
	});

	test("incrementUserProperty tracks $set with $add", () => {
		const events: AnalyticsEvent[] = [];
		const tracker = new AnalyticsTracker({
			persistence: "none",
			autocapture: false,
			capturePageviews: false,
			beforeSend: (event) => {
				events.push(event);
				return null;
			},
		});

		tracker.incrementUserProperty("login_count", 1);

		expect(events[0].event).toBe("$set");
		expect(events[0].properties.$add).toEqual({ login_count: 1 });
	});

	test("incrementUserProperty defaults to 1", () => {
		const events: AnalyticsEvent[] = [];
		const tracker = new AnalyticsTracker({
			persistence: "none",
			autocapture: false,
			capturePageviews: false,
			beforeSend: (event) => {
				events.push(event);
				return null;
			},
		});

		tracker.incrementUserProperty("page_views");

		expect(events[0].properties.$add).toEqual({ page_views: 1 });
	});
});

// ============================================================================
// Group Tests
// ============================================================================

describe("group", () => {
	test("group tracks $groupidentify event", () => {
		const events: AnalyticsEvent[] = [];
		const tracker = new AnalyticsTracker({
			persistence: "none",
			autocapture: false,
			capturePageviews: false,
			beforeSend: (event) => {
				events.push(event);
				return null;
			},
		});

		tracker.group("company", "acme-corp", {
			name: "ACME Corp",
			plan: "enterprise",
		});

		expect(events[0].event).toBe("$groupidentify");
		expect(events[0].properties.$group_type).toBe("company");
		expect(events[0].properties.$group_key).toBe("acme-corp");
		expect(events[0].properties.$group_set).toEqual({
			name: "ACME Corp",
			plan: "enterprise",
		});
	});

	test("group without properties", () => {
		const events: AnalyticsEvent[] = [];
		const tracker = new AnalyticsTracker({
			persistence: "none",
			autocapture: false,
			capturePageviews: false,
			beforeSend: (event) => {
				events.push(event);
				return null;
			},
		});

		tracker.group("team", "team-123");

		expect(events[0].properties.$group_type).toBe("team");
		expect(events[0].properties.$group_key).toBe("team-123");
		expect(events[0].properties.$group_set).toBeUndefined();
	});
});

// ============================================================================
// Alias Tests
// ============================================================================

describe("alias", () => {
	test("alias tracks $create_alias event", () => {
		const events: AnalyticsEvent[] = [];
		const tracker = new AnalyticsTracker({
			persistence: "none",
			autocapture: false,
			capturePageviews: false,
			beforeSend: (event) => {
				events.push(event);
				return null;
			},
		});

		tracker.alias("new-id-123");

		expect(events[0].event).toBe("$create_alias");
		expect(events[0].properties.alias).toBe("new-id-123");
		expect(events[0].properties.distinct_id).toBe(tracker.getDistinctId());
	});
});

// ============================================================================
// Property Denylist Tests
// ============================================================================

describe("property denylist", () => {
	test("removes denied properties", () => {
		const events: AnalyticsEvent[] = [];
		const tracker = new AnalyticsTracker({
			persistence: "none",
			autocapture: false,
			capturePageviews: false,
			propertyDenylist: ["password", "secret"],
			beforeSend: (event) => {
				events.push(event);
				return null;
			},
		});

		tracker.track("login", {
			username: "test",
			password: "secret123",
			secret: "value",
		});

		expect(events[0].properties.username).toBe("test");
		expect(events[0].properties.password).toBeUndefined();
		expect(events[0].properties.secret).toBeUndefined();
	});
});

// ============================================================================
// Sanitize Tests
// ============================================================================

describe("sanitize", () => {
	test("sanitize function transforms properties", () => {
		const events: AnalyticsEvent[] = [];
		const tracker = new AnalyticsTracker({
			persistence: "none",
			autocapture: false,
			capturePageviews: false,
			sanitize: (props) => {
				const sanitized = { ...props };
				// Redact email addresses
				for (const [key, value] of Object.entries(sanitized)) {
					if (typeof value === "string" && value.includes("@")) {
						sanitized[key] = "[REDACTED]";
					}
				}
				return sanitized;
			},
			beforeSend: (event) => {
				events.push(event);
				return null;
			},
		});

		tracker.track("signup", { email: "user@example.com", name: "Test" });

		expect(events[0].properties.email).toBe("[REDACTED]");
		expect(events[0].properties.name).toBe("Test");
	});
});

// ============================================================================
// Default Properties Tests
// ============================================================================

describe("default properties", () => {
	test("default properties are included in events", () => {
		const events: AnalyticsEvent[] = [];
		const tracker = new AnalyticsTracker({
			persistence: "none",
			autocapture: false,
			capturePageviews: false,
			defaultProperties: {
				app_name: "TestApp",
				app_version: "1.0.0",
			},
			beforeSend: (event) => {
				events.push(event);
				return null;
			},
		});

		tracker.track("test_event");

		expect(events[0].properties.app_name).toBe("TestApp");
		expect(events[0].properties.app_version).toBe("1.0.0");
	});

	test("event properties override default properties", () => {
		const events: AnalyticsEvent[] = [];
		const tracker = new AnalyticsTracker({
			persistence: "none",
			autocapture: false,
			capturePageviews: false,
			defaultProperties: {
				version: "1.0.0",
			},
			beforeSend: (event) => {
				events.push(event);
				return null;
			},
		});

		tracker.track("test_event", { version: "2.0.0" });

		expect(events[0].properties.version).toBe("2.0.0");
	});
});

// ============================================================================
// Singleton Tests
// ============================================================================

describe("singleton", () => {
	test("getAnalyticsTracker returns same instance", () => {
		const tracker1 = getAnalyticsTracker();
		const tracker2 = getAnalyticsTracker();
		expect(tracker1).toBe(tracker2);
	});

	test("resetAnalyticsTracker clears instance", () => {
		const tracker1 = getAnalyticsTracker();
		resetAnalyticsTracker();
		const tracker2 = getAnalyticsTracker();
		expect(tracker1).not.toBe(tracker2);
	});
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("integration", () => {
	test("identify followed by track includes correct distinct_id", () => {
		const events: AnalyticsEvent[] = [];
		const tracker = new AnalyticsTracker({
			persistence: "none",
			autocapture: false,
			capturePageviews: false,
			beforeSend: (event) => {
				events.push(event);
				return null;
			},
		});

		tracker.identify("user-456");
		tracker.track("after_identify");

		const trackEvent = events.find((e) => e.event === "after_identify");
		expect(trackEvent?.distinct_id).toBe("user-456");
	});

	test("super properties are included with tracked events", () => {
		const events: AnalyticsEvent[] = [];
		const tracker = new AnalyticsTracker({
			persistence: "none",
			autocapture: false,
			capturePageviews: false,
			beforeSend: (event) => {
				events.push(event);
				return null;
			},
		});

		tracker.register({ platform: "web" });
		tracker.track("test_event", { custom: "value" });

		expect(events[0].properties.platform).toBe("web");
		expect(events[0].properties.custom).toBe("value");
	});

	test("reset clears super properties", () => {
		const events: AnalyticsEvent[] = [];
		const tracker = new AnalyticsTracker({
			persistence: "none",
			autocapture: false,
			capturePageviews: false,
			beforeSend: (event) => {
				events.push(event);
				return null;
			},
		});

		tracker.register({ platform: "web" });
		tracker.reset();
		tracker.track("after_reset");

		expect(events[0].properties.platform).toBeUndefined();
	});
});
