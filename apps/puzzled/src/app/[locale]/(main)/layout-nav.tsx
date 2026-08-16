'use client'

import { TopNav } from '@/shared/components/layout'

/**
 * Client boundary for the server-derived streak value.
 *
 * The parent layout reads GamificationService through Connect; this component
 * only renders that value and never creates or updates streak state.
 */
export function LayoutTopNav({ currentStreak = 0 }: { currentStreak?: number }) {
	return <TopNav currentStreak={currentStreak} />
}
