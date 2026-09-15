'use client'

import { Clock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

type NextPuzzleCountdownProps = {
	className?: string
	variant?: 'default' | 'compact' | 'card'
	showLabel?: boolean
}

/**
 * Milliseconds until the next product day (midnight in Asia/Hong_Kong).
 *
 * The daily set, the free rotation and the day key all flip on that boundary
 * (16:00 UTC), so a UTC-midnight countdown was eight hours out.
 */
const HKT_OFFSET_MS = 8 * 60 * 60 * 1000

function calculateTimeUntilNextProductDay() {
	const now = new Date()
	const hktNow = new Date(now.getTime() + HKT_OFFSET_MS)
	const nextProductDay = Date.UTC(
		hktNow.getUTCFullYear(),
		hktNow.getUTCMonth(),
		hktNow.getUTCDate() + 1,
	)
	const diff = nextProductDay - hktNow.getTime()

	return {
		hours: Math.floor(diff / (1000 * 60 * 60)),
		minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
		seconds: Math.floor((diff % (1000 * 60)) / 1000),
	}
}

export function NextPuzzleCountdown({
	className,
	variant = 'default',
	showLabel = true,
}: NextPuzzleCountdownProps) {
	const t = useTranslations('daily')
	const [timeLeft, setTimeLeft] = useState({
		hours: 0,
		minutes: 0,
		seconds: 0,
	})

	useEffect(() => {
		setTimeLeft(calculateTimeUntilNextProductDay())
		const interval = setInterval(() => {
			setTimeLeft(calculateTimeUntilNextProductDay())
		}, 1000)

		return () => clearInterval(interval)
	}, [])

	const pad = (n: number) => n.toString().padStart(2, '0')

	if (variant === 'compact') {
		return (
			<div className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
				<Clock className="h-3 w-3" />
				<span className="tabular-nums">
					{pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}
				</span>
			</div>
		)
	}

	if (variant === 'card') {
		return (
			<div className={cn('rounded-lg bg-muted/50 p-4 text-center', className)}>
				<div className="mb-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
					<Clock className="h-4 w-4" />
					<span>{t('nextPuzzle')}</span>
				</div>
				<div className="flex items-center justify-center gap-2">
					<TimeBlock value={timeLeft.hours} label={t('hours')} />
					<span className="text-2xl font-light text-muted-foreground">:</span>
					<TimeBlock value={timeLeft.minutes} label={t('minutes')} />
					<span className="text-2xl font-light text-muted-foreground">:</span>
					<TimeBlock value={timeLeft.seconds} label={t('seconds')} />
				</div>
			</div>
		)
	}

	// Default variant
	return (
		<div className={cn('flex flex-col items-center gap-1', className)}>
			{showLabel && (
				<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
					<Clock className="h-3 w-3" />
					<span>{t('nextPuzzle')}</span>
				</div>
			)}
			<div className="flex items-center gap-1 text-lg font-semibold tabular-nums">
				<span>{pad(timeLeft.hours)}</span>
				<span className="text-muted-foreground">:</span>
				<span>{pad(timeLeft.minutes)}</span>
				<span className="text-muted-foreground">:</span>
				<span>{pad(timeLeft.seconds)}</span>
			</div>
		</div>
	)
}

function TimeBlock({ value, label }: { value: number; label: string }) {
	return (
		<div className="flex flex-col items-center">
			<span className="text-3xl font-bold tabular-nums">{value.toString().padStart(2, '0')}</span>
			<span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
		</div>
	)
}
