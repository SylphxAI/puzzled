'use client'

import { Flame, Snowflake } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Icon } from '@sylphx/ui'

// Streak milestones for progression
const MILESTONES = [7, 30, 100, 365] as const

type StreakBarProps = {
	currentStreak: number
	bestStreak?: number
	freezesAvailable?: number
	className?: string
	variant?: 'default' | 'compact' | 'detailed'
	showMilestone?: boolean
}

/**
 * Get the next milestone for a given streak
 */
function getNextMilestone(streak: number): number {
	for (const milestone of MILESTONES) {
		if (streak < milestone) return milestone
	}
	return MILESTONES[MILESTONES.length - 1]
}

/**
 * Get milestone tier name for display
 */
function getMilestoneTier(streak: number): 'starter' | 'bronze' | 'silver' | 'gold' | 'legendary' {
	if (streak >= 365) return 'legendary'
	if (streak >= 100) return 'gold'
	if (streak >= 30) return 'silver'
	if (streak >= 7) return 'bronze'
	return 'starter'
}

/**
 * StreakBar - Displays user's streak with visual progress toward next milestone
 *
 * Features:
 * - Animated fire icon with pulsing glow
 * - Progress bar showing distance to next milestone
 * - Color coding based on tier (bronze, silver, gold, legendary)
 */
