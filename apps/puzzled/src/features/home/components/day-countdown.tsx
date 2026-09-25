'use client'

import { useEffect, useState } from 'react'
import { formatCountdown, msUntilNextProductDay } from '@/features/home/lib/day-boundary'
import { cn } from '@/lib/utils'

const timeLeft = () => formatCountdown(msUntilNextProductDay(new Date()))

/**
 * Time left until the next daily puzzles, ticking once a second.
 *
 * The server renders the time left at render time, so the first paint shows a
 * real countdown; the client corrects it on its first tick. The text differs
 * by the seconds between render and hydration, which `suppressHydrationWarning`
 * allows.
 */
export function DayCountdown({ className }: { className?: string }) {
	const [label, setLabel] = useState(timeLeft)

	useEffect(() => {
		const tick = () => setLabel(timeLeft())
		tick()
		const interval = setInterval(tick, 1000)
		return () => clearInterval(interval)
	}, [])

	return (
		<span className={cn('day-numeral tabular-nums', className)} suppressHydrationWarning>
			{label}
		</span>
	)
}
