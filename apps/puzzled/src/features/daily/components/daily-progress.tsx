'use client'

import { Check, Circle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DEFAULT_GAME_COLORS, type GameColorTheme, getGameColors } from '@/games/theme-colors'
import { cn } from '@/lib/utils'
import { GameIcon } from '@/shared/components/ui'

type GameCompletion = {
	slug: string
	name: string
	icon?: string
	completed: boolean
	score?: number | string
	theme?: GameColorTheme
}

type DailyProgressProps = {
	games: GameCompletion[]
	className?: string
	variant?: 'default' | 'compact' | 'expanded'
}

/** Get color classes from theme token (no regex, direct lookup) */
function getColors(theme?: GameColorTheme) {
	if (!theme) return DEFAULT_GAME_COLORS
	return getGameColors(theme)
}

export function DailyProgress({ games, className, variant = 'default' }: DailyProgressProps) {
	const t = useTranslations('daily')
	const completedCount = games.filter((g) => g.completed).length
	const totalCount = games.length
	const allComplete = completedCount === totalCount

	if (variant === 'compact') {
		return (
			<div className={cn('flex items-center gap-2', className)}>
				{games.map((game) => {
					const colors = getColors(game.theme)
					return (
						<div
							key={game.slug}
							className={cn(
								'flex h-7 w-7 items-center justify-center rounded-full transition-all',
								game.completed ? `${colors.bg} text-white` : 'bg-muted text-muted-foreground',
							)}
						>
							{game.completed ? (
								<Check className="h-4 w-4" />
							) : (
								<GameIcon slug={game.slug} size={16} />
							)}
						</div>
					)
				})}
				<span className="ml-1 text-xs text-muted-foreground">
					{completedCount}/{totalCount}
				</span>
			</div>
		)
	}

	if (variant === 'expanded') {
		return (
			<div className={cn('space-y-3', className)}>
				{/* Header */}
				<div className="flex items-center justify-between">
					<h3 className="text-sm font-medium">{t('todaysProgress')}</h3>
					<span
						className={cn(
							'rounded-full px-2 py-0.5 text-xs font-medium',
							allComplete
								? 'bg-green-500/10 text-green-600 dark:text-green-400'
								: 'bg-muted text-muted-foreground',
						)}
					>
						{completedCount}/{totalCount} {t('completed')}
					</span>
				</div>

				{/* Game List */}
				<div className="space-y-2">
					{games.map((game) => {
						const colors = getColors(game.theme)
						return (
							<div
								key={game.slug}
								className={cn(
									'flex items-center gap-3 rounded-lg p-2 transition-colors',
									game.completed ? 'bg-muted/50' : 'bg-transparent',
								)}
							>
								<div
									className={cn(
										'flex h-8 w-8 items-center justify-center rounded-lg transition-all',
										game.completed ? `${colors.bg} text-white` : `bg-muted ${colors.text}`,
									)}
								>
									<GameIcon slug={game.slug} size={16} />
								</div>
								<div className="flex-1">
									<span className="text-sm font-medium">{game.name}</span>
									{game.completed && game.score && (
										<span className="ml-2 text-xs text-muted-foreground">{game.score}</span>
									)}
								</div>
								{game.completed ? (
									<Check className="h-5 w-5 text-green-500" />
								) : (
									<Circle className="h-5 w-5 text-muted-foreground/50" />
								)}
							</div>
						)
					})}
				</div>

				{/* All Complete Message */}
				{allComplete && (
					<div className="rounded-lg bg-green-500/10 p-3 text-center text-sm text-green-600 dark:text-green-400">
						{t('allCompleteMessage')}
					</div>
				)}
			</div>
		)
	}

	// Default variant
	return (
		<div className={cn('rounded-lg border bg-card p-4', className)}>
			{/* Progress Header */}
			<div className="mb-3 flex items-center justify-between">
				<span className="text-sm font-medium">{t('todaysProgress')}</span>
				<span
					className={cn(
						'text-sm tabular-nums',
						allComplete ? 'font-semibold text-green-500' : 'text-muted-foreground',
					)}
				>
					{completedCount}/{totalCount}
				</span>
			</div>

			{/* Progress Bar */}
			<div className="mb-3 h-2 overflow-hidden rounded-full bg-muted">
				<div
					className={cn(
						'h-full rounded-full transition-all duration-500',
						allComplete ? 'bg-green-500' : 'bg-primary',
					)}
					style={{ width: `${(completedCount / totalCount) * 100}%` }}
				/>
			</div>

			{/* Game Pills */}
			<div className="flex items-center justify-center gap-3">
				{games.map((game) => {
					const colors = getColors(game.theme)
					return (
						<div
							key={game.slug}
							className={cn(
								'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all',
								game.completed
									? `${colors.bg} text-white ring-2 ${colors.ring}`
									: 'bg-muted text-muted-foreground',
							)}
						>
							<GameIcon slug={game.slug} size={14} />
							{game.completed && <Check className="h-3 w-3" />}
						</div>
					)
				})}
			</div>
		</div>
	)
}
