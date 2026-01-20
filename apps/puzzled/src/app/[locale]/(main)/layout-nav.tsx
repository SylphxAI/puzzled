'use client'

import { useSafeUser } from '@sylphx/sdk/react'
import { TopNav } from '@/shared/components/layout'
import { trpc } from '@/trpc'

/**
 * Client component wrapper for TopNav that fetches streak data
 *
 * Gracefully handles when Sylphx Platform is not configured.
 */
export function LayoutTopNav() {
	const { user } = useSafeUser()

	// Only fetch streak info when user is authenticated
	const { data: streakInfo } = trpc.gamification.getStreakInfo.useQuery(undefined, {
		enabled: !!user, // Skip query when not logged in
		staleTime: 60 * 1000, // 1 minute
		retry: false, // Don't retry on auth failure
	})

	return <TopNav currentStreak={streakInfo?.currentStreak ?? 0} />
}
