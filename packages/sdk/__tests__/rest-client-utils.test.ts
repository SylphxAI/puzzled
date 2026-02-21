/**
 * REST Client Utilities Tests
 *
 * Tests for REST client helper functions: hasError and getRestErrorMessage.
 * These are critical for proper error handling in SDK consumers.
 */

import { describe, expect, test } from "bun:test";
import { getRestErrorMessage, hasError } from "../src/rest-client";

// ============================================================================
// hasError Tests
// ============================================================================

describe("hasError", () => {
	describe("detects errors correctly", () => {
		test("returns true when error is present", () => {
			const response = { error: { message: "Something went wrong" } };
			expect(hasError(response)).toBe(true);
		});

		test("returns true when error is an empty object", () => {
			const response = { error: {} };
			expect(hasError(response)).toBe(true);
		});

		test("returns true when error is a string", () => {
			const response = { error: "Error message" };
			expect(hasError(response)).toBe(true);
		});

		test("returns true when error is null (error key exists)", () => {
			// null !== undefined, so null is treated as an error being present
			const response = { error: null };
			expect(hasError(response)).toBe(true);
		});
	});

	describe("detects success correctly", () => {
		test("returns false when only data is present", () => {
			const response = { data: { id: 1, name: "Test" } };
			expect(hasError(response)).toBe(false);
		});

		test("returns false when data is empty object", () => {
			const response = { data: {} };
			expect(hasError(response)).toBe(false);
		});

		test("returns false when data is null", () => {
			const response = { data: null };
			expect(hasError(response)).toBe(false);
		});

		test("returns false when error is undefined", () => {
			const response = { data: { id: 1 }, error: undefined };
			expect(hasError(response)).toBe(false);
		});
	});

	describe("type narrowing", () => {
		test("narrows type correctly for error case", () => {
			const response: { data?: { id: number }; error?: { message: string } } = {
				error: { message: "Not found" },
			};

			if (hasError(response)) {
				// TypeScript should know error exists here
				expect(response.error.message).toBe("Not found");
			}
		});

		test("narrows type correctly for success case", () => {
			const response: { data?: { id: number }; error?: { message: string } } = {
				data: { id: 123 },
			};

			if (!hasError(response)) {
				// TypeScript should know data might exist here
				expect(response.data?.id).toBe(123);
			}
		});
	});

	describe("edge cases", () => {
		test("handles response with both data and error", () => {
			// Some APIs might return both (error takes precedence)
			const response = {
				data: { id: 1 },
				error: { message: "Partial failure" },
			};
			expect(hasError(response)).toBe(true);
		});

		test("handles empty response object", () => {
			const response = {};
			expect(hasError(response)).toBe(false);
		});

		test("handles response with extra properties", () => {
			const response = { data: { id: 1 }, meta: { total: 100 } };
			expect(hasError(response)).toBe(false);
		});
	});
});

// ============================================================================
// getRestErrorMessage Tests
// ============================================================================

describe("getRestErrorMessage", () => {
	describe("extracts message from error object", () => {
		test("extracts from nested error.message", () => {
			const error = { error: { message: "User not found" } };
			expect(getRestErrorMessage(error)).toBe("User not found");
		});

		test("extracts from error.error.message", () => {
			const error = {
				error: { message: "Invalid input", code: "VALIDATION_ERROR" },
			};
			expect(getRestErrorMessage(error)).toBe("Invalid input");
		});

		test("handles missing message in error object", () => {
			const error = { error: { code: "NOT_FOUND" } };
			expect(getRestErrorMessage(error)).toBe("An unknown error occurred");
		});

		test("handles empty error object", () => {
			const error = { error: {} };
			expect(getRestErrorMessage(error)).toBe("An unknown error occurred");
		});
	});

	describe("extracts message from Error instances", () => {
		test("extracts from standard Error", () => {
			const error = new Error("Network failure");
			expect(getRestErrorMessage(error)).toBe("Network failure");
		});

		test("extracts from TypeError", () => {
			const error = new TypeError("Cannot read property");
			expect(getRestErrorMessage(error)).toBe("Cannot read property");
		});

		test("extracts from custom Error subclass", () => {
			class CustomError extends Error {
				constructor(message: string) {
					super(message);
					this.name = "CustomError";
				}
			}
			const error = new CustomError("Custom error message");
			expect(getRestErrorMessage(error)).toBe("Custom error message");
		});
	});

	describe("handles unknown error types", () => {
		test("returns default for null", () => {
			expect(getRestErrorMessage(null)).toBe("An unknown error occurred");
		});

		test("returns default for undefined", () => {
			expect(getRestErrorMessage(undefined)).toBe("An unknown error occurred");
		});

		test("returns default for number", () => {
			expect(getRestErrorMessage(404)).toBe("An unknown error occurred");
		});

		test("returns default for string", () => {
			// String is not an Error, so returns default
			expect(getRestErrorMessage("Some error")).toBe(
				"An unknown error occurred",
			);
		});

		test("returns default for plain object without error property", () => {
			expect(getRestErrorMessage({ message: "Not in error wrapper" })).toBe(
				"An unknown error occurred",
			);
		});

		test("returns default for array", () => {
			expect(getRestErrorMessage(["error1", "error2"])).toBe(
				"An unknown error occurred",
			);
		});
	});

	describe("edge cases", () => {
		test("handles error with null message", () => {
			const error = { error: { message: null } };
			expect(getRestErrorMessage(error)).toBe("An unknown error occurred");
		});

		test("handles error with undefined message", () => {
			const error = { error: { message: undefined } };
			expect(getRestErrorMessage(error)).toBe("An unknown error occurred");
		});

		test("handles deeply nested error", () => {
			// Only checks first level of error.message
			const error = { error: { nested: { message: "Deep message" } } };
			expect(getRestErrorMessage(error)).toBe("An unknown error occurred");
		});

		test("handles error with non-string message", () => {
			const error = { error: { message: 123 } };
			// The implementation returns message as-is (using ??), so non-string passes through
			// This is a type safety gap - runtime may encounter unexpected types
			expect(getRestErrorMessage(error)).toBe(123);
		});

		test("handles error with empty string message", () => {
			const error = { error: { message: "" } };
			// Empty string is truthy for ?? operator (only null/undefined trigger default)
			expect(getRestErrorMessage(error)).toBe("");
		});
	});

	describe("real-world API responses", () => {
		test("handles tRPC-style error", () => {
			const error = {
				error: {
					message: "UNAUTHORIZED",
					data: { code: "UNAUTHORIZED", httpStatus: 401 },
				},
			};
			expect(getRestErrorMessage(error)).toBe("UNAUTHORIZED");
		});

		test("handles Hono/OpenAPI-style error", () => {
			const error = {
				error: {
					message: "Validation failed",
					issues: [{ path: ["email"], message: "Invalid email" }],
				},
			};
			expect(getRestErrorMessage(error)).toBe("Validation failed");
		});

		test("handles generic HTTP error response", () => {
			const error = {
				error: {
					message: "Internal Server Error",
					statusCode: 500,
				},
			};
			expect(getRestErrorMessage(error)).toBe("Internal Server Error");
		});
	});
});
