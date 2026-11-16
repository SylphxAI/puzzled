import { TopNav } from '@/shared/components/layout'
import type { InitialNavUser } from '@/shared/components/layout/user-menu'

/**
 * Top navigation streak is the same GetStreakInfo projection as home/stats.
 * Missing payloads stay hidden rather than fabricating a zero.
 */
export function LayoutTopNav({
	currentStreak,
	initialUser,
}: {
	currentStreak?: number | null
	initialUser?: InitialNavUser | null
}) {
	return <TopNav currentStreak={currentStreak ?? 0} initialUser={initialUser} />
}
