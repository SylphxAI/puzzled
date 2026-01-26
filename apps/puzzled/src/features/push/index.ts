/**
 * Push Notifications for Puzzled
 *
 * Uses the Sylphx Platform SDK's push notification system.
 * Enables daily puzzle reminders and achievement notifications.
 *
 * Usage:
 * ```tsx
 * import { usePuzzledPush, DailyReminderPrompt } from '@/features/push'
 *
 * function App() {
 *   const { isEnabled, requestPermission } = usePuzzledPush()
 *   return <DailyReminderPrompt />
 * }
 * ```
 */

'use client'



// Re-export with Puzzled-specific types


export { NotificationPreferences } from './components/notification-preferences'
