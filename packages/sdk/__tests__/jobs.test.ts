/**
 * Jobs Module Tests
 *
 * Tests for background job scheduling functions (Stripe/Inngest pattern).
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { SylphxConfig } from "../src/config";
import {
	cancelJob,
	createCron,
	deleteCron,
	getJob,
	listJobs,
	pauseCron,
	resumeCron,
	scheduleJob,
} from "../src/jobs";

// ============================================================================
// Test Setup
// ============================================================================

const mockConfig: SylphxConfig = {
	secretKey: "sk_dev_test123",
	platformUrl: "https://api.sylphx.com",
};

let fetchCalls: Array<{ url: string; options: RequestInit }> = [];
const originalFetch = globalThis.fetch;

function createMockResponse<T>(data: T, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function getLastCall() {
	return fetchCalls[fetchCalls.length - 1];
}

function getRequestBody(): Record<string, unknown> | null {
	const last = getLastCall();
	if (!last?.options.body) return null;
	return JSON.parse(last.options.body as string);
}

function getRequestHeaders(): Record<string, string> {
	const last = getLastCall();
	if (!last?.options.headers) return {};
	const headers: Record<string, string> = {};
	const h = last.options.headers as Record<string, string>;
	for (const [key, value] of Object.entries(h)) {
		headers[key.toLowerCase()] = value;
	}
	return headers;
}

beforeEach(() => {
	fetchCalls = [];
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

// ============================================================================
// scheduleJob Tests
// ============================================================================

describe("scheduleJob", () => {
	test("schedules a one-time job", async () => {
		const mockResponse = {
			jobId: "job_abc123",
			messageId: "msg_xyz789",
			scheduledFor: "2025-01-15T10:00:00Z",
		};
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(mockResponse));
		}) as typeof fetch;

		const result = await scheduleJob(mockConfig, {
			callbackUrl: "https://myapp.com/api/jobs/send-email",
			name: "send-email",
			payload: { to: "user@example.com", template: "welcome" },
		});

		expect(result.jobId).toBe("job_abc123");
		expect(result.messageId).toBe("msg_xyz789");
		expect(getLastCall()?.url).toContain("/jobs/schedule");
		expect(getLastCall()?.options.method).toBe("POST");
	});

	test("includes all job options in request", async () => {
		const mockResponse = { jobId: "job_123" };
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(mockResponse));
		}) as typeof fetch;

		await scheduleJob(mockConfig, {
			callbackUrl: "https://myapp.com/api/webhooks/jobs",
			name: "send-notification",
			type: "notification",
			payload: { userId: "user-123", message: "Hello!" },
			method: "PUT",
			headers: { "X-Custom-Header": "custom-value" },
			delay: 300,
			retries: 5,
			timeout: 60,
		});

		const body = getRequestBody();
		expect(body).not.toBeNull();
		expect(body?.callbackUrl).toBe("https://myapp.com/api/webhooks/jobs");
		expect(body?.name).toBe("send-notification");
		expect(body?.type).toBe("notification");
		expect(body?.payload).toEqual({ userId: "user-123", message: "Hello!" });
		expect(body?.method).toBe("PUT");
		expect(body?.headers).toEqual({ "X-Custom-Header": "custom-value" });
		expect(body?.delay).toBe(300);
		expect(body?.retries).toBe(5);
		expect(body?.timeout).toBe(60);
	});

	test("schedules job with delay", async () => {
		const mockResponse = {
			jobId: "job_delayed",
			scheduledFor: "2025-01-15T10:05:00Z",
		};
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(mockResponse));
		}) as typeof fetch;

		const result = await scheduleJob(mockConfig, {
			callbackUrl: "https://myapp.com/api/jobs/process",
			delay: 300, // 5 minutes
		});

		expect(result.jobId).toBe("job_delayed");
		const body = getRequestBody();
		expect(body?.delay).toBe(300);
	});

	test("schedules job for specific time", async () => {
		const mockResponse = {
			jobId: "job_scheduled",
			scheduledFor: "2025-01-20T14:30:00Z",
		};
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(mockResponse));
		}) as typeof fetch;

		const result = await scheduleJob(mockConfig, {
			callbackUrl: "https://myapp.com/api/jobs/report",
			scheduledFor: "2025-01-20T14:30:00Z",
		});

		expect(result.scheduledFor).toBe("2025-01-20T14:30:00Z");
		const body = getRequestBody();
		expect(body?.scheduledFor).toBe("2025-01-20T14:30:00Z");
	});

	test("includes idempotency key for safe retries", async () => {
		const mockResponse = { jobId: "job_idempotent" };
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(mockResponse));
		}) as typeof fetch;

		await scheduleJob(mockConfig, {
			callbackUrl: "https://myapp.com/api/jobs/send-email",
			payload: { userId: "user-123", template: "welcome" },
			idempotencyKey: "welcome-email-user-123-1705312800000",
		});

		const body = getRequestBody();
		expect(body?.idempotencyKey).toBe("welcome-email-user-123-1705312800000");
	});

	test("sends correct authentication header", async () => {
		const mockResponse = { jobId: "job_123" };
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(mockResponse));
		}) as typeof fetch;

		await scheduleJob(mockConfig, {
			callbackUrl: "https://myapp.com/api/jobs/test",
		});

		const headers = getRequestHeaders();
		expect(headers["x-app-secret"]).toBe("sk_dev_test123");
	});

	test("handles API errors", async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(
				new Response(JSON.stringify({ error: "Invalid callback URL" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				}),
			);
		}) as typeof fetch;

		await expect(
			scheduleJob(mockConfig, {
				callbackUrl: "invalid-url",
			}),
		).rejects.toThrow();
	});
});

// ============================================================================
// getJob Tests
// ============================================================================

describe("getJob", () => {
	test("gets job status by ID", async () => {
		const mockResponse = {
			id: "job_abc123",
			name: "send-email",
			status: "completed",
			payload: { to: "user@example.com" },
			result: { sent: true },
			createdAt: "2025-01-15T09:00:00Z",
			queuedAt: "2025-01-15T09:00:01Z",
			startedAt: "2025-01-15T09:00:02Z",
			completedAt: "2025-01-15T09:00:05Z",
		};
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(mockResponse));
		}) as typeof fetch;

		const result = await getJob(mockConfig, "job_abc123");

		expect(result.id).toBe("job_abc123");
		expect(result.name).toBe("send-email");
		expect(result.status).toBe("completed");
		expect(result.payload).toEqual({ to: "user@example.com" });
		expect(result.result).toEqual({ sent: true });
		expect(getLastCall()?.url).toContain("/jobs/job_abc123");
		expect(getLastCall()?.options.method).toBe("GET");
	});

	test("gets pending job status", async () => {
		const mockResponse = {
			id: "job_pending",
			status: "pending",
			createdAt: "2025-01-15T09:00:00Z",
		};
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(mockResponse));
		}) as typeof fetch;

		const result = await getJob(mockConfig, "job_pending");

		expect(result.status).toBe("pending");
		expect(result.startedAt).toBeUndefined();
		expect(result.completedAt).toBeUndefined();
	});

	test("gets failed job with error", async () => {
		const mockResponse = {
			id: "job_failed",
			status: "failed",
			error: "Connection timeout",
			createdAt: "2025-01-15T09:00:00Z",
			startedAt: "2025-01-15T09:00:02Z",
			completedAt: "2025-01-15T09:00:32Z",
		};
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(mockResponse));
		}) as typeof fetch;

		const result = await getJob(mockConfig, "job_failed");

		expect(result.status).toBe("failed");
		expect(result.error).toBe("Connection timeout");
	});

	test("handles job not found", async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(
				new Response(JSON.stringify({ error: "Job not found" }), {
					status: 404,
					headers: { "Content-Type": "application/json" },
				}),
			);
		}) as typeof fetch;

		await expect(getJob(mockConfig, "nonexistent")).rejects.toThrow();
	});
});

// ============================================================================
// cancelJob Tests
// ============================================================================

describe("cancelJob", () => {
	test("cancels a pending job", async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse({ success: true }));
		}) as typeof fetch;

		const result = await cancelJob(mockConfig, "job_abc123");

		expect(result).toBe(true);
		expect(getLastCall()?.url).toContain("/jobs/job_abc123/cancel");
		expect(getLastCall()?.options.method).toBe("POST");
	});

	test("returns false when job cannot be cancelled", async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse({ success: false }));
		}) as typeof fetch;

		const result = await cancelJob(mockConfig, "job_already_completed");

		expect(result).toBe(false);
	});

	test("handles already running job", async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(
				createMockResponse({
					success: false,
					reason: "Job is already running",
				}),
			);
		}) as typeof fetch;

		const result = await cancelJob(mockConfig, "job_running");

		expect(result).toBe(false);
	});
});

// ============================================================================
// listJobs Tests
// ============================================================================

describe("listJobs", () => {
	test("lists all jobs", async () => {
		const mockResponse = {
			jobs: [
				{ id: "job_1", status: "completed", createdAt: "2025-01-15T09:00:00Z" },
				{ id: "job_2", status: "pending", createdAt: "2025-01-15T10:00:00Z" },
				{ id: "job_3", status: "running", createdAt: "2025-01-15T11:00:00Z" },
			],
			total: 3,
		};
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(mockResponse));
		}) as typeof fetch;

		const result = await listJobs(mockConfig);

		expect(result.jobs).toHaveLength(3);
		expect(result.total).toBe(3);
		expect(getLastCall()?.url).toContain("/jobs");
		expect(getLastCall()?.options.method).toBe("GET");
	});

	test("filters jobs by status", async () => {
		const mockResponse = {
			jobs: [
				{ id: "job_1", status: "pending", createdAt: "2025-01-15T09:00:00Z" },
			],
			total: 1,
		};
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(mockResponse));
		}) as typeof fetch;

		const result = await listJobs(mockConfig, { status: "pending" });

		expect(result.jobs).toHaveLength(1);
		expect(result.jobs[0]?.status).toBe("pending");
		expect(getLastCall()?.url).toContain("status=pending");
	});

	test("paginates with limit and offset", async () => {
		const mockResponse = {
			jobs: [
				{
					id: "job_11",
					status: "completed",
					createdAt: "2025-01-15T09:00:00Z",
				},
			],
			total: 25,
		};
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(mockResponse));
		}) as typeof fetch;

		const result = await listJobs(mockConfig, { limit: 10, offset: 10 });

		expect(result.total).toBe(25);
		expect(getLastCall()?.url).toContain("limit=10");
		expect(getLastCall()?.url).toContain("offset=10");
	});

	test("returns empty list when no jobs", async () => {
		const mockResponse = { jobs: [], total: 0 };
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(mockResponse));
		}) as typeof fetch;

		const result = await listJobs(mockConfig);

		expect(result.jobs).toHaveLength(0);
		expect(result.total).toBe(0);
	});
});

// ============================================================================
// createCron Tests
// ============================================================================

describe("createCron", () => {
	test("creates a recurring cron job", async () => {
		const mockResponse = {
			jobId: "job_cron_123",
			scheduleId: "sched_abc789",
			cron: "0 9 * * *",
			paused: false,
		};
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(mockResponse));
		}) as typeof fetch;

		const result = await createCron(mockConfig, {
			callbackUrl: "https://myapp.com/api/webhooks/platform-jobs",
			cron: "0 9 * * *", // Every day at 9am UTC
			name: "daily-report",
			payload: { type: "daily" },
		});

		expect(result.scheduleId).toBe("sched_abc789");
		expect(result.cron).toBe("0 9 * * *");
		expect(result.paused).toBe(false);
		expect(getLastCall()?.url).toContain("/jobs/cron");
		expect(getLastCall()?.options.method).toBe("POST");
	});

	test("includes all cron options in request", async () => {
		const mockResponse = {
			scheduleId: "sched_123",
			cron: "*/5 * * * *",
			paused: true,
		};
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(mockResponse));
		}) as typeof fetch;

		await createCron(mockConfig, {
			callbackUrl: "https://myapp.com/api/jobs/healthcheck",
			cron: "*/5 * * * *", // Every 5 minutes
			name: "health-check",
			type: "monitoring",
			payload: { service: "api" },
			method: "GET",
			headers: { Authorization: "Bearer secret" },
			retries: 2,
			paused: true,
		});

		const body = getRequestBody();
		expect(body?.callbackUrl).toBe("https://myapp.com/api/jobs/healthcheck");
		expect(body?.cron).toBe("*/5 * * * *");
		expect(body?.name).toBe("health-check");
		expect(body?.type).toBe("monitoring");
		expect(body?.payload).toEqual({ service: "api" });
		expect(body?.method).toBe("GET");
		expect(body?.headers).toEqual({ Authorization: "Bearer secret" });
		expect(body?.retries).toBe(2);
		expect(body?.paused).toBe(true);
	});

	test("creates cron with idempotency key", async () => {
		const mockResponse = {
			scheduleId: "sched_123",
			cron: "0 0 * * 0",
			paused: false,
		};
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(mockResponse));
		}) as typeof fetch;

		await createCron(mockConfig, {
			callbackUrl: "https://myapp.com/api/jobs/weekly-digest",
			cron: "0 0 * * 0", // Every Sunday at midnight
			name: "weekly-digest",
			idempotencyKey: "weekly-digest-cron-v1",
		});

		const body = getRequestBody();
		expect(body?.idempotencyKey).toBe("weekly-digest-cron-v1");
	});

	test("creates cron in paused state", async () => {
		const mockResponse = {
			scheduleId: "sched_paused",
			cron: "0 0 1 * *",
			paused: true,
		};
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(mockResponse));
		}) as typeof fetch;

		const result = await createCron(mockConfig, {
			callbackUrl: "https://myapp.com/api/jobs/monthly-billing",
			cron: "0 0 1 * *", // First day of each month
			name: "monthly-billing",
			paused: true,
		});

		expect(result.paused).toBe(true);
	});

	test("handles invalid cron expression", async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(
				new Response(JSON.stringify({ error: "Invalid cron expression" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				}),
			);
		}) as typeof fetch;

		await expect(
			createCron(mockConfig, {
				callbackUrl: "https://myapp.com/api/jobs/test",
				cron: "invalid cron",
				name: "test-cron",
			}),
		).rejects.toThrow();
	});
});

