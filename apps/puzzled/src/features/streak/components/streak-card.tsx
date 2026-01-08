'use client'

import { Flame, Snowflake, TrendingUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@sylphx/ui'

type StreakCardProps = {
	currentStreak: number
	maxStreak: number
	hasPlayedToday: boolean
	freezesAvailable?: number
	className?: string
}

export function StreakCard({
	currentStreak,
	maxStreak,
	hasPlayedToday,
	freezesAvailable = 0,
	className,
}: StreakCardProps) {
	const t = useTranslations('streak')

	// Milestones for progress visualization
	const milestones = [7, 30, 100, 365]
	const nextMilestone = milestones.find((m) => m > currentStreak) || 365
	const progress = (currentStreak / nextMilestone) * 100

	return (
		<Card className={cn('overflow-hidden', className)}>
			<CardContent className="p-0">
				{/* Header with current streak */}
				<div
					className={cn(
						'flex items-center justify-between p-4',
						hasPlayedToday
							? 'bg-gradient-to-r from-green-500/10 to-emerald-500/10'
							: 'bg-gradient-to-r from-orange-500/10 to-yellow-500/10',
					)}
				>
					<div className="flex items-center gap-3">
						<div
							className={cn(
								'flex h-14 w-14 items-center justify-center rounded-full',
								hasPlayedToday ? 'bg-green-500/20' : 'bg-orange-500/20',
							)}
						>
							<Flame
								className={cn('h-8 w-8', hasPlayedToday ? 'text-green-500' : 'text-orange-500')}
								fill={hasPlayedToday ? 'currentColor' : 'none'}
							/>
						</div>
						<div>
							<p className="text-sm text-muted-foreground">{t('currentStreak')}</p>
							<p className="text-3xl font-bold">
								{currentStreak}
								<span className="ml-1 text-lg font-normal text-muted-foreground">{t('days')}</span>
							</p>
						</div>
					</div>

					{/* Freezes indicator */}
					{freezesAvailable > 0 && (
						<div className="flex flex-col items-center gap-1">
							<div className="flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-1 text-blue-600">
								<Snowflake className="h-4 w-4" />
								<span className="text-sm font-medium">{freezesAvailable}</span>
							</div>
							<span className="text-xs text-muted-foreground">{t('freezes')}</span>
						</div>
					)}
				</div>

				{/* Progress bar to next milestone */}
				<div className="border-t p-4">
					<div className="flex items-center justify-between text-sm">
						<span className="text-muted-foreground">{t('nextMilestone')}</span>
						<span className="font-medium">
							{nextMilestone - currentStreak} {t('daysToGo')}
						</span>
					</div>
					<div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
						<div
							className={cn(
								'h-full rounded-full transition-all duration-500',
								progress >= 100 ? 'bg-green-500' : 'bg-primary',
							)}
							style={{ width: `${Math.min(progress, 100)}%` }}
						/>
					</div>
					<div className="mt-1 flex justify-between text-xs text-muted-foreground">
						<span>0</span>
						<span className="font-medium text-primary">
							{nextMilestone} {t('days')}
						</span>
					</div>
				</div>

				{/* Max streak footer */}
				<div className="flex items-center justify-between border-t bg-muted/30 px-4 py-2">
					<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
						<TrendingUp className="h-4 w-4" />
						<span>{t('bestStreak')}</span>
					</div>
					<span className="font-semibold">
						{maxStreak} {t('days')}
					</span>
				</div>
			</CardContent>
		</Card>
	)
}

// Compact version for dashboard
export function StreakCardCompact({
	currentStreak,
	maxStreak,
	hasPlayedToday,
}: {
	currentStreak: number
	maxStreak: number
	hasPlayedToday: boolean
}) {
	const t = useTranslations('streak')

	return (
		<div
			className={cn(
				'flex items-center gap-3 rounded-xl p-3',
				hasPlayedToday ? 'bg-green-500/10' : 'bg-orange-500/10',
			)}
		>
			<Flame
				className={cn('h-6 w-6', hasPlayedToday ? 'text-green-500' : 'text-orange-500')}
				fill={hasPlayedToday ? 'currentColor' : 'none'}
			/>
			<div className="flex-1">
				<p className="text-lg font-bold">
					{currentStreak}{' '}
					<span className="text-sm font-normal text-muted-foreground">{t('days')}</span>
				</p>
				<p className="text-xs text-muted-foreground">
					{t('bestStreak')}: {maxStreak}
				</p>
			</div>
			{!hasPlayedToday && currentStreak > 0 && (
				<span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-xs font-medium text-orange-600">
					{t('playToday')}!
				</span>
			)}
		</div>
	)
}
