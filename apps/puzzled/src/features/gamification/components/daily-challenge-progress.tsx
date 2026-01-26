'use client'

import { Card, CardContent } from '@sylphx/ui'
import { Check, Sparkles, Star } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Link } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'
import { GameIcon } from '@/shared/components/ui/game-icons'

type GameProgress = {
	slug: string
	name: string
	icon?: string
	completed: boolean
	won?: boolean
}

type DailyChallengeProgressProps = {
	games: GameProgress[]
	className?: string
}

/**
 * DailyChallengeProgress - Shows progress toward completing all daily games
 *
 * Features:
 * - Visual progress indicator
 * - Super Streak bonus when all completed
 * - Quick links to uncompleted games
 */
export function DailyChallengeProgress({ games, className }: DailyChallengeProgressProps) {
	const t = useTranslations('daily')

	const completedCount = games.filter((g) => g.completed).length
	const totalCount = games.length
	const allCompleted = completedCount === totalCount
	const progress = (completedCount / totalCount) * 100

	return (
		<Card
			className={cn(
				'overflow-hidden transition-all',
				allCompleted && 'border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 to-transparent',
				className,
			)}
		>
			<CardContent className="p-4">
				{/* Header */}
				<div className="mb-3 flex items-center justify-between">
					<div className="flex items-center gap-2">
						{allCompleted ? (
							<Star className="h-5 w-5 text-yellow-500" />
						) : (
							<Sparkles className="h-5 w-5 text-primary" />
						)}
						<span className="font-semibold">
							{allCompleted ? t('superStreak') : t('todaysProgress')}
						</span>
					</div>
					<span
						className={cn(
							'text-sm font-medium',
							allCompleted ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground',
						)}
					>
						{completedCount}/{totalCount} {t('completed')}
					</span>
				</div>

				{/* Progress bar */}
				<div className="mb-4 h-2 overflow-hidden rounded-full bg-muted">
					<div
						className={cn(
							'h-full rounded-full transition-all duration-500',
							allCompleted
								? 'bg-gradient-to-r from-yellow-400 to-yellow-600'
								: 'bg-gradient-to-r from-primary to-primary/70',
						)}
						style={{ width: `${progress}%` }}
					/>
				</div>

				{/* Game list */}
				<div className="flex items-center justify-center gap-3">
					{games.map((game) => {
						if (game.completed) {
							return (
								<div
									key={game.slug}
									className={cn(
										'flex h-10 w-10 items-center justify-center rounded-full',
										game.won
											? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
											: 'bg-red-500/20 text-red-600 dark:text-red-400',
									)}
									title={game.name}
								>
									<Check className="h-5 w-5" />
								</div>
							)
						}

						return (
							<Link
								key={game.slug}
								href={`/games/${game.slug}`}
								className={cn(
									'flex h-10 w-10 items-center justify-center rounded-full',
									'bg-muted text-muted-foreground',
									'transition-all hover:bg-primary/10 hover:text-primary',
								)}
								title={game.name}
							>
								<GameIcon slug={game.slug} size={18} />
							</Link>
						)
					})}
				</div>

				{/* Super streak message */}
				{allCompleted && (
					<p className="mt-3 text-center text-sm text-yellow-600 dark:text-yellow-400">
						{t('superStreakDesc')}
					</p>
				)}
			</CardContent>
		</Card>
	)
}
