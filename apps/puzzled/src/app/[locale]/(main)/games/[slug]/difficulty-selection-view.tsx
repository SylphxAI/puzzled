'use client'

import { Check, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { PuzzleDifficulty } from '@/games/types'
import { Link } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'

type DifficultySelectionViewProps = {
	gameSlug: string
	gameName: string
	locale: string
	/** null = the server could not prove this level's completion state. */
	completionStatus: Record<PuzzleDifficulty, boolean | null>
	/** False when at least one level's completion state is unknown. */
	completionStatusVerified?: boolean
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
	completionStatusVerified = true,
}: DifficultySelectionViewProps) {
	const t = useTranslations('common.difficulty')
	const tDaily = useTranslations('daily')

	const levels = [
		{ level: 'easy', label: t('easy'), description: t('easyDescription'), bars: 1 },
		{ level: 'medium', label: t('medium'), description: t('mediumDescription'), bars: 2 },
		{ level: 'hard', label: t('hard'), description: t('hardDescription'), bars: 3 },
	] as const

	const allCompleted =
		completionStatus.easy === true &&
		completionStatus.medium === true &&
		completionStatus.hard === true
	const completedCount = [
		completionStatus.easy,
		completionStatus.medium,
		completionStatus.hard,
	].filter((status) => status === true).length

	return (
		<div className="flex flex-1 flex-col items-center">
			<div className="w-full max-w-md">
				<div className="mb-4 text-center">
					<h2 className="font-display text-2xl">{gameName}</h2>
					<p className="mt-1 text-[15px] text-muted-foreground">{t('chooseDifficulty')}</p>
					{completedCount > 0 && (
						<p className="numeral mt-1 text-xs text-muted-foreground">
							{completedCount}/3 {tDaily('completed')}
						</p>
					)}
					{!completionStatusVerified && (
						<output className="mt-2 block text-xs text-muted-foreground">
							{tDaily('difficultyStatusUnverified')}
						</output>
					)}
				</div>

				<ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
					{levels.map(({ level, label, description, bars }) => {
						const isCompleted = completionStatus[level]
						return (
							<li key={level}>
								<Link
									href={`/games/${gameSlug}?difficulty=${level}`}
									className="group flex min-h-16 items-center gap-4 px-4 py-3 transition-colors hover:bg-muted active:bg-accent"
								>
									<span className="flex h-6 items-end gap-0.5" aria-hidden="true">
										{[1, 2, 3].map((bar) => (
											<span
												key={bar}
												className={cn(
													'w-1.5 rounded-full',
													bar === 1 ? 'h-2.5' : bar === 2 ? 'h-4' : 'h-6',
													bar <= bars ? 'bg-foreground' : 'bg-border',
												)}
											/>
										))}
									</span>
									<span className="min-w-0 flex-1">
										<span className="flex items-center gap-2 text-[16px] font-semibold">
											{label}
											{isCompleted === null && (
												<span className="text-xs font-normal text-muted-foreground">
													{tDaily('statusUnknown')}
												</span>
											)}
										</span>
										<span className="block text-sm text-muted-foreground">{description}</span>
									</span>
									{isCompleted === true ? (
										<span className="flex h-7 w-7 items-center justify-center rounded-full bg-success text-success-foreground">
											<Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
											<span className="sr-only">{tDaily('completed')}</span>
										</span>
									) : (
										<ChevronRight
											className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
											aria-hidden="true"
										/>
									)}
								</Link>
							</li>
						)
					})}
				</ul>

				{allCompleted && (
					<div className="mt-4 rounded-2xl bg-muted p-4 text-center">
						<p className="font-semibold">{tDaily('allCompleteMessage')}</p>
						<p className="mt-1 text-sm text-muted-foreground">{tDaily('comeBackTomorrow')}</p>
					</div>
				)}
			</div>
		</div>
	)
}
