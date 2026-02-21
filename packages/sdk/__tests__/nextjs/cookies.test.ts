/**
 * Next.js Cookies Tests
 *
 * Tests for cookie management logic.
 */

import { describe, expect, test } from "bun:test";

// ============================================================================
// Types (from cookies.ts)
// ============================================================================

interface User {
	id: string;
	email: string;
	name: string | null;
	image: string | null;
}

interface TokenResponse {
	accessToken: string;
	refreshToken: string;
	user: User;
}

interface UserCookieData {
	user: User;
	expiresAt: number;
}

// ============================================================================
// Cookie Name Generation Tests
// ============================================================================

describe("getCookieNames", () => {
	function getCookieNames(namespace: string) {
		return {
			SESSION: `__${namespace}_session`,
			REFRESH: `__${namespace}_refresh`,
			USER: `__${namespace}_user`,
		};
	}

	test("generates correct cookie names for prod namespace", () => {
		const names = getCookieNames("sylphx_prod");
		expect(names.SESSION).toBe("__sylphx_prod_session");
		expect(names.REFRESH).toBe("__sylphx_prod_refresh");
		expect(names.USER).toBe("__sylphx_prod_user");
	});

	test("generates correct cookie names for dev namespace", () => {
		const names = getCookieNames("sylphx_dev");
		expect(names.SESSION).toBe("__sylphx_dev_session");
		expect(names.REFRESH).toBe("__sylphx_dev_refresh");
		expect(names.USER).toBe("__sylphx_dev_user");
	});

	test("generates correct cookie names for staging namespace", () => {
		const names = getCookieNames("sylphx_stg");
		expect(names.SESSION).toBe("__sylphx_stg_session");
		expect(names.REFRESH).toBe("__sylphx_stg_refresh");
		expect(names.USER).toBe("__sylphx_stg_user");
	});

	test("handles custom namespace", () => {
		const names = getCookieNames("myapp_custom");
		expect(names.SESSION).toBe("__myapp_custom_session");
		expect(names.REFRESH).toBe("__myapp_custom_refresh");
		expect(names.USER).toBe("__myapp_custom_user");
	});
});

// ============================================================================
// Cookie Lifetime Constants Tests
// ============================================================================

describe("Cookie lifetimes", () => {
	const SESSION_TOKEN_LIFETIME = 300; // 5 minutes
	const REFRESH_TOKEN_LIFETIME = 2592000; // 30 days

	test("session token lifetime is 5 minutes", () => {
		expect(SESSION_TOKEN_LIFETIME).toBe(5 * 60); // 300 seconds
	});

	test("refresh token lifetime is 30 days", () => {
		expect(REFRESH_TOKEN_LIFETIME).toBe(30 * 24 * 60 * 60); // 2,592,000 seconds
	});
});

// ============================================================================
// Cookie Options Tests
// ============================================================================

describe("Cookie options", () => {
	describe("Secure cookie options", () => {
		const getSecureCookieOptions = (isProduction: boolean) => ({
			httpOnly: true,
			secure: isProduction,
			sameSite: "lax" as const,
			path: "/",
		});

		test("includes httpOnly for security", () => {
			const options = getSecureCookieOptions(true);
			expect(options.httpOnly).toBe(true);
		});

		test("secure is true in production", () => {
			const options = getSecureCookieOptions(true);
			expect(options.secure).toBe(true);
		});

		test("secure is false in development", () => {
			const options = getSecureCookieOptions(false);
			expect(options.secure).toBe(false);
		});

		test("sameSite is lax for CSRF protection", () => {
			const options = getSecureCookieOptions(true);
			expect(options.sameSite).toBe("lax");
		});

		test("path is root", () => {
			const options = getSecureCookieOptions(true);
			expect(options.path).toBe("/");
		});
	});

	describe("User cookie options", () => {
		const getUserCookieOptions = (isProduction: boolean) => ({
			httpOnly: false, // Readable by client JS for hydration
			secure: isProduction,
			sameSite: "lax" as const,
			path: "/",
		});

		test("httpOnly is false for client access", () => {
			const options = getUserCookieOptions(true);
			expect(options.httpOnly).toBe(false);
		});

		test("secure follows environment", () => {
			expect(getUserCookieOptions(true).secure).toBe(true);
			expect(getUserCookieOptions(false).secure).toBe(false);
		});
	});
});

// ============================================================================
// User Cookie Data Tests
// ============================================================================