// ============================================================================
// pauseCron Tests
// ============================================================================

describe("pauseCron", () => {
	test("pauses a cron schedule", async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse({ success: true }));
		}) as typeof fetch;

		const result = await pauseCron(mockConfig, "sched_abc123");

		expect(result).toBe(true);
		expect(getLastCall()?.url).toContain("/jobs/cron/sched_abc123/pause");
		expect(getLastCall()?.options.method).toBe("POST");
	});

	test("returns false when pause fails", async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse({ success: false }));
		}) as typeof fetch;

		const result = await pauseCron(mockConfig, "sched_nonexistent");

		expect(result).toBe(false);
	});
});

// ============================================================================
// resumeCron Tests
// ============================================================================

describe("resumeCron", () => {
	test("resumes a paused cron schedule", async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse({ success: true }));
		}) as typeof fetch;

		const result = await resumeCron(mockConfig, "sched_abc123");

		expect(result).toBe(true);
		expect(getLastCall()?.url).toContain("/jobs/cron/sched_abc123/resume");
		expect(getLastCall()?.options.method).toBe("POST");
	});

	test("returns false when resume fails", async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse({ success: false }));
		}) as typeof fetch;

		const result = await resumeCron(mockConfig, "sched_already_running");

		expect(result).toBe(false);
	});
});

