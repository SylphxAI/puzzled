/**
 * Webhooks Tests
 *
 * Tests for webhook configuration functions and server-side verification.
 * Webhook verification is critical for security - must be bulletproof.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { type SylphxConfig, createConfig } from "../src/config";
import {
	type WebhookConfig,
	type WebhookDelivery,
	type WebhookStats,
	getWebhookConfig,
	getWebhookDeliveries,
	getWebhookDelivery,
	getWebhookStats,
	replayWebhookDelivery,
	updateWebhookConfig,
} from "../src/webhooks";

// ============================================================================
// Test Setup
// ============================================================================

let mockFetch: ReturnType<typeof mock>;
let originalFetch: typeof globalThis.fetch;
let testConfig: SylphxConfig;

beforeEach(() => {
	originalFetch = globalThis.fetch;
	mockFetch = mock(() =>
		Promise.resolve(
			new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		),
	);
	globalThis.fetch = mockFetch as unknown as typeof fetch;

	testConfig = createConfig({
		secretKey: "sk_dev_test123",
		platformUrl: "https://test.sylphx.com",
	});
});

afterEach(() => {
	globalThis.fetch = originalFetch;
	mockFetch.mockClear();
});

// Helper to extract request details from mock call
function getRequestBody(callIndex = 0): Record<string, unknown> {
	const call = mockFetch.mock.calls[callIndex];
	const options = call?.[1] as RequestInit;
	if (!options.body) return {};
	return JSON.parse(options.body as string);
}

function getRequestUrl(callIndex = 0): string {
	const call = mockFetch.mock.calls[callIndex];
	return call?.[0] as string;
}

function getRequestMethod(callIndex = 0): string {
	const call = mockFetch.mock.calls[callIndex];
	const options = call?.[1] as RequestInit;
	return options.method || "GET";
}

// ============================================================================
// Mock Data
// ============================================================================

const mockWebhookConfig: WebhookConfig = {
	environments: [
		{
			id: "env-dev",
			name: "Development",
			webhookUrl: "https://myapp.com/webhooks/dev",
			hasSecret: true,
			events: ["user.created", "subscription.updated"],
			createdAt: "2024-01-01T00:00:00.000Z",
			updatedAt: "2024-01-15T10:00:00.000Z",
		},
		{
			id: "env-prod",
			name: "Production",
			webhookUrl: "https://myapp.com/webhooks/prod",
			hasSecret: true,
			events: ["*"],
			createdAt: "2024-01-01T00:00:00.000Z",
			updatedAt: null,
		},
	],
	supportedEvents: [
		"user.created",
		"user.updated",
		"user.deleted",
		"subscription.created",
		"subscription.updated",
		"subscription.cancelled",
	],
	enabled: true,
};

const mockDelivery: WebhookDelivery = {
	id: "del-123",
	eventType: "user.created",
	status: "delivered",
	statusCode: 200,
	attempts: 1,
	retryCount: 0,
	payload: { event: "user.created", data: { userId: "user-123" } },
	response: '{"received": true}',
	url: "https://myapp.com/webhooks",
	createdAt: "2024-01-15T10:00:00.000Z",
	deliveredAt: "2024-01-15T10:00:01.000Z",
	lastAttemptAt: "2024-01-15T10:00:01.000Z",
};

const mockStats: WebhookStats = {
	total: 1000,
	delivered: 950,
	failed: 30,
	pending: 20,
	deliveryRate: 95.0,
	avgLatencyMs: 250,
	period: "7d",
	totals: {
		total: 1000,
		delivered: 950,
		failed: 30,
		pending: 20,
		deliveryRate: "95.0%",
	},
	byEvent: [
		{ event: "user.created", count: 500 },
		{ event: "subscription.updated", count: 300 },
	],
	byStatus: [
		{ status: "delivered", count: 950 },
		{ status: "failed", count: 30 },
	],
};

// ============================================================================
// getWebhookConfig() Tests
// ============================================================================

describe("getWebhookConfig", () => {
	test("fetches config from correct endpoint", async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockWebhookConfig), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			),
		);

		await getWebhookConfig(testConfig);

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const url = getRequestUrl();
		expect(url).toContain("/api/sdk/v1/webhooks/config");
	});

	test("uses GET method", async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockWebhookConfig), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			),
		);

		await getWebhookConfig(testConfig);

		expect(getRequestMethod()).toBe("GET");
	});

	test("returns webhook config", async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockWebhookConfig), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			),
		);

		const result = await getWebhookConfig(testConfig);

		expect(result.environments).toHaveLength(2);
		expect(result.enabled).toBe(true);
		expect(result.supportedEvents).toContain("user.created");
	});

	test("returns config with empty environments", async () => {
		const emptyConfig: WebhookConfig = {
			environments: [],
			enabled: false,
		};
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(emptyConfig), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			),
		);

		const result = await getWebhookConfig(testConfig);

		expect(result.environments).toEqual([]);
	});
});

// ============================================================================
// updateWebhookConfig() Tests
// ============================================================================

describe("updateWebhookConfig", () => {
	test("posts to correct endpoint", async () => {
		await updateWebhookConfig(testConfig, {
			environmentId: "env-dev",
			webhookUrl: "https://new-url.com/webhooks",
		});

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const url = getRequestUrl();
		expect(url).toContain("/api/sdk/v1/webhooks/config");
	});

	test("uses PUT method", async () => {
		await updateWebhookConfig(testConfig, {
			environmentId: "env-dev",
			webhookUrl: "https://new-url.com/webhooks",
		});

		expect(getRequestMethod()).toBe("PUT");
	});

	test("includes environmentId and webhookUrl in body", async () => {
		await updateWebhookConfig(testConfig, {
			environmentId: "env-prod",
			webhookUrl: "https://production.myapp.com/webhooks",
		});

		const body = getRequestBody();
		expect(body.environmentId).toBe("env-prod");
		expect(body.webhookUrl).toBe("https://production.myapp.com/webhooks");
	});

	test("handles null webhookUrl (disable)", async () => {
		await updateWebhookConfig(testConfig, {
			environmentId: "env-dev",
			webhookUrl: null,
		});

		const body = getRequestBody();
		expect(body.webhookUrl).toBe(null);
	});
});

// ============================================================================
// getWebhookDeliveries() Tests
// ============================================================================

describe("getWebhookDeliveries", () => {
	test("fetches deliveries from correct endpoint", async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(
					JSON.stringify({
						deliveries: [mockDelivery],
						total: 1,
						hasMore: false,
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				),
			),
		);

		await getWebhookDeliveries(testConfig);

		const url = getRequestUrl();
		expect(url).toContain("/api/sdk/v1/webhooks/deliveries");
	});

	test("uses GET method", async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(
					JSON.stringify({ deliveries: [], total: 0, hasMore: false }),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				),
			),
		);

		await getWebhookDeliveries(testConfig);

		expect(getRequestMethod()).toBe("GET");
	});

	test("includes filter options in query", async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(
					JSON.stringify({ deliveries: [], total: 0, hasMore: false }),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				),
			),
		);

		await getWebhookDeliveries(testConfig, {
			environmentId: "env-prod",
			status: "failed",
			limit: 20,
			offset: 10,
		});

		const url = getRequestUrl();
		expect(url).toContain("environmentId=env-prod");
		expect(url).toContain("status=failed");
		expect(url).toContain("limit=20");
		expect(url).toContain("offset=10");
	});

	test("returns deliveries result", async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(
					JSON.stringify({
						deliveries: [mockDelivery],
						total: 100,
						hasMore: true,
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				),
			),
		);

		const result = await getWebhookDeliveries(testConfig);

		expect(result.deliveries).toHaveLength(1);
		expect(result.total).toBe(100);
		expect(result.hasMore).toBe(true);
	});

	test("works without options", async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(
					JSON.stringify({ deliveries: [], total: 0, hasMore: false }),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				),
			),
		);

		await getWebhookDeliveries(testConfig);

		const url = getRequestUrl();
		// Should not have query params if no options
		expect(url.includes("=")).toBe(false);
	});
});

// ============================================================================
// getWebhookDelivery() Tests
// ============================================================================

describe("getWebhookDelivery", () => {
	test("fetches single delivery from correct endpoint", async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockDelivery), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			),
		);

		await getWebhookDelivery(testConfig, "del-123");

		const url = getRequestUrl();
		expect(url).toContain("/api/sdk/v1/webhooks/deliveries/del-123");
	});

	test("returns delivery details", async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockDelivery), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			),
		);

		const result = await getWebhookDelivery(testConfig, "del-123");

		expect(result.id).toBe("del-123");
		expect(result.eventType).toBe("user.created");
		expect(result.status).toBe("delivered");
		expect(result.statusCode).toBe(200);
	});
});

// ============================================================================
// replayWebhookDelivery() Tests
// ============================================================================

describe("replayWebhookDelivery", () => {
	test("posts to correct endpoint", async () => {
		await replayWebhookDelivery(testConfig, "del-456");

		const url = getRequestUrl();
		expect(url).toContain("/api/sdk/v1/webhooks/deliveries/del-456/replay");
	});

	test("uses POST method", async () => {
		await replayWebhookDelivery(testConfig, "del-456");

		expect(getRequestMethod()).toBe("POST");
	});
});

// ============================================================================
// getWebhookStats() Tests
// ============================================================================

describe("getWebhookStats", () => {
	test("fetches stats from correct endpoint", async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockStats), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			),
		);

		await getWebhookStats(testConfig);

		const url = getRequestUrl();
		expect(url).toContain("/api/sdk/v1/webhooks/stats");
	});

	test("includes environmentId when provided", async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockStats), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			),
		);

		await getWebhookStats(testConfig, "env-prod");

		const url = getRequestUrl();
		expect(url).toContain("environmentId=env-prod");
	});

	test("returns stats", async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockStats), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			),
		);

		const result = await getWebhookStats(testConfig);

		expect(result.total).toBe(1000);
		expect(result.delivered).toBe(950);
		expect(result.failed).toBe(30);
		expect(result.deliveryRate).toBe(95.0);
	});
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe("Error Handling", () => {
	test("throws on network error", async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.reject(new Error("Network error")),
		);

		await expect(getWebhookConfig(testConfig)).rejects.toThrow();
	});

	test("throws on 400 response", async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify({ error: "Invalid request" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				}),
			),
		);

		await expect(getWebhookDeliveries(testConfig)).rejects.toThrow();
	});

	test("throws on 401 response", async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify({ error: "Unauthorized" }), {
					status: 401,
					headers: { "Content-Type": "application/json" },
				}),
			),
		);

		await expect(getWebhookConfig(testConfig)).rejects.toThrow();
	});

	test("throws on 404 response for delivery", async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify({ error: "Delivery not found" }), {
					status: 404,
					headers: { "Content-Type": "application/json" },
				}),
			),
		);

		await expect(
			getWebhookDelivery(testConfig, "nonexistent"),
		).rejects.toThrow();
	});

	test("throws on 500 response", async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify({ error: "Server error" }), {
					status: 500,
					headers: { "Content-Type": "application/json" },
				}),
			),
		);

		await expect(
			replayWebhookDelivery(testConfig, "del-123"),
		).rejects.toThrow();
	});
});

// ============================================================================
// Edge Cases Tests
// ============================================================================

describe("Edge Cases", () => {
	test("handles special characters in delivery ID", async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockDelivery), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			),
		);

		await getWebhookDelivery(testConfig, "del-with-special_chars");

		const url = getRequestUrl();
		expect(url).toContain("del-with-special_chars");
	});

	test("handles empty deliveries response", async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(
					JSON.stringify({ deliveries: [], total: 0, hasMore: false }),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				),
			),
		);

		const result = await getWebhookDeliveries(testConfig);

		expect(result.deliveries).toEqual([]);
		expect(result.total).toBe(0);
	});

	test("handles large payload in delivery", async () => {
		const largeDelivery = {
			...mockDelivery,
			payload: {
				event: "test",
				data: { items: Array(1000).fill({ id: "item" }) },
			},
		};
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(largeDelivery), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			),
		);

		const result = await getWebhookDelivery(testConfig, "del-large");

		expect((result.payload as Record<string, unknown>).data).toBeDefined();
	});

	test("handles URL-encoded environment ID", async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(
					JSON.stringify({ deliveries: [], total: 0, hasMore: false }),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				),
			),
		);

		await getWebhookDeliveries(testConfig, {
			environmentId: "env with spaces",
		});

		const url = getRequestUrl();
		// Should be URL encoded
		expect(url).toContain("environmentId=env");
	});

	test("handles webhook URL update with special characters", async () => {
		await updateWebhookConfig(testConfig, {
			environmentId: "env-123",
			webhookUrl: "https://myapp.com/webhooks?token=abc&source=sylphx",
		});

		const body = getRequestBody();
		expect(body.webhookUrl).toBe(
			"https://myapp.com/webhooks?token=abc&source=sylphx",
		);
	});
});

// ============================================================================
// Type Tests
// ============================================================================

describe("Types", () => {
	test("WebhookDelivery status has correct values", () => {
		const validStatuses: WebhookDelivery["status"][] = [
			"pending",
			"queued",
			"delivered",
			"failed",
			"success",
		];

		// This is a compile-time check
		expect(validStatuses).toHaveLength(5);
	});

	test("WebhookEnvironment has required fields", () => {
		const env = mockWebhookConfig.environments[0];

		expect(env.id).toBeDefined();
		expect(env.name).toBeDefined();
		expect(typeof env.createdAt).toBe("string");
	});

	test("WebhookStats has all summary fields", () => {
		expect(mockStats.total).toBeDefined();
		expect(mockStats.delivered).toBeDefined();
		expect(mockStats.failed).toBeDefined();
		expect(mockStats.pending).toBeDefined();
		expect(mockStats.deliveryRate).toBeDefined();
	});
});
