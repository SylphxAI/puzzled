"use client";

import { NotificationPreferences } from "@/features/push";

/**
 * Client-side notification settings
 *
 * Wraps the push notification preferences component
 * for the settings page.
 */
export function NotificationsClient() {
	return (
		<NotificationPreferences
			variant="panel"
			onSave={(prefs) => {
				// Preferences are saved via the hook
				console.log("[NotificationsClient] Preferences saved:", prefs);
			}}
		/>
	);
}
