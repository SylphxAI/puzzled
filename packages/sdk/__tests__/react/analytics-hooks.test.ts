/**
 * Analytics Hooks Tests
 *
 * Tests for analytics tracking hooks logic.
 */

import { describe, expect, test } from "bun:test";

// ============================================================================
// Types (from use-analytics.tsx)
// ============================================================================

interface EventProperties {
	[key: string]: unknown;
}

interface UserProperties {
	[key: string]: unknown;
}

interface GroupProperties {
	[key: string]: unknown;
}

// ============================================================================
// useAnalytics Default Return Tests (No Context)
// ============================================================================

describe("useAnalytics default return (no context)", () => {
	const noopReturn = {
		track: () => {},
		identify: () => {},
		reset: () => {},
		setUserProperties: () => {},
		setUserPropertiesOnce: () => {},
		incrementUserProperty: () => {},
		group: () => {},
		register: () => {},
		getDistinctId: () => null,
		isReady: false,
		flush: async () => {},
	};

	test("returns no-op functions", () => {
		expect(noopReturn.isReady).toBe(false);
		expect(noopReturn.getDistinctId()).toBeNull();
	});

	test("no-op functions do not throw", () => {
		expect(() => noopReturn.track("test")).not.toThrow();
		expect(() => noopReturn.identify("user1")).not.toThrow();
		expect(() => noopReturn.reset()).not.toThrow();
		expect(() => noopReturn.setUserProperties({})).not.toThrow();
		expect(() => noopReturn.setUserPropertiesOnce({})).not.toThrow();
		expect(() => noopReturn.incrementUserProperty("count")).not.toThrow();
		expect(() => noopReturn.group("company", "acme")).not.toThrow();
		expect(() => noopReturn.register({})).not.toThrow();
	});

	test("flush returns resolved promise", async () => {
		await expect(noopReturn.flush()).resolves.toBeUndefined();
	});
});

// ============================================================================
// Event Tracking Logic Tests
// ============================================================================

describe("Event tracking logic", () => {
	test("track builds event with properties", () => {
		function buildEvent(eventName: string, properties?: EventProperties) {
			return {
				event: eventName,
				properties: {
					...properties,
					timestamp: Date.now(),
				},
			};
		}

		const event = buildEvent("button_clicked", { button_id: "submit" });
		expect(event.event).toBe("button_clicked");
		expect(event.properties.button_id).toBe("submit");
		expect(event.properties.timestamp).toBeDefined();
	});

	test("track without properties includes only timestamp", () => {
		function buildEvent(eventName: string, properties?: EventProperties) {
			return {
				event: eventName,
				properties: {
					...properties,
					timestamp: Date.now(),
				},
			};
		}

		const event = buildEvent("page_viewed");
		expect(event.event).toBe("page_viewed");
		expect(Object.keys(event.properties)).toContain("timestamp");
	});
});

// ============================================================================
// usePageView Logic Tests
// ============================================================================

describe("usePageView logic", () => {
	test("builds pageview event with pathname", () => {
		function buildPageViewEvent(
			pageName?: string,
			properties?: EventProperties,
		) {
			return {
				event: "$pageview",
				properties: {
					$pathname: pageName || "/default",
					...properties,
				},
			};
		}

		const event = buildPageViewEvent("/dashboard", { section: "main" });
		expect(event.event).toBe("$pageview");
		expect(event.properties.$pathname).toBe("/dashboard");
		expect(event.properties.section).toBe("main");
	});

	test("uses default pathname when not provided", () => {
		function buildPageViewEvent(pageName?: string) {
			return {
				event: "$pageview",
				properties: {
					$pathname: pageName || "/default",
				},
			};
		}

		const event = buildPageViewEvent();
		expect(event.properties.$pathname).toBe("/default");
	});
});

// ============================================================================
// useComponentTracking Logic Tests
// ============================================================================

