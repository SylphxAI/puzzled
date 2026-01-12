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

export { usePush, PushPrompt, NotificationBell } from '@sylphx/platform-sdk/react'

// Re-export with Puzzled-specific types
export { usePuzzledPush, type PuzzledNotification } from './hooks/use-puzzled-push'
export { DailyReminderPrompt } from './components/daily-reminder-prompt'
export { NotificationPreferences } from './components/notification-preferences'
