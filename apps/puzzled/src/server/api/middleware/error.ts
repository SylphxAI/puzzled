/**
 * Error Handling Middleware
 *
 * Catches all errors and returns proper JSON responses.
 * Logs errors and reports to monitoring in production.
 */

import { captureError } from "@/lib/monitoring";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import type { PuzzledEnv } from "../types";

/**
 * Map HTTP status codes to error codes
 */
const STATUS_TO_CODE: Record<number, string> = {
	400: "BAD_REQUEST",
	401: "UNAUTHORIZED",
	403: "FORBIDDEN",
	404: "NOT_FOUND",
	409: "CONFLICT",
	429: "TOO_MANY_REQUESTS",
	500: "INTERNAL_SERVER_ERROR",
};

/**
 * Error response format
 */
interface ErrorResponse {
	error: {
		code: string;
		message: string;
		zodError?: ReturnType<ZodError["flatten"]>;
	};
}

/**
 * Global error handler middleware
 *
 * Catches all unhandled errors and returns proper JSON responses.
 */
export const errorHandler = createMiddleware<PuzzledEnv>(async (c, next) => {
	try {
		await next();
	} catch (error) {
		// Handle HTTPException (our controlled errors)
		if (error instanceof HTTPException) {
			const status = error.status;
			const code = STATUS_TO_CODE[status] ?? "UNKNOWN";

			const response: ErrorResponse = {
				error: {
					code,
					message: error.message,
				},
			};

			return c.json(response, status);
		}

		// Handle Zod validation errors
		if (error instanceof ZodError) {
			const response: ErrorResponse = {
				error: {
					code: "BAD_REQUEST",
					message: "Validation failed",
					zodError: error.flatten(),
				},
			};

			return c.json(response, 400);
		}

		// Handle unexpected errors
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";

		// Log in development
		if (process.env.NODE_ENV === "development") {
			console.error("[API Error]", error);
		}

		// Report to monitoring in production
		if (process.env.NODE_ENV === "production" && error instanceof Error) {
			captureError(error, {
				tags: {
					api_path: c.req.path,
					api_method: c.req.method,
				},
			});
		}

		const response: ErrorResponse = {
			error: {
				code: "INTERNAL_SERVER_ERROR",
				message:
					process.env.NODE_ENV === "development"
						? errorMessage
						: "An unexpected error occurred",
			},
		};

		return c.json(response, 500);
	}
});