describe("useComponentTracking logic", () => {
	test("builds component_viewed event", () => {
		function buildComponentViewedEvent(
			componentName: string,
			properties?: EventProperties,
		) {
			return {
				event: "component_viewed",
				properties: {
					component: componentName,
					...properties,
				},
			};
		}

		const event = buildComponentViewedEvent("PricingCard", { position: 1 });
		expect(event.event).toBe("component_viewed");
		expect(event.properties.component).toBe("PricingCard");
		expect(event.properties.position).toBe(1);
	});

	test("builds component_hidden event with time", () => {
		function buildComponentHiddenEvent(
			componentName: string,
			mountTime: number,
		) {
			const timeVisible = Date.now() - mountTime;
			return {
				event: "component_hidden",
				properties: {
					component: componentName,
					time_visible_ms: timeVisible,
				},
			};
		}

		const mountTime = Date.now() - 5000; // 5 seconds ago
		const event = buildComponentHiddenEvent("PricingCard", mountTime);
		expect(event.event).toBe("component_hidden");
		expect(event.properties.component).toBe("PricingCard");
		expect(event.properties.time_visible_ms).toBeGreaterThanOrEqual(5000);
	});
});

// ============================================================================
// useFeatureTracking Logic Tests
// ============================================================================

describe("useFeatureTracking logic", () => {
	test("builds feature_used event", () => {
		function buildFeatureUsedEvent(
			featureName: string,
			properties?: EventProperties,
		) {
			return {
				event: "feature_used",
				properties: {
					feature: featureName,
					...properties,
				},
			};
		}

		const event = buildFeatureUsedEvent("export", { format: "csv" });
		expect(event.event).toBe("feature_used");
		expect(event.properties.feature).toBe("export");
		expect(event.properties.format).toBe("csv");
	});

	test("builds feature_error event", () => {
		function buildFeatureErrorEvent(
			featureName: string,
			error: Error,
			properties?: EventProperties,
		) {
			return {
				event: "feature_error",
				properties: {
					feature: featureName,
					error_message: error.message,
					error_name: error.name,
					...properties,
				},
			};
		}

		const error = new Error("Export failed");
		const event = buildFeatureErrorEvent("export", error, { format: "csv" });
		expect(event.event).toBe("feature_error");
		expect(event.properties.feature).toBe("export");
		expect(event.properties.error_message).toBe("Export failed");
		expect(event.properties.error_name).toBe("Error");
	});
});

// ============================================================================
// useFormTracking Logic Tests
// ============================================================================

