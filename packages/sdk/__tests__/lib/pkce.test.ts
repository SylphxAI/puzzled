/**
 * PKCE (Proof Key for Code Exchange) Tests
 *
 * Tests for RFC 7636 PKCE implementation.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
	generateCodeChallenge,
	generateCodeVerifier,
	generatePKCE,
	verifyPKCE,
} from "../../src/lib/pkce";

// ============================================================================
// generateCodeVerifier Tests
// ============================================================================

describe("generateCodeVerifier", () => {
	describe("format compliance", () => {
		test("returns a string", () => {
			const verifier = generateCodeVerifier();
			expect(typeof verifier).toBe("string");
		});

		test("returns 64 character string", () => {
			const verifier = generateCodeVerifier();
			expect(verifier.length).toBe(64);
		});

		test("only contains unreserved URI characters", () => {
			const verifier = generateCodeVerifier();
			// RFC 7636 unreserved characters: A-Z, a-z, 0-9, -, ., _, ~
			expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
		});

		test("multiple calls return different verifiers", () => {
			const verifiers = new Set<string>();
			for (let i = 0; i < 100; i++) {
				verifiers.add(generateCodeVerifier());
			}
			// All should be unique
			expect(verifiers.size).toBe(100);
		});
	});

	describe("randomness quality", () => {
		test("has good character distribution", () => {
			const verifier = generateCodeVerifier();
			const charCounts = new Map<string, number>();

			for (const char of verifier) {
				charCounts.set(char, (charCounts.get(char) || 0) + 1);
			}

			// No single character should dominate
			for (const count of charCounts.values()) {
				expect(count).toBeLessThan(verifier.length / 2);
			}
		});

		test("generates verifiers with mixed case", () => {
			// Run multiple times to ensure we see both cases
			let hasUpper = false;
			let hasLower = false;

			for (let i = 0; i < 10; i++) {
				const verifier = generateCodeVerifier();
				if (/[A-Z]/.test(verifier)) hasUpper = true;
				if (/[a-z]/.test(verifier)) hasLower = true;
				if (hasUpper && hasLower) break;
			}

			expect(hasUpper).toBe(true);
			expect(hasLower).toBe(true);
		});

		test("generates verifiers with numbers", () => {
			let hasNumbers = false;

			for (let i = 0; i < 10; i++) {
				const verifier = generateCodeVerifier();
				if (/[0-9]/.test(verifier)) {
					hasNumbers = true;
					break;
				}
			}

			expect(hasNumbers).toBe(true);
		});
	});
});

// ============================================================================
// generateCodeChallenge Tests
// ============================================================================

describe("generateCodeChallenge", () => {
	describe("S256 method", () => {
		test("returns a string", async () => {
			const verifier = generateCodeVerifier();
			const challenge = await generateCodeChallenge(verifier);
			expect(typeof challenge).toBe("string");
		});

		test("returns base64url encoded string", async () => {
			const verifier = generateCodeVerifier();
			const challenge = await generateCodeChallenge(verifier);
			// Base64url: A-Z, a-z, 0-9, -, _ (no +, /, =)
			expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
		});

		test("returns consistent result for same verifier", async () => {
			const verifier = "test-verifier-12345";
			const challenge1 = await generateCodeChallenge(verifier);
			const challenge2 = await generateCodeChallenge(verifier);
			expect(challenge1).toBe(challenge2);
		});

		test("returns different result for different verifier", async () => {
			const challenge1 = await generateCodeChallenge("verifier-a");
			const challenge2 = await generateCodeChallenge("verifier-b");
			expect(challenge1).not.toBe(challenge2);
		});

		test("returns 43 character string (SHA-256 base64url)", async () => {
			// SHA-256 produces 32 bytes, base64url encodes to 43 chars (without padding)
			const verifier = generateCodeVerifier();
			const challenge = await generateCodeChallenge(verifier);
			expect(challenge.length).toBe(43);
		});

		test("no padding characters", async () => {
			const verifier = generateCodeVerifier();
			const challenge = await generateCodeChallenge(verifier);
			expect(challenge).not.toContain("=");
		});
	});

	describe("known test vectors", () => {
		// RFC 7636 Appendix B test vector
		test("matches RFC 7636 test vector", async () => {
			// This is a simplified test - actual RFC test uses specific encoding
			const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
			const challenge = await generateCodeChallenge(verifier);
			// Expected: E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
			expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
		});
	});

	describe("edge cases", () => {
		test("handles minimum length verifier", async () => {
			// Minimum 43 chars per RFC
			const verifier = "a".repeat(43);
			const challenge = await generateCodeChallenge(verifier);
			expect(challenge.length).toBe(43);
		});

		test("handles maximum length verifier", async () => {
			// Maximum 128 chars per RFC
			const verifier = "a".repeat(128);
			const challenge = await generateCodeChallenge(verifier);
			expect(challenge.length).toBe(43);
		});

		test("handles verifier with all allowed chars", async () => {
			const verifier =
				"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
			const challenge = await generateCodeChallenge(verifier);
			expect(challenge.length).toBe(43);
		});
	});
});

// ============================================================================
// generatePKCE Tests
// ============================================================================

describe("generatePKCE", () => {
	describe("complete pair generation", () => {
		test("returns verifier, challenge, and method", async () => {
			const result = await generatePKCE();

			expect(result).toHaveProperty("codeVerifier");
			expect(result).toHaveProperty("codeChallenge");
			expect(result).toHaveProperty("codeChallengeMethod");
		});

		test("method is always S256", async () => {
			const result = await generatePKCE();
			expect(result.codeChallengeMethod).toBe("S256");
		});

		test("verifier and challenge are valid", async () => {
			const result = await generatePKCE();

			// Verifier should be 64 chars with valid characters
			expect(result.codeVerifier.length).toBe(64);
			expect(result.codeVerifier).toMatch(/^[A-Za-z0-9\-._~]+$/);

			// Challenge should be 43 chars base64url
			expect(result.codeChallenge.length).toBe(43);
			expect(result.codeChallenge).toMatch(/^[A-Za-z0-9\-_]+$/);
		});

		test("verifier and challenge are correlated", async () => {
			const result = await generatePKCE();

			// Verify the challenge was generated from the verifier
			const expectedChallenge = await generateCodeChallenge(
				result.codeVerifier,
			);
			expect(result.codeChallenge).toBe(expectedChallenge);
		});

		test("multiple calls return different pairs", async () => {
			const pairs = await Promise.all([
				generatePKCE(),
				generatePKCE(),
				generatePKCE(),
			]);

			const verifiers = pairs.map((p) => p.codeVerifier);
			const challenges = pairs.map((p) => p.codeChallenge);

			// All should be unique
			expect(new Set(verifiers).size).toBe(3);
			expect(new Set(challenges).size).toBe(3);
		});
	});
});

// ============================================================================
// verifyPKCE Tests
// ============================================================================

describe("verifyPKCE", () => {
	describe("S256 method", () => {
		test("returns true for valid pair", async () => {
			const { codeVerifier, codeChallenge } = await generatePKCE();
			const result = await verifyPKCE(codeVerifier, codeChallenge, "S256");
			expect(result).toBe(true);
		});

		test("returns false for mismatched pair", async () => {
			const { codeChallenge } = await generatePKCE();
			const result = await verifyPKCE("wrong-verifier", codeChallenge, "S256");
			expect(result).toBe(false);
		});

		test("returns false for tampered challenge", async () => {
			const { codeVerifier } = await generatePKCE();
			const result = await verifyPKCE(
				codeVerifier,
				"tampered-challenge",
				"S256",
			);
			expect(result).toBe(false);
		});

		test("default method is S256", async () => {
			const { codeVerifier, codeChallenge } = await generatePKCE();
			// No method specified
			const result = await verifyPKCE(codeVerifier, codeChallenge);
			expect(result).toBe(true);
		});
	});

	describe("plain method", () => {
		test("returns true for matching verifier and challenge", async () => {
			const verifier = "plain-verifier-test";
			const result = await verifyPKCE(verifier, verifier, "plain");
			expect(result).toBe(true);
		});

		test("returns false for non-matching values", async () => {
			const result = await verifyPKCE("verifier", "different", "plain");
			expect(result).toBe(false);
		});

		test("plain does not hash", async () => {
			const verifier = "test";
			const hashedChallenge = await generateCodeChallenge(verifier);
			// Plain method should compare directly, not hash
			const result = await verifyPKCE(verifier, hashedChallenge, "plain");
			expect(result).toBe(false);
		});
	});

	describe("security edge cases", () => {
		test("rejects empty verifier", async () => {
			const { codeChallenge } = await generatePKCE();
			const result = await verifyPKCE("", codeChallenge, "S256");
			expect(result).toBe(false);
		});

		test("rejects empty challenge", async () => {
			const { codeVerifier } = await generatePKCE();
			const result = await verifyPKCE(codeVerifier, "", "S256");
			expect(result).toBe(false);
		});

		test("case sensitive comparison", async () => {
			const { codeVerifier, codeChallenge } = await generatePKCE();
			const upperChallenge = codeChallenge.toUpperCase();
			const result = await verifyPKCE(codeVerifier, upperChallenge, "S256");
			expect(result).toBe(false);
		});
	});
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("PKCE integration", () => {
	test("full OAuth flow simulation", async () => {
		// Step 1: Generate PKCE pair (client)
		const { codeVerifier, codeChallenge, codeChallengeMethod } =
			await generatePKCE();

		expect(codeChallengeMethod).toBe("S256");

		// Step 2: Server receives code_challenge in authorization request
		// (code_challenge is sent to authorization endpoint)

		// Step 3: Server verifies code_verifier in token exchange
		const isValid = await verifyPKCE(
			codeVerifier,
			codeChallenge,
			codeChallengeMethod,
		);
		expect(isValid).toBe(true);

		// Step 4: Attacker intercepts code but doesn't have verifier
		const attackerVerifier = generateCodeVerifier();
		const attackerValid = await verifyPKCE(
			attackerVerifier,
			codeChallenge,
			codeChallengeMethod,
		);
		expect(attackerValid).toBe(false);
	});

	test("multiple concurrent PKCE flows", async () => {
		// Simulate multiple concurrent OAuth flows
		const flows = await Promise.all([
			generatePKCE(),
			generatePKCE(),
			generatePKCE(),
			generatePKCE(),
			generatePKCE(),
		]);

		// Each flow should have unique verifier/challenge
		const verifiers = flows.map((f) => f.codeVerifier);
		const challenges = flows.map((f) => f.codeChallenge);

		expect(new Set(verifiers).size).toBe(5);
		expect(new Set(challenges).size).toBe(5);

		// Each verifier should only match its own challenge
		for (let i = 0; i < flows.length; i++) {
			for (let j = 0; j < flows.length; j++) {
				const result = await verifyPKCE(
					flows[i].codeVerifier,
					flows[j].codeChallenge,
				);
				expect(result).toBe(i === j);
			}
		}
	});
});
