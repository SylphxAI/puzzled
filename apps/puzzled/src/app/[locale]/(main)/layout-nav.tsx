'use client'

import { useSafeUser, useStreak } from '@sylphx/sdk/react'
import { TopNav } from '@/shared/components/layout'

/**
 * Client component wrapper for TopNav that fetches streak data
 *
 * Uses SDK's useStreak hook for Platform-managed streak tracking.
 * Gracefully handles when Sylphx Platform is not configured.
 */
export function LayoutTopNav() {
	const { user } = useSafeUser()

	// Use SDK's useStreak hook for Platform-managed streaks
	// The streak is auto-discovered with these defaults if it doesn't exist
	const { current, isLoading } = useStreak('daily-play', {
		defaults: {
			name: 'Daily Play Streak',
			description: 'Play at least one game daily to maintain your streak',
			frequency: 'daily',
			gracePeriodHours: 12, // 12-hour grace period
		},
	})

	// Show streak only when user is authenticated and data is loaded
	const displayStreak = user && !isLoading ? current : 0

	return <TopNav currentStreak={displayStreak} />
}
