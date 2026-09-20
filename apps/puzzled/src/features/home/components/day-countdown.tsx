'use client'

import { useEffect, useState } from 'react'
import { formatCountdown, msUntilNextProductDay } from '@/features/home/lib/day-boundary'
import { cn } from '@/lib/utils'

/**
 * Time left in the product day, ticking once a second.
 *
 * The server renders the placeholder and the first client tick fills it in, so
 * the markup never depends on the host clock and there is no hydration
 * mismatch. It is a clock, not copy: nothing here is a claim the server owes.
 */
export function DayCountdown({ className }: { className?: string }) {
	const [label, setLabel] = useState<string | null>(null)

	useEffect(() => {
		const tick = () => setLabel(formatCountdown(msUntilNextProductDay(new Date())))
		tick()
		const interval = setInterval(tick, 1000)
		return () => clearInterval(interval)
	}, [])

	return (
		<span className={cn('day-numeral tabular-nums', className)} suppressHydrationWarning>
			{label ?? '--:--:--'}
		</span>
	)
}
