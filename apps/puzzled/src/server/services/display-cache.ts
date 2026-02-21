/**
 * User Display Cache Service
 *
 * Manages caching of user display data (names, avatars) from the platform.
 * Uses local database cache populated via webhooks from the platform.
 *
 * ARCHITECTURE:
 * - Primary source: Local userDisplayCache table (SSOT for app-local display data)
 * - Population: Platform webhooks (user.created, user.updated)
 * - Cache TTL: 1 hour (for staleness checking only)
 *
 * Note: The platform SDK is for current-user operations. For bulk user data,
 * use platform webhooks to keep the local cache in sync.
 */

import { HOUR_MS } from "@/lib/constants/time";
import { db } from "@/lib/db";
import { type UserDisplayCache, userDisplayCache } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

/** Cache TTL in milliseconds (1 hour) - used for staleness warnings only */
const CACHE_TTL_MS = HOUR_MS;

/** Display data returned by this service */
export interface DisplayData {
	email: string | null;
	displayName: string | null;
	avatarUrl: string | null;
}

/**
 * Get display data for multiple user IDs.
 * Returns cached data from local database.
 *
 * @param userIds - Array of platform user IDs
 * @returns Record mapping userId to display data
 */
export async function getDisplayData(
	userIds: string[],
): Promise<Record<string, DisplayData | null>> {
	if (userIds.length === 0) {
		return {};
	}

	// Dedupe user IDs
	const uniqueIds = [...new Set(userIds)];

	// Check local cache
	const cached = await db
		.select()
		.from(userDisplayCache)
		.where(inArray(userDisplayCache.userId, uniqueIds));

	const cacheMap = new Map<string, UserDisplayCache>();
	for (const entry of cached) {
		cacheMap.set(entry.userId, entry);
	}

	const now = Date.now();
	const staleThreshold = now - CACHE_TTL_MS;

	// Log stale entries (for monitoring)
	const staleCount = uniqueIds.filter((id) => {
		const entry = cacheMap.get(id);
		return entry && entry.cachedAt.getTime() < staleThreshold;
	}).length;

	if (staleCount > 0) {
		console.debug(`[DisplayCache] ${staleCount} stale entries detected`);
	}

	// Return current cache data
	const result: Record<string, DisplayData | null> = {};
	for (const id of uniqueIds) {
		const entry = cacheMap.get(id);
		result[id] = entry
			? {
					email: entry.email,
					displayName: entry.displayName,
					avatarUrl: entry.avatarUrl,
				}
			: null;
	}

	return result;
}

/**
 * Get display data for a single user.
 * Convenience wrapper around getDisplayData.
 */
async function _getDisplayDataSingle(
	userId: string,
): Promise<DisplayData | null> {
	const data = await getDisplayData([userId]);
	return data[userId] ?? null;
}

/**
 * Update display cache for a user.
 * Called from platform webhooks (user.created, user.updated).
 *
 * @param userId - Platform user ID
 * @param data - Display data to cache
 */
async function _updateDisplayCache(
	userId: string,
	data: {
		email?: string | null;
		displayName?: string | null;
		avatarUrl?: string | null;
	},
): Promise<void> {
	const now = new Date();

	await db
		.insert(userDisplayCache)
		.values({
			userId,
			email: data.email ?? null,
			displayName: data.displayName ?? null,
			avatarUrl: data.avatarUrl ?? null,
			cachedAt: now,
		})
		.onConflictDoUpdate({
			target: userDisplayCache.userId,
			set: {
				email: data.email ?? null,
				displayName: data.displayName ?? null,
				avatarUrl: data.avatarUrl ?? null,
				cachedAt: now,
			},
		});
}

/**
 * Invalidate cache for a specific user.
 * Call this when you know user data has changed.
 */
async function _invalidateDisplayCache(userId: string): Promise<void> {
	await db.delete(userDisplayCache).where(eq(userDisplayCache.userId, userId));
}

/**
 * Batch update display cache.
 * Used for initial sync or bulk operations.
 *
 * @param users - Array of user data to cache
 */
async function _batchUpdateDisplayCache(
	users: Array<{
		userId: string;
		email?: string | null;
		displayName?: string | null;
		avatarUrl?: string | null;
	}>,
): Promise<void> {
	if (users.length === 0) return;

	const now = new Date();

	// Use individual upserts for now (Drizzle doesn't have bulk upsert)
	for (const user of users) {
		await db
			.insert(userDisplayCache)
			.values({
				userId: user.userId,
				email: user.email ?? null,
				displayName: user.displayName ?? null,
				avatarUrl: user.avatarUrl ?? null,
				cachedAt: now,
			})
			.onConflictDoUpdate({
				target: userDisplayCache.userId,
				set: {
					email: user.email ?? null,
					displayName: user.displayName ?? null,
					avatarUrl: user.avatarUrl ?? null,
					cachedAt: now,
				},
			});
	}

	console.log(`[DisplayCache] Updated ${users.length} entries`);
}