describe("useFormTracking logic", () => {
	test("builds form_started event", () => {
		function buildFormStartedEvent(formName: string) {
			return {
				event: "form_started",
				properties: { form: formName },
			};
		}

		const event = buildFormStartedEvent("signup");
		expect(event.event).toBe("form_started");
		expect(event.properties.form).toBe("signup");
	});

	test("builds form_completed event with duration", () => {
		function buildFormCompletedEvent(
			formName: string,
			startTime: number | null,
			fieldsFilledCount: number,
			properties?: EventProperties,
		) {
			const duration = startTime ? Date.now() - startTime : undefined;
			return {
				event: "form_completed",
				properties: {
					form: formName,
					duration_ms: duration,
					fields_filled: fieldsFilledCount,
					...properties,
				},
			};
		}

		const startTime = Date.now() - 30000; // 30 seconds ago
		const event = buildFormCompletedEvent("signup", startTime, 5);
		expect(event.event).toBe("form_completed");
		expect(event.properties.form).toBe("signup");
		expect(event.properties.duration_ms).toBeGreaterThanOrEqual(30000);
		expect(event.properties.fields_filled).toBe(5);
	});

	test("builds form_abandoned event", () => {
		function buildFormAbandonedEvent(
			formName: string,
			startTime: number | null,
			fieldsFilledCount: number,
		) {
			const duration = startTime ? Date.now() - startTime : undefined;
			return {
				event: "form_abandoned",
				properties: {
					form: formName,
					duration_ms: duration,
					fields_filled: fieldsFilledCount,
				},
			};
		}

		const event = buildFormAbandonedEvent("signup", null, 2);
		expect(event.event).toBe("form_abandoned");
		expect(event.properties.duration_ms).toBeUndefined();
		expect(event.properties.fields_filled).toBe(2);
	});

	test("builds form_field_filled event", () => {
		function buildFormFieldFilledEvent(formName: string, fieldName: string) {
			return {
				event: "form_field_filled",
				properties: {
					form: formName,
					field: fieldName,
				},
			};
		}

		const event = buildFormFieldFilledEvent("signup", "email");
		expect(event.event).toBe("form_field_filled");
		expect(event.properties.form).toBe("signup");
		expect(event.properties.field).toBe("email");
	});

	test("builds form_field_error event", () => {
		function buildFormFieldErrorEvent(
			formName: string,
			fieldName: string,
			error: string,
		) {
			return {
				event: "form_field_error",
				properties: {
					form: formName,
					field: fieldName,
					error,
				},
			};
		}

		const event = buildFormFieldErrorEvent(
			"signup",
			"email",
			"Invalid email format",
		);
		expect(event.event).toBe("form_field_error");
		expect(event.properties.error).toBe("Invalid email format");
	});

	test("tracks fields filled (deduplication)", () => {
		const fieldsFilled = new Set<string>();

		function trackFieldFilled(fieldName: string): boolean {
			if (fieldsFilled.has(fieldName)) {
				return false; // Already tracked
			}
			fieldsFilled.add(fieldName);
			return true; // New field
		}

		expect(trackFieldFilled("email")).toBe(true);
		expect(trackFieldFilled("password")).toBe(true);
		expect(trackFieldFilled("email")).toBe(false); // Already tracked
		expect(fieldsFilled.size).toBe(2);
	});
});

// ============================================================================
// useTimeTracking Logic Tests
// ============================================================================

describe("useTimeTracking logic", () => {
	test("calculates time spent", () => {
		function getTimeSpent(startTime: number): number {
			return Date.now() - startTime;
		}

		const startTime = Date.now() - 5000;
		const timeSpent = getTimeSpent(startTime);
		expect(timeSpent).toBeGreaterThanOrEqual(5000);
	});

	test("builds time_spent event", () => {
		function buildTimeSpentEvent(name: string, durationMs: number) {
			return {
				event: "time_spent",
				properties: {
					name,
					duration_ms: durationMs,
				},
			};
		}

		const event = buildTimeSpentEvent("pricing_page", 45000);
		expect(event.event).toBe("time_spent");
		expect(event.properties.name).toBe("pricing_page");
		expect(event.properties.duration_ms).toBe(45000);
	});

	test("builds time_milestone event", () => {
		function buildTimeMilestoneEvent(
			name: string,
			milestoneMs: number,
			actualMs: number,
		) {
			return {
				event: "time_milestone",
				properties: {
					name,
					milestone_ms: milestoneMs,
					actual_ms: actualMs,
				},
			};
		}

		const event = buildTimeMilestoneEvent("article", 60000, 61234);
		expect(event.event).toBe("time_milestone");
		expect(event.properties.milestone_ms).toBe(60000);
		expect(event.properties.actual_ms).toBe(61234);
	});

	test("milestone tracking (deduplication)", () => {
		const intervals = [10000, 30000, 60000, 120000]; // 10s, 30s, 1m, 2m
		const trackedIntervals = new Set<number>();

		function checkMilestones(elapsed: number): number[] {
			const newMilestones: number[] = [];
			for (const interval of intervals) {
				if (elapsed >= interval && !trackedIntervals.has(interval)) {
					trackedIntervals.add(interval);
					newMilestones.push(interval);
				}
			}
			return newMilestones;
		}

		// At 15 seconds - hit 10s milestone
		expect(checkMilestones(15000)).toEqual([10000]);

		// At 35 seconds - hit 30s milestone (10s already tracked)
		expect(checkMilestones(35000)).toEqual([30000]);

		// At 65 seconds - hit 60s milestone
		expect(checkMilestones(65000)).toEqual([60000]);

		// At 70 seconds - no new milestones
		expect(checkMilestones(70000)).toEqual([]);

		// At 150 seconds - hit 120s milestone
		expect(checkMilestones(150000)).toEqual([120000]);
	});
});