export function StreakBar({
	currentStreak,
	bestStreak,
	freezesAvailable = 0,
	className,
	variant = 'default',
	showMilestone = true,
}: StreakBarProps) {
	const t = useTranslations('streak')

	const nextMilestone = getNextMilestone(currentStreak)
	const previousMilestone = MILESTONES.find((m) => m <= currentStreak) || 0
	const progress =
		previousMilestone === nextMilestone
			? 100
			: ((currentStreak - previousMilestone) / (nextMilestone - previousMilestone)) * 100
	const daysToGo = nextMilestone - currentStreak
	const tier = getMilestoneTier(currentStreak)

	// Tier-based styling
	const tierStyles = {
		starter: {
			text: 'text-muted-foreground',
			bg: 'bg-muted',
			bar: 'bg-muted-foreground',
			glow: '',
		},
		bronze: {
			text: 'text-amber-600 dark:text-amber-400',
			bg: 'bg-amber-500/20',
			bar: 'bg-gradient-to-r from-amber-500 to-amber-600',
			glow: '',
		},
		silver: {
			text: 'text-slate-600 dark:text-slate-400',
			bg: 'bg-slate-500/20',
			bar: 'bg-gradient-to-r from-slate-400 to-slate-500',
			glow: '',
		},
		gold: {
			text: 'text-yellow-500 dark:text-yellow-400',
			bg: 'bg-yellow-500/20',
			bar: 'bg-gradient-to-r from-yellow-400 to-yellow-600',
			glow: 'animate-streak-pulse',
		},
		legendary: {
			text: 'text-orange-500 dark:text-orange-400',
			bg: 'bg-orange-500/20',
			bar: 'bg-gradient-to-r from-orange-400 via-red-500 to-orange-600',
			glow: 'animate-streak-pulse animate-milestone-glow',
		},
	}

	const style = tierStyles[tier]

	if (variant === 'compact') {
		return (
			<div
				className={cn('flex items-center gap-1.5', className)}
				role="status"
				aria-label={`${currentStreak} ${t('days')} ${t('currentStreak').toLowerCase()}`}
			>
				<Flame
					className={cn(
						'h-4 w-4',
						currentStreak > 0 ? 'text-orange-500' : 'text-muted-foreground',
						currentStreak >= 7 && 'animate-streak-pulse',
					)}
					aria-hidden="true"
				/>
				<span
					className={cn(
						'text-sm font-bold tabular-nums',
						currentStreak > 0 ? style.text : 'text-muted-foreground',
					)}
				>
					{currentStreak}
				</span>
				{/* Show freeze count if user has any */}
				{freezesAvailable > 0 && (
					<div className="flex items-center gap-0.5 rounded-full bg-cyan-500/10 px-1.5 py-0.5">
						<Snowflake className="h-3 w-3 text-cyan-500" aria-hidden="true" />
						<span className="text-xs font-medium tabular-nums text-cyan-600 dark:text-cyan-400">
							{freezesAvailable}
						</span>
					</div>
				)}
			</div>
		)
	}

	if (variant === 'detailed') {
		// Get milestone badge if at milestone
		const getMilestoneBadge = () => {
			if (currentStreak === 365) return { text: '365-Day Streak!', icon: 'mdi:fire' }
			if (currentStreak === 100) return { text: '100-Day Streak!', icon: 'mdi:fire' }
			if (currentStreak === 30) return { text: '30-Day Streak!', icon: 'mdi:fire' }
			if (currentStreak === 7) return { text: '7-Day Streak!', icon: 'mdi:fire' }
			return null
		}

		const milestoneBadge = getMilestoneBadge()

		return (
			<div className={cn('rounded-xl p-4', style.bg, className)} role="status" aria-label={`${currentStreak} ${t('days')} ${t('currentStreak').toLowerCase()}`}>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className={cn('relative', style.glow)}>
							<Flame
								className={cn(
									'h-8 w-8',
									currentStreak > 0 ? 'text-orange-500' : 'text-muted-foreground',
								)}
								aria-hidden="true"
							/>
						</div>
						<div>
							<div className="flex items-baseline gap-2">
								<span className={cn('text-3xl font-bold tabular-nums', style.text)}>
									{currentStreak}
								</span>
								<span className="text-sm text-muted-foreground">{t('days')}</span>
							</div>
							<p className="text-xs text-muted-foreground">{t('currentStreak')}</p>
						</div>
					</div>

					{bestStreak !== undefined && bestStreak > 0 && (
						<div className="text-right">
							<p className="text-lg font-semibold tabular-nums">{bestStreak}</p>
							<p className="text-xs text-muted-foreground">{t('bestStreak')}</p>
						</div>
					)}
				</div>

				{/* Milestone badge */}
				{milestoneBadge && (
					<div className="mt-3">
						<div
							className={cn(
								'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
								'bg-gradient-to-r from-orange-500/20 to-red-500/20',
								'border border-orange-500/30',
								style.text,
								'animate-milestone-glow',
							)}
						>
							<Icon icon={milestoneBadge.icon} aria-hidden="true" className="h-4 w-4" />
							{milestoneBadge.text}
						</div>
					</div>
				)}

				{showMilestone && currentStreak > 0 && currentStreak < 365 && (
					<div className="mt-4">
						<div className="mb-1.5 flex items-center justify-between text-xs">
							<span className="text-muted-foreground">
								{t('nextMilestone')}: {nextMilestone} {t('days')}
							</span>
							<span className={cn('font-medium', style.text)}>
								{daysToGo} {t('daysToGo')}
							</span>
						</div>
						<div
							className="h-2 overflow-hidden rounded-full bg-background/50"
							role="progressbar"
							aria-valuenow={Math.round(progress)}
							aria-valuemin={0}
							aria-valuemax={100}
							aria-label={`${Math.round(progress)}% to next milestone`}
						>
							<div
								className={cn('h-full rounded-full transition-all duration-500', style.bar)}
								style={{ width: `${progress}%` }}
							/>
						</div>
					</div>
				)}
			</div>
		)
	}

	// Default variant
	return (
		<div className={cn('flex items-center gap-3', className)} role="status" aria-label={`${currentStreak} ${t('days')} ${t('currentStreak').toLowerCase()}`}>
			<div className="flex items-center gap-2">
				<Flame
					className={cn(
						'h-5 w-5',
						currentStreak > 0 ? 'text-orange-500' : 'text-muted-foreground',
						currentStreak >= 7 && 'animate-streak-pulse',
					)}
					aria-hidden="true"
				/>
				<span
					className={cn(
						'text-lg font-bold tabular-nums',
						currentStreak > 0 ? style.text : 'text-muted-foreground',
					)}
				>
					{currentStreak}
				</span>
			</div>

			{showMilestone && currentStreak > 0 && currentStreak < 365 && (
				<div className="flex flex-1 items-center gap-2">
					<div
						className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
						role="progressbar"
						aria-valuenow={Math.round(progress)}
						aria-valuemin={0}
						aria-valuemax={100}
					>
						<div
							className={cn('h-full rounded-full animate-progress-fill', style.bar)}
							style={{ width: `${progress}%` }}
						/>
					</div>
					<span className="text-xs tabular-nums text-muted-foreground">{nextMilestone}</span>
				</div>
			)}
		</div>
	)
}
