'use client'

import { useUser } from '@sylphx/platform-sdk/react'
import { TopNav } from '@/shared/components/layout'
import { trpc } from '@/trpc'

/**
 * Client component wrapper for TopNav that fetches streak data
 */
export function LayoutTopNav() {
	const { user } = useUser()

	// Only fetch streak info when user is authenticated
	const { data: streakInfo } = trpc.gamification.getStreakInfo.useQuery(undefined, {
		enabled: !!user, // Skip query when not logged in
		staleTime: 60 * 1000, // 1 minute
		retry: false, // Don't retry on auth failure
	})

	return <TopNav currentStreak={streakInfo?.currentStreak ?? 0} />
}