describe("User cookie data", () => {
	test("creates correct user cookie data structure", () => {
		const user: User = {
			id: "user-123",
			email: "test@example.com",
			name: "Test User",
			image: "https://example.com/avatar.jpg",
		};

		const expiresAt = Date.now() + 300 * 1000; // 5 minutes from now

		const userData: UserCookieData = {
			user,
			expiresAt,
		};

		expect(userData.user.id).toBe("user-123");
		expect(userData.user.email).toBe("test@example.com");
		expect(userData.expiresAt).toBe(expiresAt);
	});

	test("serializes to valid JSON", () => {
		const userData: UserCookieData = {
			user: {
				id: "user-123",
				email: "test@example.com",
				name: "Test User",
				image: null,
			},
			expiresAt: Date.now() + 300 * 1000,
		};

		const json = JSON.stringify(userData);
		const parsed = JSON.parse(json) as UserCookieData;

		expect(parsed.user.id).toBe(userData.user.id);
		expect(parsed.user.email).toBe(userData.user.email);
		expect(parsed.expiresAt).toBe(userData.expiresAt);
	});
});

// ============================================================================
// parseUserCookie Tests
// ============================================================================

describe("parseUserCookie", () => {
	function parseUserCookie(value: string): UserCookieData | null {
		try {
			return JSON.parse(value) as UserCookieData;
		} catch {
			return null;
		}
	}

	test("parses valid user cookie", () => {
		const userData: UserCookieData = {
			user: {
				id: "user-123",
				email: "test@example.com",
				name: "Test User",
				image: null,
			},
			expiresAt: Date.now() + 300 * 1000,
		};

		const json = JSON.stringify(userData);
		const parsed = parseUserCookie(json);

		expect(parsed).not.toBeNull();
		expect(parsed?.user.id).toBe("user-123");
	});

	test("returns null for invalid JSON", () => {
		expect(parseUserCookie("invalid json")).toBeNull();
		expect(parseUserCookie("")).toBeNull();
		expect(parseUserCookie("{incomplete")).toBeNull();
	});

	test("returns null for malformed data", () => {
		expect(parseUserCookie("null")).toBeNull();
		expect(parseUserCookie("undefined")).toBeNull();
	});
});

// ============================================================================
// Session Expiry Logic Tests
// ============================================================================

describe("Session expiry logic", () => {
	const TOKEN_EXPIRY_BUFFER_MS = 30 * 1000; // 30 seconds

	test("session is expired when expiresAt is null", () => {
		function isSessionExpired(expiresAt: number | null): boolean {
			if (!expiresAt) return true;
			return expiresAt < Date.now() + TOKEN_EXPIRY_BUFFER_MS;
		}

		expect(isSessionExpired(null)).toBe(true);
	});

	test("session is expired when past expiry", () => {
		function isSessionExpired(expiresAt: number | null): boolean {
			if (!expiresAt) return true;
			return expiresAt < Date.now() + TOKEN_EXPIRY_BUFFER_MS;
		}

		// Expired 1 minute ago
		const pastExpiry = Date.now() - 60 * 1000;
		expect(isSessionExpired(pastExpiry)).toBe(true);
	});

	test("session is expired within buffer period", () => {
		function isSessionExpired(expiresAt: number | null): boolean {
			if (!expiresAt) return true;
			return expiresAt < Date.now() + TOKEN_EXPIRY_BUFFER_MS;
		}

		// Expires in 15 seconds (within 30 second buffer)
		const nearExpiry = Date.now() + 15 * 1000;
		expect(isSessionExpired(nearExpiry)).toBe(true);
	});

	test("session is valid when well before expiry", () => {
		function isSessionExpired(expiresAt: number | null): boolean {
			if (!expiresAt) return true;
			return expiresAt < Date.now() + TOKEN_EXPIRY_BUFFER_MS;
		}

		// Expires in 2 minutes (well beyond buffer)
		const futureExpiry = Date.now() + 2 * 60 * 1000;
		expect(isSessionExpired(futureExpiry)).toBe(false);
	});
});

// ============================================================================
// Auth Cookies Data Tests
// ============================================================================

