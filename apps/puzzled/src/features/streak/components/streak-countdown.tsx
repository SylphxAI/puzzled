'use client'

import { AlertTriangle, Clock, Flame, Snowflake, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Link } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'
import { Icon } from '@/shared/components/ui'

type UrgencyLevel = 'normal' | 'elevated' | 'critical' | 'emergency'

type StreakCountdownProps = {
	currentStreak: number
	hasPlayedToday: boolean
	freezesAvailable?: number
	onUseFreeze?: () => void
	game?: string
	resetTime?: Date // UTC midnight of next day
}

function getUrgencyLevel(hoursLeft: number, streak: number): UrgencyLevel {
	if (hoursLeft <= 1 && streak >= 100) return 'emergency'
	if (hoursLeft <= 2 && streak >= 30) return 'critical'
	if (hoursLeft <= 4 && streak >= 7) return 'elevated'
	return 'normal'
}

function formatTimeRemaining(ms: number): string {
	const hours = Math.floor(ms / (1000 * 60 * 60))
	const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
	const seconds = Math.floor((ms % (1000 * 60)) / 1000)

	if (hours > 0) {
		return `${hours}h ${minutes}m`
	}
	if (minutes > 0) {
		return `${minutes}m ${seconds}s`
	}
	return `${seconds}s`
}

export function StreakCountdown({
	currentStreak,
	hasPlayedToday,
	freezesAvailable = 0,
	onUseFreeze,
	game,
	resetTime,
}: StreakCountdownProps) {
	const t = useTranslations('streak')
	const [dismissed, setDismissed] = useState(false)
	const [timeRemaining, setTimeRemaining] = useState<number | null>(null)

	// Calculate reset time (next UTC midnight)
	const targetTime = resetTime || getNextMidnightUTC()

	useEffect(() => {
		if (hasPlayedToday || currentStreak === 0) return

		const updateTimer = () => {
			const now = Date.now()
			const target = targetTime.getTime()
			const remaining = target - now
			setTimeRemaining(remaining > 0 ? remaining : 0)
		}

		updateTimer()
		const interval = setInterval(updateTimer, 1000)
		return () => clearInterval(interval)
	}, [hasPlayedToday, currentStreak, targetTime])

	if (currentStreak === 0 || hasPlayedToday || dismissed) {
		return null
	}

	const hoursLeft = timeRemaining ? timeRemaining / (1000 * 60 * 60) : 24
	const urgency = getUrgencyLevel(hoursLeft, currentStreak)

	const urgencyStyles = {
		normal: {
			container: 'bg-yellow-500/10 border-yellow-500/20',
			icon: 'bg-yellow-500/15',
			iconColor: 'text-yellow-500',
			button: 'bg-yellow-500 hover:bg-yellow-600',
		},
		elevated: {
			container: 'bg-orange-500/10 border-orange-500/20',
			icon: 'bg-orange-500/15',
			iconColor: 'text-orange-500',
			button: 'bg-orange-500 hover:bg-orange-600',
		},
		critical: {
			container: 'bg-gradient-to-r from-orange-500/20 to-red-500/20 border-orange-500/30',
			icon: 'bg-red-500/20',
			iconColor: 'text-red-500',
			button: 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600',
		},
		emergency: {
			container: 'bg-gradient-to-r from-red-500/20 to-red-600/20 border-red-500/40 animate-pulse',
			icon: 'bg-red-500/25',
			iconColor: 'text-red-500',
			button: 'bg-red-500 hover:bg-red-600 animate-pulse',
		},
	}

	const styles = urgencyStyles[urgency]

	const getMessage = () => {
		if (urgency === 'emergency') {
			return t('emergency', {
				streak: currentStreak,
				time: formatTimeRemaining(timeRemaining || 0),
			})
		}
		if (urgency === 'critical') {
			return t('critical', { streak: currentStreak, time: formatTimeRemaining(timeRemaining || 0) })
		}
		if (urgency === 'elevated') {
			return t('elevated', { streak: currentStreak, time: formatTimeRemaining(timeRemaining || 0) })
		}
		return t('playToMaintain', { streak: currentStreak })
	}

	return (
		<div className={cn('relative flex items-center gap-3 rounded-xl border p-4', styles.container)}>
			<button
				type="button"
				onClick={() => setDismissed(true)}
				className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
				aria-label={t('dismiss')}
			>
				<X className="h-3 w-3" />
			</button>

			<div
				className={cn(
					'flex h-12 w-12 shrink-0 items-center justify-center rounded-full',
					styles.icon,
				)}
			>
				{urgency === 'emergency' || urgency === 'critical' ? (
					<AlertTriangle className={cn('h-6 w-6', styles.iconColor)} />
				) : (
					<Flame className={cn('h-6 w-6', styles.iconColor)} />
				)}
			</div>

			<div className="min-w-0 flex-1 pr-6">
				<div className="flex items-center gap-2">
					<p className="flex items-center gap-1.5 font-semibold">
						<Icon
							icon={
								urgency === 'emergency'
									? 'mdi:alert-circle'
									: urgency === 'critical'
										? 'mdi:alert'
										: 'mdi:fire'
							}
							aria-hidden="true"
							className={cn(
								'h-4 w-4',
								urgency === 'emergency'
									? 'text-red-500'
									: urgency === 'critical'
										? 'text-orange-500'
										: 'text-orange-500',
							)}
						/>
						{t(
							urgency === 'emergency'
								? 'emergencyTitle'
								: urgency === 'critical'
									? 'criticalTitle'
									: 'streakAtRisk',
						)}
					</p>
					{timeRemaining !== null && (
						<span
							className={cn(
								'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
								urgency === 'emergency' || urgency === 'critical'
									? 'bg-red-500/20 text-red-600'
									: 'bg-muted text-muted-foreground',
							)}
						>
							<Clock className="h-3 w-3" />
							{formatTimeRemaining(timeRemaining)}
						</span>
					)}
				</div>
				<p className="mt-0.5 text-sm text-muted-foreground">{getMessage()}</p>
			</div>

			<div className="flex shrink-0 items-center gap-2">
				{freezesAvailable > 0 && onUseFreeze && (
					<button
						type="button"
						onClick={onUseFreeze}
						className="flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-500/20"
						title={t('useFreeze')}
					>
						<Snowflake className="h-4 w-4" />
						<span className="hidden sm:inline">{freezesAvailable}</span>
					</button>
				)}
				<Link
					href={game ? `/games/${game}` : '/games'}
					className={cn(
						'rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors',
						styles.button,
					)}
				>
					{t('playNow')}
				</Link>
			</div>
		</div>
	)
}

