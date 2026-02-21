/**
 * Gamification Routes
 *
 * Streaks, achievements, and daily progress endpoints.
 *
 * ARCHITECTURE (State of the Art):
 * - Streak tracking: Platform SDK useStreak() via server functions
 * - Freeze feature: App-specific premium perk in userFreezeData table
 * - Stats: Computed from gameSessions (no separate aggregation table)
 *
 * NOTE: Uses method chaining for proper hc type inference.
 */

import { getTodayUTC } from "@/features/daily/server";
import { getAllGames, getGameConfig } from "@/games/registry";
import { db } from "@/lib/db";
import { gameSessions, userFreezeData } from "@/lib/db/schema";
import { OpenAPIHono, z } from "@hono/zod-openapi";
import { and, countDistinct, eq, gte, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import {
	adminMiddleware,
	authMiddleware,
	authRateLimitMiddleware,
} from "../middleware";
import type { PuzzledAuthEnv } from "../types";

// ==========================================
// Schemas
// ==========================================

const ToggleAutoFreezeBodySchema = z.object({
	enabled: z.boolean(),
});

const AddStreakFreezesBodySchema = z.object({
	userId: z.string().uuid(),
	count: z.number().min(1).max(10),
	reason: z.enum([
		"referral",
		"purchase",
		"promotion",
		"manual",
		"premium_perk",
	]),
});

// ==========================================
// Router (Method Chaining for hc type inference)
// ==========================================

const gamificationRoutes = new OpenAPIHono<PuzzledAuthEnv>()
	// GET /streak-info - authenticated
	// Combines Platform SDK streak + local freeze data
	.get("/streak-info", authMiddleware, async (c) => {
		const user = c.get("user");
		const todayUTC = getTodayUTC();

		// Compute stats directly from gameSessions (no separate aggregation table)
		const [statsResult] = await db
			.select({
				totalGamesPlayed: sql<number>`COUNT(*)::int`,
				totalGamesWon: sql<number>`SUM(CASE WHEN ${gameSessions.status} = 'won' THEN 1 ELSE 0 END)::int`,
				todayGamesPlayed: sql<number>`SUM(CASE WHEN ${gameSessions.completedAt} >= ${todayUTC} THEN 1 ELSE 0 END)::int`,
			})
			.from(gameSessions)
			.where(eq(gameSessions.userId, user.id));

		const hasPlayedToday = (statsResult?.todayGamesPlayed ?? 0) > 0;
		const totalGamesPlayed = statsResult?.totalGamesPlayed ?? 0;

		// Get freeze data (app-specific premium feature)
		const freezeData = await db.query.userFreezeData.findFirst({
			where: eq(userFreezeData.userId, user.id),
		});

		// NOTE: Current streak and max streak should come from Platform SDK useStreak()
		// on the client side. The server returns 0 here as placeholder.
		// Client uses: const { current, longest } = useStreak('puzzled-daily')

		return c.json({
			// Streak data - client should use Platform SDK useStreak() for real values
			currentStreak: 0, // Platform SDK handles this
			maxStreak: 0, // Platform SDK handles this
			hasPlayedToday,
			totalGamesPlayed,
			// Freeze data - app-specific premium feature
			freezesAvailable: freezeData?.freezesAvailable ?? 0,
			autoFreezeEnabled: freezeData?.autoFreezeEnabled ?? false,
		});
	})

	// GET /today-player-count - public (no auth needed)
	.get("/today-player-count", async (c) => {
		const todayUTC = getTodayUTC();

		const result = await db
			.select({ count: countDistinct(gameSessions.userId) })
			.from(gameSessions)
			.where(gte(gameSessions.completedAt, todayUTC));

		return c.json({ count: result[0]?.count ?? 0 });
	})

	// GET /today-completions - authenticated
	.get("/today-completions", authMiddleware, async (c) => {
		const user = c.get("user");

		const allGames = getAllGames();
		const todayUTC = getTodayUTC();

		const todaySessions = await db
			.select({
				gameSlug: gameSessions.gameSlug,
				score: gameSessions.score,
				attempts: gameSessions.attempts,
				status: gameSessions.status,
			})
			.from(gameSessions)
			.where(
				and(
					eq(gameSessions.userId, user.id),
					gte(gameSessions.completedAt, todayUTC),
				),
			);

		const result = allGames.map((game) => {
			const session = todaySessions.find((s) => s.gameSlug === game.slug);
			let score: string | undefined;

			if (session) {
				const config = getGameConfig(game.slug);
				if (config?.formatScoreDisplay) {
					score = config.formatScoreDisplay({
						status: session.status as "won" | "lost",
						attempts: session.attempts ?? undefined,
						score: session.score ?? undefined,
						timeSpentMs: undefined,
					});
				}
			}

			return {
				slug: game.slug,
				name: game.name,
				completed: !!session,
				score,
			};
		});

		return c.json(result);
	})

	// POST /toggle-auto-freeze - authenticated + rate limited
	// Uses new userFreezeData table (app-specific premium feature)
	.post("/toggle-auto-freeze", authRateLimitMiddleware, async (c) => {
		const body = await c.req.json();
		const parsed = ToggleAutoFreezeBodySchema.safeParse(body);
		if (!parsed.success) {
			throw new HTTPException(400, { message: "Invalid request body" });
		}
		const { enabled } = parsed.data;
		const user = c.get("user");
		const now = new Date();

		const existing = await db.query.userFreezeData.findFirst({
			where: eq(userFreezeData.userId, user.id),
		});

		if (existing) {
			await db
				.update(userFreezeData)
				.set({
					autoFreezeEnabled: enabled,
					updatedAt: now,
				})
				.where(eq(userFreezeData.id, existing.id));
		} else {
			await db.insert(userFreezeData).values({
				userId: user.id,
				freezesAvailable: 0,
				freezesUsed: 0,
				autoFreezeEnabled: enabled,
			});
		}

		return c.json({ success: true, autoFreezeEnabled: enabled });
	})

	// POST /add-streak-freezes - admin only
	// Uses new userFreezeData table (app-specific premium feature)
	.post("/add-streak-freezes", adminMiddleware, async (c) => {
		const body = await c.req.json();
		const parsed = AddStreakFreezesBodySchema.safeParse(body);
		if (!parsed.success) {
			throw new HTTPException(400, { message: "Invalid request body" });
		}
		const input = parsed.data;
		const now = new Date();

		const existing = await db.query.userFreezeData.findFirst({
			where: eq(userFreezeData.userId, input.userId),
		});

		if (existing) {
			const newCount = existing.freezesAvailable + input.count;
			await db
				.update(userFreezeData)
				.set({
					freezesAvailable: newCount,
					updatedAt: now,
				})
				.where(eq(userFreezeData.id, existing.id));

			return c.json({
				success: true,
				freezesAvailable: newCount,
				reason: input.reason,
			});
		}

		await db.insert(userFreezeData).values({
			userId: input.userId,
			freezesAvailable: input.count,
			freezesUsed: 0,
			autoFreezeEnabled: false,
		});

		return c.json({
			success: true,
			freezesAvailable: input.count,
			reason: input.reason,
		});
	});

export { gamificationRoutes };
export type GamificationRoutes = typeof gamificationRoutes;
