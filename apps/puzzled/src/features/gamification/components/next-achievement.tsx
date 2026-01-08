'use client'

import { Target } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/shared/components/ui'

type NextAchievementProps = {
	achievement: {
		name: string
		description: string
		icon?: string
		progress: number
		target: number
	}
	className?: string
}

/**
 * NextAchievement - Widget showing progress to next achievement
 *
 * Features:
 * - Progress bar with percentage
 * - Achievement icon and details
 * - Animated progress fill
 * - Clean, minimal design
 */
export function NextAchievement({ achievement, className }: NextAchievementProps) {
	const t = useTranslations('achievements')

	const progressPercent = Math.min(
		Math.round((achievement.progress / achievement.target) * 100),
		100,
	)

	return (
		<Card className={cn('overflow-hidden', className)}>
			<CardContent className="p-4">
				{/* Header */}
				<div className="mb-3 flex items-center gap-2">
					<Target className="h-4 w-4 text-primary" />
					<span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
						{t('nextUp')}
					</span>
				</div>

				{/* Achievement info */}
				<div className="mb-3 flex items-start gap-3">
					{achievement.icon && (
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
							<span className="text-xl">{achievement.icon}</span>
						</div>
					)}
					<div className="min-w-0 flex-1">
						<h3 className="font-semibold leading-tight">{achievement.name}</h3>
						<p className="text-xs text-muted-foreground">{achievement.description}</p>
					</div>
				</div>

				{/* Progress bar */}
				<div className="space-y-1.5">
					<div className="flex items-center justify-between text-xs">
						<span className="text-muted-foreground">{t('progress')}</span>
						<span className="font-medium tabular-nums">
							{achievement.progress}/{achievement.target}
						</span>
					</div>
					<div className="h-2 overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500 animate-progress-fill"
							style={{ width: `${progressPercent}%` }}
						/>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}