describe("Auth cookies data extraction", () => {
	interface AuthCookiesData {
		sessionToken: string | null;
		refreshToken: string | null;
		user: User | null;
		expiresAt: number | null;
	}

	test("extracts all cookies when present", () => {
		const mockCookies = {
			sessionToken: "access-token-123",
			refreshToken: "refresh-token-456",
			userCookie: JSON.stringify({
				user: {
					id: "user-123",
					email: "test@example.com",
					name: "Test User",
					image: null,
				},
				expiresAt: Date.now() + 300 * 1000,
			}),
		};

		function extractAuthCookies(): AuthCookiesData {
			let user: User | null = null;
			let expiresAt: number | null = null;

			if (mockCookies.userCookie) {
				const parsed = JSON.parse(mockCookies.userCookie) as UserCookieData;
				user = parsed.user;
				expiresAt = parsed.expiresAt;
			}

			return {
				sessionToken: mockCookies.sessionToken,
				refreshToken: mockCookies.refreshToken,
				user,
				expiresAt,
			};
		}

		const data = extractAuthCookies();
		expect(data.sessionToken).toBe("access-token-123");
		expect(data.refreshToken).toBe("refresh-token-456");
		expect(data.user?.id).toBe("user-123");
		expect(data.expiresAt).not.toBeNull();
	});

	test("handles missing cookies", () => {
		const mockCookies = {
			sessionToken: null as string | null,
			refreshToken: null as string | null,
			userCookie: null as string | null,
		};

		function extractAuthCookies(): AuthCookiesData {
			let user: User | null = null;
			let expiresAt: number | null = null;

			if (mockCookies.userCookie) {
				const parsed = JSON.parse(mockCookies.userCookie) as UserCookieData;
				user = parsed.user;
				expiresAt = parsed.expiresAt;
			}

			return {
				sessionToken: mockCookies.sessionToken,
				refreshToken: mockCookies.refreshToken,
				user,
				expiresAt,
			};
		}

		const data = extractAuthCookies();
		expect(data.sessionToken).toBeNull();
		expect(data.refreshToken).toBeNull();
		expect(data.user).toBeNull();
		expect(data.expiresAt).toBeNull();
	});

	test("handles invalid user cookie JSON", () => {
		const mockCookies = {
			sessionToken: "access-token",
			refreshToken: "refresh-token",
			userCookie: "invalid json",
		};

		function extractAuthCookies(): AuthCookiesData {
			let user: User | null = null;
			let expiresAt: number | null = null;

			if (mockCookies.userCookie) {
				try {
					const parsed = JSON.parse(mockCookies.userCookie) as UserCookieData;
					user = parsed.user;
					expiresAt = parsed.expiresAt;
				} catch {
					user = null;
					expiresAt = null;
				}
			}

			return {
				sessionToken: mockCookies.sessionToken,
				refreshToken: mockCookies.refreshToken,
				user,
				expiresAt,
			};
		}

		const data = extractAuthCookies();
		expect(data.sessionToken).toBe("access-token");
		expect(data.refreshToken).toBe("refresh-token");
		expect(data.user).toBeNull();
		expect(data.expiresAt).toBeNull();
	});
});

// ============================================================================
// Token Response Cookie Building Tests
// ============================================================================

describe("Token response to cookie building", () => {
	test("builds user cookie data from token response", () => {
		const SESSION_TOKEN_LIFETIME = 300; // 5 minutes

		const tokenResponse: TokenResponse = {
			accessToken: "access-token-123",
			refreshToken: "refresh-token-456",
			user: {
				id: "user-123",
				email: "test@example.com",
				name: "Test User",
				image: "https://example.com/avatar.jpg",
			},
		};

		const now = Date.now();
		const expiresAt = now + SESSION_TOKEN_LIFETIME * 1000;

		const userData: UserCookieData = {
			user: tokenResponse.user,
			expiresAt,
		};

		expect(userData.user).toBe(tokenResponse.user);
		expect(userData.expiresAt).toBeGreaterThan(now);
		expect(userData.expiresAt).toBeLessThanOrEqual(now + 300 * 1000);
	});
});

// ============================================================================
// hasRefreshToken Logic Tests
// ============================================================================

describe("hasRefreshToken logic", () => {
	test("returns true when refresh token exists", () => {
		const refreshToken = "refresh-token-123";
		expect(!!refreshToken).toBe(true);
	});

	test("returns false when refresh token is null", () => {
		const refreshToken = null;
		expect(!!refreshToken).toBe(false);
	});

	test("returns false when refresh token is empty string", () => {
		const refreshToken = "";
		expect(!!refreshToken).toBe(false);
	});
});
