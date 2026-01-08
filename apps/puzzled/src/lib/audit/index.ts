/**
 * Audit Logging System
 *
 * Provides comprehensive audit logging for all privileged actions.
 * All admin operations MUST be logged through this system.
 */

import { headers } from 'next/headers'
import type { AuditAction, NewAuditLog } from '@/lib/db/schema'

/**
 * Log an audit event
 *
 * @param params - Audit log parameters
 * @returns The created audit log entry
 */
export async function logAuditEvent(
	params: Omit<NewAuditLog, 'id' | 'createdAt' | 'ipAddress' | 'userAgent'>,
): Promise<void> {
	try {
		// Dynamically import to avoid build-time issues
		const { db } = await import('@/lib/db')
		const { auditLogs } = await import('@/lib/db/schema')
		const headersList = await headers()

		// Extract request metadata
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
		// Log to console but don't throw - audit logging should not break the request
		console.error('[Audit] Failed to log event:', error, params)
	}
}

/**
 * Log admin action
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
export async function logUserAction(
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
 * Log role change
 */
export async function logRoleChange(
	actorId: string,
	targetUserId: string,
	oldRole: string,
	newRole: string,
): Promise<void> {
	await logAuditEvent({
		actorId,
		userId: targetUserId,
		action: 'role_change',
		resourceType: 'user',
		resourceId: targetUserId,
		metadata: { oldRole, newRole },
	})
}

/**
 * Log subscription change
 */
export async function logSubscriptionChange(
	userId: string,
	_action: 'create' | 'update' | 'delete',
	subscriptionId: string,
	metadata?: Record<string, unknown>,
): Promise<void> {
	await logAuditEvent({
		userId,
		action: 'subscription_change',
		resourceType: 'subscription',
		resourceId: subscriptionId,
		metadata,
	})
}

/**
 * Log authentication event
 */
export async function logAuthEvent(
	userId: string,
	action: 'login' | 'logout',
	metadata?: Record<string, unknown>,
): Promise<void> {
	await logAuditEvent({
		userId,
		action,
		resourceType: 'session',
		metadata,
	})
}

/**
 * Log impersonation start
 */
export async function logImpersonationStart(actorId: string, targetUserId: string): Promise<void> {
	await logAuditEvent({
		actorId,
		userId: targetUserId,
		action: 'impersonate_start',
		resourceType: 'user',
		resourceId: targetUserId,
	})
}

/**
 * Log impersonation end
 */
export async function logImpersonationEnd(actorId: string, targetUserId: string): Promise<void> {
	await logAuditEvent({
		actorId,
		userId: targetUserId,
		action: 'impersonate_end',
		resourceType: 'user',
		resourceId: targetUserId,
	})
}

/**
 * Log feature flag toggle
 */
export async function logFeatureFlagToggle(
	actorId: string,
	flagName: string,
	enabled: boolean,
): Promise<void> {
	await logAuditEvent({
		actorId,
		action: 'feature_flag_toggle',
		resourceType: 'feature_flag',
		resourceId: flagName,
		metadata: { enabled },
	})
}
