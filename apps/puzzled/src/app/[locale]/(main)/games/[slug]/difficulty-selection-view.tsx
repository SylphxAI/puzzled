'use client'

import { Button, Card, CardContent } from '@sylphx/ui'
import { Check, ChevronRight, Gauge } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DifficultyBadge } from '@/features/daily/components'
import type { PuzzleDifficulty } from '@/games/types'
import { Link } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'

type DifficultySelectionViewProps = {
	gameSlug: string
	gameName: string
	locale: string
	completionStatus: Record<PuzzleDifficulty, boolean>
}

/**
 * Difficulty selection screen shown before starting a puzzle for games
 * that support multiple difficulty levels.
 *
 * Users can see which difficulties they've completed today and pick one to play.
 */
export function DifficultySelectionView({
	gameSlug,
	gameName,
	locale: _locale,
	completionStatus,
}: DifficultySelectionViewProps) {
	const t = useTranslations('common.difficulty')
	const tDaily = useTranslations('daily')

	const difficultyConfig: Record<
		PuzzleDifficulty,
		{
			label: string
			description: string
			color: string
			bgColor: string
			borderColor: string
			hoverBg: string
		}
	> = {
		easy: {
			label: t('easy'),
			description: t('easyDescription'),
			color: 'text-emerald-600 dark:text-emerald-400',
			bgColor: 'bg-emerald-500/5',
			borderColor: 'border-emerald-500/20 hover:border-emerald-500/40',
			hoverBg: 'hover:bg-emerald-500/10',
		},
		medium: {
			label: t('medium'),
			description: t('mediumDescription'),
			color: 'text-amber-600 dark:text-amber-400',
			bgColor: 'bg-amber-500/5',
			borderColor: 'border-amber-500/20 hover:border-amber-500/40',
			hoverBg: 'hover:bg-amber-500/10',
		},
		hard: {
			label: t('hard'),
			description: t('hardDescription'),
			color: 'text-red-600 dark:text-red-400',
			bgColor: 'bg-red-500/5',
			borderColor: 'border-red-500/20 hover:border-red-500/40',
			hoverBg: 'hover:bg-red-500/10',
		},
	}

	const allCompleted = completionStatus.easy && completionStatus.medium && completionStatus.hard
	const completedCount = [
		completionStatus.easy,
		completionStatus.medium,
		completionStatus.hard,
	].filter(Boolean).length

	return (
		<div className="flex flex-1 flex-col">
			<main className="flex flex-1 flex-col items-center justify-center px-4 py-8">
				<div className="w-full max-w-md">
					{/* Header */}
					<div className="mb-6 text-center">
						<div className="mb-3 flex items-center justify-center gap-2">
							<Gauge className="h-6 w-6 text-primary" />
							<h1 className="text-xl font-bold">{gameName}</h1>
						</div>
						<p className="text-sm text-muted-foreground">{t('chooseDifficulty')}</p>
						{completedCount > 0 && (
							<p className="mt-2 text-xs text-muted-foreground">
								{completedCount}/3 {tDaily('completed')}
							</p>
						)}
					</div>

					{/* Difficulty Options */}
					<div className="flex flex-col gap-3">
						{(['easy', 'medium', 'hard'] as const).map((level) => {
							const config = difficultyConfig[level]
							const isCompleted = completionStatus[level]

							return (
								<Link key={level} href={`/games/${gameSlug}?difficulty=${level}`} className="group">
									<Card
										className={cn(
											'border-2 transition-all',
											config.borderColor,
											config.bgColor,
											config.hoverBg,
											isCompleted && 'opacity-75',
										)}
									>
										<CardContent className="flex items-center gap-4 p-4">
											{/* Completion indicator */}
											<div
												className={cn(
													'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
													isCompleted ? 'bg-emerald-500/20' : config.bgColor,
												)}
											>
												{isCompleted ? (
													<Check className="h-5 w-5 text-emerald-500" />
												) : (
													<DifficultyBadge
														difficulty={level}
														className="h-auto px-0 py-0 text-sm font-bold"
													/>
												)}
											</div>

											{/* Content */}
											<div className="flex-1">
												<div className="flex items-center gap-2">
													<span className={cn('font-semibold', config.color)}>{config.label}</span>
													{isCompleted && (
														<span className="text-xs text-emerald-600 dark:text-emerald-400">
															✓ Done
														</span>
													)}
												</div>
												<p className="text-sm text-muted-foreground">{config.description}</p>
											</div>

											{/* Arrow */}
											<ChevronRight
												className={cn(
													'h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5',
													config.color,
												)}
											/>
										</CardContent>
									</Card>
								</Link>
							)
						})}
					</div>

					{/* All completed message */}
					{allCompleted && (
						<div className="mt-6 rounded-xl bg-emerald-500/10 p-4 text-center">
							<p className="font-medium text-emerald-600 dark:text-emerald-400">
								🎉 {tDaily('allCompleteMessage')}
							</p>
							<p className="mt-1 text-sm text-muted-foreground">{tDaily('comeBackTomorrow')}</p>
						</div>
					)}

					{/* Back link */}
					<div className="mt-6 text-center">
						<Link
							href="/"
							className="text-sm text-muted-foreground transition-colors hover:text-foreground"
						>
							← {tDaily('backToHome')}
						</Link>
					</div>
				</div>
			</main>
		</div>
	)
}