function getNextMidnightUTC(): Date {
	const now = new Date()
	const tomorrow = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0),
	)
	return tomorrow
}

// Compact streak badge with mini countdown
export function StreakBadgeWithTimer({
	streak,
	hasPlayedToday,
	freezesAvailable = 0,
}: {
	streak: number
	hasPlayedToday: boolean
	freezesAvailable?: number
}) {
	const [timeRemaining, setTimeRemaining] = useState<string>('')

	useEffect(() => {
		if (hasPlayedToday || streak === 0) return

		const updateTimer = () => {
			const now = new Date()
			const tomorrow = getNextMidnightUTC()
			const diff = tomorrow.getTime() - now.getTime()
			if (diff > 0) {
				const hours = Math.floor(diff / (1000 * 60 * 60))
				setTimeRemaining(`${hours}h`)
			}
		}

		updateTimer()
		const interval = setInterval(updateTimer, 60000) // Update every minute
		return () => clearInterval(interval)
	}, [hasPlayedToday, streak])

	if (streak === 0) return null

	return (
		<div
			className={cn(
				'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
				hasPlayedToday ? 'bg-green-500/10 text-green-600' : 'bg-orange-500/10 text-orange-600',
			)}
		>
			<Flame className="h-3 w-3" />
			<span>{streak}</span>
			{!hasPlayedToday && timeRemaining && (
				<>
					<span className="text-muted-foreground">·</span>
					<span className="text-xs">{timeRemaining}</span>
				</>
			)}
			{freezesAvailable > 0 && (
				<span title={`${freezesAvailable} freezes`}>
					<Snowflake className="ml-0.5 h-2.5 w-2.5 text-blue-500" />
				</span>
			)}
		</div>
	)
}
