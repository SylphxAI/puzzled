/**
 * Rate Limiting Middleware
 *
 * Prevents abuse by limiting request frequency.
 * Uses Upstash Redis rate limiter.
 */

import { ratelimit } from "@/lib/redis";
import { auth } from "@sylphx/sdk/nextjs";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { PuzzledAuthEnv, PuzzledEnv } from "../types";

/**
 * Rate limiting middleware for public routes
 *
 * Uses IP-based rate limiting for unauthenticated requests.
 * Default: 10 requests per 10 seconds.
 */
export const rateLimitMiddleware = createMiddleware<PuzzledEnv>(
	async (c, next) => {
		const headers = c.get("headers") ?? c.req.raw.headers;
		const ip = headers.get("x-forwarded-for") ?? "anonymous";

		const result = await ratelimit.limit(`anon:${ip}`);
		if (!result.success) {
			throw new HTTPException(429, {
				message: "Too many requests. Please try again later.",
			});
		}

		await next();
	},
);

/**
 * Rate limiting middleware for authenticated routes
 *
 * Combines authentication with user-based rate limiting.
 * Use this instead of separate auth + rate limit middleware.
 */
export const authRateLimitMiddleware = createMiddleware<PuzzledAuthEnv>(
	async (c, next) => {
		const { userId, user, sessionToken } = await auth();

		if (!userId || !user) {
			throw new HTTPException(401, {
				message: "You must be logged in to perform this action",
			});
		}

		// User-based rate limiting
		const result = await ratelimit.limit(`user:${userId}`);
		if (!result.success) {
			throw new HTTPException(429, {
				message: "Too many requests. Please try again later.",
			});
		}

		// Set authenticated context
		c.set("user", user);
		c.set("userId", userId);
		c.set("sessionToken", sessionToken);
		c.set("headers", c.get("headers"));

		await next();
	},
);