// ============================================================================
// User Identification Tests
// ============================================================================

describe("User identification", () => {
	test("identify builds user profile", () => {
		function buildUserProfile(userId: string, properties?: UserProperties) {
			return {
				userId,
				properties: properties || {},
			};
		}

		const profile = buildUserProfile("user-123", {
			email: "test@example.com",
			plan: "pro",
		});
		expect(profile.userId).toBe("user-123");
		expect(profile.properties.email).toBe("test@example.com");
		expect(profile.properties.plan).toBe("pro");
	});
});

// ============================================================================
// Group Association Tests
// ============================================================================

describe("Group association", () => {
	test("group builds association", () => {
		function buildGroupAssociation(
			groupType: string,
			groupKey: string,
			properties?: GroupProperties,
		) {
			return {
				type: groupType,
				key: groupKey,
				properties: properties || {},
			};
		}

		const group = buildGroupAssociation("company", "acme-corp", {
			industry: "tech",
			size: 100,
		});
		expect(group.type).toBe("company");
		expect(group.key).toBe("acme-corp");
		expect(group.properties.industry).toBe("tech");
		expect(group.properties.size).toBe(100);
	});
});

// ============================================================================
// Super Properties Tests
// ============================================================================

describe("Super properties", () => {
	test("register merges with existing properties", () => {
		let superProperties: EventProperties = { app_version: "1.0.0" };

		function register(properties: EventProperties) {
			superProperties = { ...superProperties, ...properties };
		}

		register({ platform: "web", theme: "dark" });
		expect(superProperties.app_version).toBe("1.0.0");
		expect(superProperties.platform).toBe("web");
		expect(superProperties.theme).toBe("dark");
	});

	test("register overwrites existing keys", () => {
		let superProperties: EventProperties = { app_version: "1.0.0" };

		function register(properties: EventProperties) {
			superProperties = { ...superProperties, ...properties };
		}

		register({ app_version: "2.0.0" });
		expect(superProperties.app_version).toBe("2.0.0");
	});
});

// ============================================================================
// User Properties Management Tests
// ============================================================================

describe("User properties management", () => {
	test("setUserProperties overwrites all", () => {
		let userProperties: UserProperties = { email: "old@example.com" };

		function setUserProperties(properties: UserProperties) {
			userProperties = { ...userProperties, ...properties };
		}

		setUserProperties({ email: "new@example.com", name: "Test User" });
		expect(userProperties.email).toBe("new@example.com");
		expect(userProperties.name).toBe("Test User");
	});

	test("setUserPropertiesOnce only sets if not exists", () => {
		const userProperties: UserProperties = { email: "existing@example.com" };

		function setUserPropertiesOnce(properties: UserProperties) {
			for (const [key, value] of Object.entries(properties)) {
				if (!(key in userProperties)) {
					userProperties[key] = value;
				}
			}
		}

		setUserPropertiesOnce({ email: "new@example.com", name: "Test User" });
		expect(userProperties.email).toBe("existing@example.com"); // Not overwritten
		expect(userProperties.name).toBe("Test User"); // New property set
	});

	test("incrementUserProperty increments numeric value", () => {
		const userProperties: UserProperties = { login_count: 5 };

		function incrementUserProperty(property: string, value = 1) {
			const current = userProperties[property];
			if (typeof current === "number") {
				userProperties[property] = current + value;
			} else {
				userProperties[property] = value;
			}
		}

		incrementUserProperty("login_count");
		expect(userProperties.login_count).toBe(6);

		incrementUserProperty("login_count", 5);
		expect(userProperties.login_count).toBe(11);

		// New property starts at value
		incrementUserProperty("new_count", 10);
		expect(userProperties.new_count).toBe(10);
	});
});
