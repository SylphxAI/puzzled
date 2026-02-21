/**
 * Secrets Module Tests
 *
 * Tests for secrets management functions.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { SylphxConfig } from "../src/config";
import {
	getAllSecrets,
	getSecret,
	getSecrets,
	hasSecret,
	listSecretKeys,
} from "../src/secrets";

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

beforeEach(() => {
	fetchCalls = [];
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

// ============================================================================
// getSecret Tests
// ============================================================================

describe("getSecret", () => {
	test("retrieves a single secret by key", async () => {
		const mockResponse = {
			key: "DATABASE_URL",
			value: "postgres://user:pass@host:5432/db",
			version: "v1",
		};
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(mockResponse));
		}) as typeof fetch;

		const result = await getSecret(mockConfig, { key: "DATABASE_URL" });

		expect(result.key).toBe("DATABASE_URL");
		expect(result.value).toBe("postgres://user:pass@host:5432/db");
		expect(result.version).toBe("v1");
		expect(getLastCall()?.url).toContain("/secrets/get");
		expect(getLastCall()?.options.method).toBe("POST");
	});

	test("includes environment ID when specified", async () => {
		const mockResponse = { key: "API_KEY", value: "prod-key", version: "v2" };
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(mockResponse));
		}) as typeof fetch;

		await getSecret(mockConfig, {
			key: "API_KEY",
			environmentId: "env-production",
		});

		const body = getRequestBody();
		expect(body?.key).toBe("API_KEY");
		expect(body?.environmentId).toBe("env-production");
	});

	test("handles secret not found error", async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(
				new Response(JSON.stringify({ error: "Secret not found" }), {
					status: 404,
					headers: { "Content-Type": "application/json" },
				}),
			);
		}) as typeof fetch;

		await expect(
			getSecret(mockConfig, { key: "NONEXISTENT" }),
		).rejects.toThrow();
	});
});

// ============================================================================
// getSecrets Tests
// ============================================================================

describe("getSecrets", () => {
	test("retrieves multiple secrets at once", async () => {
		const mockResponse = {
			DATABASE_URL: "postgres://host/db",
			REDIS_URL: "redis://host:6379",
			JWT_SECRET: "super-secret-key",
		};
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(mockResponse));
		}) as typeof fetch;

		const result = await getSecrets(mockConfig, {
			keys: ["DATABASE_URL", "REDIS_URL", "JWT_SECRET"],
		});

		expect(result.DATABASE_URL).toBe("postgres://host/db");
		expect(result.REDIS_URL).toBe("redis://host:6379");
		expect(result.JWT_SECRET).toBe("super-secret-key");
		expect(getLastCall()?.url).toContain("/secrets/getMany");
	});

	test("includes environment ID", async () => {
		const mockResponse = { API_KEY: "staging-key" };
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(mockResponse));
		}) as typeof fetch;

		await getSecrets(mockConfig, {
			keys: ["API_KEY"],
			environmentId: "env-staging",
		});

		const body = getRequestBody();
		expect(body?.keys).toEqual(["API_KEY"]);
		expect(body?.environmentId).toBe("env-staging");
	});

	test("handles partial results (some keys not found)", async () => {
		const mockResponse = {
			FOUND_KEY: "value",
			// MISSING_KEY not returned
		};
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(mockResponse));
		}) as typeof fetch;

		const result = await getSecrets(mockConfig, {
			keys: ["FOUND_KEY", "MISSING_KEY"],
		});

		expect(result.FOUND_KEY).toBe("value");
		expect(result.MISSING_KEY).toBeUndefined();
	});
});

// ============================================================================
// listSecretKeys Tests
// ============================================================================

describe("listSecretKeys", () => {
	test("lists all secret keys without values", async () => {
		const mockResponse = [
			{
				key: "DATABASE_URL",
				description: "Primary database connection string",
				version: "v3",
				isEnvironmentSpecific: true,
			},
			{
				key: "API_KEY",
				description: "External API key",
				version: "v1",
				isEnvironmentSpecific: false,
			},
		];
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(mockResponse));
		}) as typeof fetch;

		const result = await listSecretKeys(mockConfig);

		expect(result).toHaveLength(2);
		expect(result[0]?.key).toBe("DATABASE_URL");
		expect(result[0]?.description).toBe("Primary database connection string");
		expect(result[0]?.isEnvironmentSpecific).toBe(true);
		expect(getLastCall()?.url).toContain("/secrets/listKeys");
		expect(getLastCall()?.options.method).toBe("GET");
	});

	test("filters by environment ID via query parameter", async () => {
		const mockResponse = [
			{
				key: "PROD_KEY",
				description: null,
				version: "v1",
				isEnvironmentSpecific: true,
			},
		];
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(mockResponse));
		}) as typeof fetch;

		const result = await listSecretKeys(mockConfig, {
			environmentId: "env-production",
		});

		// The function should still return results
		expect(result).toHaveLength(1);
		expect(result[0]?.key).toBe("PROD_KEY");
	});

	test("returns empty array when no secrets", async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse([]));
		}) as typeof fetch;

		const result = await listSecretKeys(mockConfig);

		expect(result).toHaveLength(0);
	});
});

// ============================================================================
// hasSecret Tests
// ============================================================================

describe("hasSecret", () => {
	test("returns true when secret exists", async () => {
		const mockResponse = [
			{
				key: "DATABASE_URL",
				description: null,
				version: "v1",
				isEnvironmentSpecific: false,
			},
			{
				key: "API_KEY",
				description: null,
				version: "v1",
				isEnvironmentSpecific: false,
			},
		];
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(mockResponse));
		}) as typeof fetch;

		const result = await hasSecret(mockConfig, "DATABASE_URL");

		expect(result).toBe(true);
	});

	test("returns false when secret does not exist", async () => {
		const mockResponse = [
			{
				key: "OTHER_KEY",
				description: null,
				version: "v1",
				isEnvironmentSpecific: false,
			},
		];
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(mockResponse));
		}) as typeof fetch;

		const result = await hasSecret(mockConfig, "NONEXISTENT_KEY");

		expect(result).toBe(false);
	});

	test("returns false on API error", async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(
				new Response(JSON.stringify({ error: "Unauthorized" }), {
					status: 401,
					headers: { "Content-Type": "application/json" },
				}),
			);
		}) as typeof fetch;

		const result = await hasSecret(mockConfig, "ANY_KEY");

		expect(result).toBe(false);
	});
});

// ============================================================================
// getAllSecrets Tests
// ============================================================================

describe("getAllSecrets", () => {
	test("retrieves all secrets for an environment", async () => {
		let callCount = 0;
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			callCount++;
			if (callCount === 1) {
				// First call: listSecretKeys
				return Promise.resolve(
					createMockResponse([
						{
							key: "DATABASE_URL",
							description: null,
							version: "v1",
							isEnvironmentSpecific: false,
						},
						{
							key: "API_KEY",
							description: null,
							version: "v1",
							isEnvironmentSpecific: false,
						},
					]),
				);
			}
			// Second call: getSecrets
			return Promise.resolve(
				createMockResponse({
					DATABASE_URL: "postgres://host/db",
					API_KEY: "secret-api-key",
				}),
			);
		}) as typeof fetch;

		const result = await getAllSecrets(mockConfig);

		expect(result.DATABASE_URL).toBe("postgres://host/db");
		expect(result.API_KEY).toBe("secret-api-key");
	});

	test("returns empty object when no secrets exist", async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse([]));
		}) as typeof fetch;

		const result = await getAllSecrets(mockConfig);

		expect(result).toEqual({});
	});

	test("passes environment ID to both calls", async () => {
		let callCount = 0;
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			callCount++;
			if (callCount === 1) {
				// First call: listSecretKeys
				return Promise.resolve(
					createMockResponse([
						{
							key: "PROD_KEY",
							description: null,
							version: "v1",
							isEnvironmentSpecific: true,
						},
					]),
				);
			}
			// Second call: getSecrets
			return Promise.resolve(
				createMockResponse({ PROD_KEY: "production-value" }),
			);
		}) as typeof fetch;

		const result = await getAllSecrets(mockConfig, "env-production");

		// Verify result contains the secret
		expect(result.PROD_KEY).toBe("production-value");
	});
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Edge Cases", () => {
	test("handles secret keys with underscores", async () => {
		const mockResponse = {
			key: "MY_APP_DATABASE_CONNECTION_STRING",
			value: "connection-string",
			version: "v1",
		};
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(mockResponse));
		}) as typeof fetch;

		const result = await getSecret(mockConfig, {
			key: "MY_APP_DATABASE_CONNECTION_STRING",
		});

		expect(result.key).toBe("MY_APP_DATABASE_CONNECTION_STRING");
	});

	test("handles secret values with special characters", async () => {
		const mockResponse = {
			key: "CONNECTION_STRING",
			value: "postgres://user:p@ss=w0rd!@host:5432/db?ssl=true&param=val",
			version: "v1",
		};
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(mockResponse));
		}) as typeof fetch;

		const result = await getSecret(mockConfig, { key: "CONNECTION_STRING" });

		expect(result.value).toBe(
			"postgres://user:p@ss=w0rd!@host:5432/db?ssl=true&param=val",
		);
	});

	test("handles very long secret values", async () => {
		const longValue = "A".repeat(10000);
		const mockResponse = {
			key: "LONG_SECRET",
			value: longValue,
			version: "v1",
		};
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(mockResponse));
		}) as typeof fetch;

		const result = await getSecret(mockConfig, { key: "LONG_SECRET" });

		expect(result.value).toBe(longValue);
	});

	test("handles many secrets at once", async () => {
		const secrets: Record<string, string> = {};
		for (let i = 0; i < 50; i++) {
			secrets[`SECRET_${i}`] = `value_${i}`;
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(secrets));
		}) as typeof fetch;

		const keys = Object.keys(secrets);
		const result = await getSecrets(mockConfig, { keys });

		expect(Object.keys(result)).toHaveLength(50);
		expect(result.SECRET_0).toBe("value_0");
		expect(result.SECRET_49).toBe("value_49");
	});

	test("handles null description in secret keys", async () => {
		const mockResponse = [
			{
				key: "NO_DESC_KEY",
				description: null,
				version: "v1",
				isEnvironmentSpecific: false,
			},
		];
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options });
			return Promise.resolve(createMockResponse(mockResponse));
		}) as typeof fetch;

		const result = await listSecretKeys(mockConfig);

		expect(result[0]?.description).toBeNull();
	});
});
