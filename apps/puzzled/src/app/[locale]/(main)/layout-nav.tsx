import { TopNav } from '@/shared/components/layout'

/**
 * Top navigation streak is the same GetStreakInfo projection as home/stats.
 * Missing payloads stay hidden rather than fabricating a zero.
 */
export function LayoutTopNav({ currentStreak }: { currentStreak?: number | null }) {
	return <TopNav currentStreak={currentStreak ?? 0} />
}
