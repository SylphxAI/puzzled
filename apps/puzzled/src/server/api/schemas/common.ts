/**
 * Common Schemas
 *
 * Shared Zod schemas used across multiple routes.
 */

import { z } from "zod";

/**
 * Standard error response schema
 */
export const ErrorResponseSchema = z.object({
	error: z.object({
		code: z.string(),
		message: z.string(),
		zodError: z
			.object({
				formErrors: z.array(z.string()),
				fieldErrors: z.record(z.string(), z.array(z.string())),
			})
			.optional(),
	}),
});

/**
 * Standard success response schema
 */
export const SuccessResponseSchema = z.object({
	success: z.literal(true),
});

/**
 * Pagination query parameters schema
 */
export const PaginationQuerySchema = z.object({
	limit: z.coerce.number().min(1).max(100).default(20),
	offset: z.coerce.number().min(0).default(0),
});

/**
 * UUID parameter schema
 */
export const UUIDParamSchema = z.object({
	id: z.string().uuid(),
});

/**
 * Game slug schema with validation
 */
export const GameSlugSchema = z.string().min(1).max(50);

/**
 * Date string schema (YYYY-MM-DD format)
 */
export const DateStringSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)");

/**
 * Puzzle difficulty values
 */
export const PUZZLE_DIFFICULTY_VALUES = [
	"easy",
	"medium",
	"hard",
	"expert",
] as const;
export const PuzzleDifficultySchema = z.enum(PUZZLE_DIFFICULTY_VALUES);

/**
 * Game result status values
 */
export const GAME_RESULT_STATUSES = ["won", "lost", "abandoned"] as const;
export const GameResultStatusSchema = z.enum(GAME_RESULT_STATUSES);

/**
 * Game mode values
 */
export const GAME_MODE_VALUES = ["daily", "archive", "practice"] as const;
export const GameModeSchema = z.enum(GAME_MODE_VALUES);
