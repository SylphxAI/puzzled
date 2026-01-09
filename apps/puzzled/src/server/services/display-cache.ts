/**
 * User Display Cache Service
 *
 * Manages caching of user display data (names, avatars) from the platform.
 * Uses local database cache + background refresh via platform batch API.
 *
 * ARCHITECTURE:
 * - Primary source: Local userDisplayCache table (fast)
 * - Refresh source: Platform batch API (authoritative)
 * - Cache TTL: 1 hour (configurable)
 * - Refresh: Non-blocking background updates
 */

import { inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { userDisplayCache, type UserDisplayCache } from '@/lib/db/schema'
import { createServerClient } from '@sylphx/platform-sdk/server'

/** Cache TTL in milliseconds (1 hour) */
const CACHE_TTL_MS = 60 * 60 * 1000

/** Display data returned by this service */
export interface DisplayData {
	displayName: string | null
	avatarUrl: string | null
}

/**
 * Get display data for multiple user IDs.
 * Returns cached data immediately, refreshes stale entries in background.
 *
 * @param userIds - Array of platform user IDs
 * @returns Record mapping userId to display data
 */
export async function getDisplayData(
	userIds: string[],
): Promise<Record<string, DisplayData | null>> {
	if (userIds.length === 0) {
		return {}
	}

	// Dedupe user IDs
	const uniqueIds = [...new Set(userIds)]

	// Check local cache
	const cached = await db
		.select()
		.from(userDisplayCache)
		.where(inArray(userDisplayCache.userId, uniqueIds))

	const cacheMap = new Map<string, UserDisplayCache>()
	for (const entry of cached) {
		cacheMap.set(entry.userId, entry)
	}

	const now = Date.now()
	const staleThreshold = now - CACHE_TTL_MS

	// Find stale or missing entries
	const needsRefresh = uniqueIds.filter((id) => {
		const entry = cacheMap.get(id)
		return !entry || entry.cachedAt.getTime() < staleThreshold
	})

	// Trigger background refresh for stale entries (non-blocking)
	if (needsRefresh.length > 0) {
		refreshDisplayCache(needsRefresh).catch((error) => {
			console.error('[DisplayCache] Background refresh failed:', error)
		})
	}

	// Return current cache data (may be stale, but that's OK for display)
	const result: Record<string, DisplayData | null> = {}
	for (const id of uniqueIds) {
		const entry = cacheMap.get(id)
		result[id] = entry
			? {
					displayName: entry.displayName,
					avatarUrl: entry.avatarUrl,
				}
			: null
	}

	return result
}

/**
 * Get display data for a single user.
 * Convenience wrapper around getDisplayData.
 */
export async function getDisplayDataSingle(userId: string): Promise<DisplayData | null> {
	const data = await getDisplayData([userId])
	return data[userId] ?? null
}

/**
 * Refresh display cache entries from platform batch API.
 * Called in background - don't await in request path.
 *
 * @param userIds - User IDs to refresh
 */
export async function refreshDisplayCache(userIds: string[]): Promise<void> {
	if (userIds.length === 0) return

	const appId = process.env.SYLPHX_APP_ID
	const secretKey = process.env.SYLPHX_APP_SECRET
	const platformUrl = process.env.SYLPHX_PLATFORM_URL

	if (!appId || !secretKey) {
		console.warn('[DisplayCache] Missing platform credentials, skipping refresh')
		return
	}

	try {
		const client = createServerClient({
			appId,
			secretKey,
			platformUrl,
		})

		const { users } = await client.users.getBatch(userIds)

		// Upsert cache entries
		const now = new Date()
		for (const [userId, data] of Object.entries(users)) {
			await db
				.insert(userDisplayCache)
				.values({
					userId,
					displayName: data.name,
					avatarUrl: data.image,
					cachedAt: now,
				})
				.onConflictDoUpdate({
					target: userDisplayCache.userId,
					set: {
						displayName: data.name,
						avatarUrl: data.image,
						cachedAt: now,
					},
				})
		}

		console.log(`[DisplayCache] Refreshed ${Object.keys(users).length} entries`)
	} catch (error) {
		console.error('[DisplayCache] Failed to refresh from platform:', error)
		throw error
	}
}

/**
 * Invalidate cache for a specific user.
 * Call this when you know user data has changed (e.g., webhook).
 */
export async function invalidateDisplayCache(userId: string): Promise<void> {
	await db.delete(userDisplayCache).where(inArray(userDisplayCache.userId, [userId]))
}

/**
 * Pre-warm cache for a list of users.
 * Useful for batch operations where you know you'll need the data.
 */
export async function prewarmDisplayCache(userIds: string[]): Promise<void> {
	if (userIds.length === 0) return

	// Trigger immediate refresh (blocking)
	await refreshDisplayCache(userIds)
}
