/**
 * Audit Logging System
 *
 * Provides audit logging for app-specific privileged actions.
 *
 * ARCHITECTURE:
 * - Auth/billing audit events are handled by platform
 * - This file only handles app-specific audit events (games, achievements, etc.)
 */

import { headers } from 'next/headers'
import type { AuditAction, NewAuditLog } from '@/lib/db/schema'

/**
 * Log an audit event
 */
async function logAuditEvent(
	params: Omit<NewAuditLog, 'id' | 'createdAt' | 'ipAddress' | 'userAgent'>,
): Promise<void> {
	try {
		const { db } = await import('@/lib/db')
		const { auditLogs } = await import('@/lib/db/schema')
		const headersList = await headers()

		const ipAddress =
			headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
			headersList.get('x-real-ip') ||
			'unknown'
		const userAgent = headersList.get('user-agent') || 'unknown'

		await db.insert(auditLogs).values({
			...params,
			ipAddress,
			userAgent,
		})
	} catch (error) {
		console.error('[Audit] Failed to log event:', error, params)
	}
}

/**
 * Log admin action (generic)
 */
export async function logAdminAction(
	actorId: string,
	action: AuditAction,
	resourceType: string,
	resourceId?: string,
	metadata?: Record<string, unknown>,
): Promise<void> {
	await logAuditEvent({
		actorId,
		action,
		resourceType,
		resourceId,
		metadata,
	})
}

/**
 * Log user action (self-initiated)
 */
async function _logUserAction(
	userId: string,
	action: AuditAction,
	resourceType: string,
	resourceId?: string,
	metadata?: Record<string, unknown>,
): Promise<void> {
	await logAuditEvent({
		userId,
		action,
		resourceType,
		resourceId,
		metadata,
	})
}

/**
 * Log game completion
 */
async function _logGameComplete(
	userId: string,
	gameSlug: string,
	sessionId: string,
	metadata?: Record<string, unknown>,
): Promise<void> {
	await logAuditEvent({
		userId,
		action: 'game_complete',
		resourceType: 'game_session',
		resourceId: sessionId,
		metadata: { gameSlug, ...metadata },
	})
}

/**
 * Log streak update
 */
async function _logStreakUpdate(
	userId: string,
	gameSlug: string,
	streak: number,
	metadata?: Record<string, unknown>,
): Promise<void> {
	await logAuditEvent({
		userId,
		action: 'streak_update',
		resourceType: 'user_stats',
		resourceId: gameSlug,
		metadata: { streak, ...metadata },
	})
}

/**
 * Log achievement unlock
 */
async function _logAchievementUnlock(
	userId: string,
	achievementSlug: string,
	metadata?: Record<string, unknown>,
): Promise<void> {
	await logAuditEvent({
		userId,
		action: 'achievement_unlock',
		resourceType: 'achievement',
		resourceId: achievementSlug,
		metadata,
	})
}
