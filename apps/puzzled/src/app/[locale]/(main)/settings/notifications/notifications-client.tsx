'use client'

import { NotificationPreferences } from '@/features/push'

/**
 * Push and email preferences.
 *
 * The panel owns its own save flow; this surface only gives it a home inside
 * the settings frame.
 */
export function NotificationsClient() {
	return <NotificationPreferences variant="panel" />
}
