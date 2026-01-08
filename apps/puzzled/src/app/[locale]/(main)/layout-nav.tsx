'use client'

import { useSession } from '@/features/auth'
import { TopNav } from '@/shared/components/layout'
import { trpc } from '@/trpc'

/**
 * Client component wrapper for TopNav that fetches streak data
 */
export function LayoutTopNav() {
	const { data: session } = useSession()

	// Only fetch streak info when user is authenticated
	const { data: streakInfo } = trpc.gamification.getStreakInfo.useQuery(undefined, {
		enabled: !!session?.user, // Skip query when not logged in
		staleTime: 60 * 1000, // 1 minute
		retry: false, // Don't retry on auth failure
	})

	return <TopNav currentStreak={streakInfo?.currentStreak ?? 0} />
}
