'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

type TimeGreeting = 'morning' | 'afternoon' | 'evening' | 'night'

function greetingFromHour(hour: number): TimeGreeting {
	if (hour >= 5 && hour < 12) return 'morning'
	if (hour >= 12 && hour < 17) return 'afternoon'
	if (hour >= 17 && hour < 22) return 'evening'
	return 'night'
}

/**
 * Time-of-day greeting in the player's own clock.
 *
 * Renders the neutral greeting on the server so the first paint matches, then
 * swaps to the local time-of-day word after mount (no hydration mismatch).
 */
export function GreetingLine({ className }: { className?: string }) {
	const t = useTranslations('home')
	const [greeting, setGreeting] = useState<TimeGreeting | null>(null)

	useEffect(() => {
		setGreeting(greetingFromHour(new Date().getHours()))
	}, [])

	return (
		<span className={className} suppressHydrationWarning>
			{greeting ? t(`greeting.${greeting}`) : t('greeting.default')}
		</span>
	)
}