// ============================================================================
// deleteCron Tests
// ============================================================================

describe("deleteCron", () => {
	test("deletes a cron schedule", async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse({ success: true }));
		}) as typeof fetch;

		const result = await deleteCron(mockConfig, "sched_abc123");

		expect(result).toBe(true);
		expect(getLastCall()?.url).toContain("/jobs/cron/sched_abc123");
		expect(getLastCall()?.options.method).toBe("DELETE");
	});

	test("returns false when delete fails", async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse({ success: false }));
		}) as typeof fetch;

		const result = await deleteCron(mockConfig, "sched_nonexistent");

		expect(result).toBe(false);
	});

	test("handles schedule not found", async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(
				new Response(JSON.stringify({ error: "Schedule not found" }), {
					status: 404,
					headers: { "Content-Type": "application/json" },
				}),
			);
		}) as typeof fetch;

		await expect(deleteCron(mockConfig, "nonexistent")).rejects.toThrow();
	});
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Edge Cases", () => {
	test("handles maximum delay (7 days)", async () => {
		const mockResponse = { jobId: "job_max_delay" };
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(mockResponse));
		}) as typeof fetch;

		await scheduleJob(mockConfig, {
			callbackUrl: "https://myapp.com/api/jobs/future",
			delay: 604800, // 7 days in seconds
		});

		const body = getRequestBody();
		expect(body?.delay).toBe(604800);
	});

	test("handles complex payload", async () => {
		const mockResponse = { jobId: "job_complex" };
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(mockResponse));
		}) as typeof fetch;

		const complexPayload = {
			users: ["user-1", "user-2", "user-3"],
			settings: {
				notify: true,
				channels: ["email", "push"],
				nested: {
					deep: {
						value: 42,
					},
				},
			},
			tags: null,
		};

		await scheduleJob(mockConfig, {
			callbackUrl: "https://myapp.com/api/jobs/batch",
			payload: complexPayload,
		});

		const body = getRequestBody();
		expect(body?.payload).toEqual(complexPayload);
	});

	test("handles empty payload", async () => {
		const mockResponse = { jobId: "job_empty" };
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(mockResponse));
		}) as typeof fetch;

		await scheduleJob(mockConfig, {
			callbackUrl: "https://myapp.com/api/jobs/ping",
			payload: {},
		});

		const body = getRequestBody();
		expect(body?.payload).toEqual({});
	});

	test("handles all job statuses", async () => {
		const statuses = [
			"pending",
			"queued",
			"running",
			"completed",
			"failed",
			"cancelled",
		] as const;

		for (const status of statuses) {
			fetchCalls = [];
			globalThis.fetch = mock((url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return Promise.resolve(
					createMockResponse({
						id: `job_${status}`,
						status,
						createdAt: "2025-01-15T09:00:00Z",
					}),
				);
			}) as typeof fetch;

			const result = await getJob(mockConfig, `job_${status}`);
			expect(result.status).toBe(status);
		}
	});

	test("handles different HTTP methods", async () => {
		const methods = ["GET", "POST", "PUT", "DELETE"] as const;

		for (const method of methods) {
			fetchCalls = [];
			const mockResponse = { jobId: `job_${method.toLowerCase()}` };
			globalThis.fetch = mock((url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return Promise.resolve(createMockResponse(mockResponse));
			}) as typeof fetch;

			await scheduleJob(mockConfig, {
				callbackUrl: "https://myapp.com/api/jobs/test",
				method,
			});

			const body = getRequestBody();
			expect(body?.method).toBe(method);
		}
	});

	test("handles cron expressions", async () => {
		const expressions = [
			{ cron: "* * * * *", desc: "every minute" },
			{ cron: "0 * * * *", desc: "every hour" },
			{ cron: "0 0 * * *", desc: "every day at midnight" },
			{ cron: "0 0 * * 0", desc: "every Sunday" },
			{ cron: "0 0 1 * *", desc: "first day of month" },
			{ cron: "*/5 * * * *", desc: "every 5 minutes" },
			{ cron: "0 9-17 * * 1-5", desc: "weekday business hours" },
		];

		for (const { cron } of expressions) {
			fetchCalls = [];
			const mockResponse = { scheduleId: "sched_123", cron, paused: false };
			globalThis.fetch = mock((url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return Promise.resolve(createMockResponse(mockResponse));
			}) as typeof fetch;

			const result = await createCron(mockConfig, {
				callbackUrl: "https://myapp.com/api/jobs/test",
				cron,
				name: "test-cron",
			});

			expect(result.cron).toBe(cron);
		}
	});

	test("handles retry configuration (0-5)", async () => {
		for (let retries = 0; retries <= 5; retries++) {
			fetchCalls = [];
			const mockResponse = { jobId: `job_retry_${retries}` };
			globalThis.fetch = mock((url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return Promise.resolve(createMockResponse(mockResponse));
			}) as typeof fetch;

			await scheduleJob(mockConfig, {
				callbackUrl: "https://myapp.com/api/jobs/test",
				retries,
			});

			const body = getRequestBody();
			expect(body?.retries).toBe(retries);
		}
	});

	test("handles timeout configuration", async () => {
		const timeouts = [1, 30, 60, 120, 300];

		for (const timeout of timeouts) {
			fetchCalls = [];
			const mockResponse = { jobId: `job_timeout_${timeout}` };
			globalThis.fetch = mock((url: string, options: RequestInit) => {
				fetchCalls.push({ url, options });
				return Promise.resolve(createMockResponse(mockResponse));
			}) as typeof fetch;

			await scheduleJob(mockConfig, {
				callbackUrl: "https://myapp.com/api/jobs/test",
				timeout,
			});

			const body = getRequestBody();
			expect(body?.timeout).toBe(timeout);
		}
	});
});
