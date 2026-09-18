'use client'

import { Check, Gauge } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { PuzzleDifficulty } from '@/games/types'
import { cn } from '@/lib/utils'

type DifficultyOption = {
	level: PuzzleDifficulty
	completed?: boolean
}

type DifficultySelectorProps = {
	options: DifficultyOption[]
	selected: PuzzleDifficulty
	onSelect: (difficulty: PuzzleDifficulty) => void
	className?: string
}

/**
 * Difficulty selector for games that support multiple difficulty levels.
 *
 * Used on game pages before starting a puzzle to let users choose their challenge level.
 * Shows completion status for each difficulty level.
 */
function _DifficultySelector({ options, selected, onSelect, className }: DifficultySelectorProps) {
	const t = useTranslations('common.difficulty')

	const difficultyConfig: Record<
		PuzzleDifficulty,
		{ label: string; color: string; bgColor: string; borderColor: string }
	> = {
		easy: {
			label: t('easy'),
			color: 'text-emerald-700 dark:text-emerald-400',
			bgColor: 'bg-emerald-500/10',
			borderColor: 'border-emerald-500/30',
		},
		medium: {
			label: t('medium'),
			color: 'text-amber-700 dark:text-amber-400',
			bgColor: 'bg-amber-500/10',
			borderColor: 'border-amber-500/30',
		},
		hard: {
			label: t('hard'),
			color: 'text-red-700 dark:text-red-400',
			bgColor: 'bg-red-500/10',
			borderColor: 'border-red-500/30',
		},
	}

	return (
		<div className={cn('flex flex-col gap-3', className)}>
			<div
				className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
				id="difficulty-label"
			>
				<Gauge className="h-4 w-4" aria-hidden="true" />
				<span className="font-medium">{t('selectDifficulty')}</span>
			</div>

			<fieldset
				className="flex items-center justify-center gap-1.5 rounded-xl border-0 bg-muted/50 p-1.5"
				aria-labelledby="difficulty-label"
			>
				{options.map((option) => {
					const config = difficultyConfig[option.level]
					const isSelected = selected === option.level
					const isCompleted = option.completed

					return (
						<button
							type="button"
							key={option.level}
							onClick={() => onSelect(option.level)}
							aria-pressed={isSelected}
							aria-label={config.label}
							className={cn(
								'relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
								isSelected
									? cn('bg-background shadow-sm', config.color)
									: 'text-muted-foreground hover:text-foreground',
								isCompleted && 'cursor-default',
							)}
						>
							{isCompleted && (
								<Check
									className={cn('h-3.5 w-3.5', isSelected ? config.color : 'text-emerald-500')}
									aria-hidden="true"
								/>
							)}
							<span>{config.label}</span>
						</button>
					)
				})}
			</fieldset>
		</div>
	)
}

/**
 * Compact difficulty badge for showing current difficulty in headers, results, etc.
 */
type DifficultyBadgeProps = {
	difficulty: PuzzleDifficulty
	showIcon?: boolean
	className?: string
}

export function DifficultyBadge({ difficulty, showIcon = false, className }: DifficultyBadgeProps) {
	const t = useTranslations('common.difficulty')

	const config: Record<PuzzleDifficulty, { label: string; badgeColor: string; badgeBg: string }> = {
		easy: {
			label: t('easy'),
			badgeColor: 'text-emerald-800 dark:text-emerald-300',
			badgeBg: 'bg-emerald-500/15',
		},
		medium: {
			label: t('medium'),
			badgeColor: 'text-amber-800 dark:text-amber-300',
			badgeBg: 'bg-amber-500/15',
		},
		hard: {
			label: t('hard'),
			badgeColor: 'text-red-800 dark:text-red-300',
			badgeBg: 'bg-red-500/15',
		},
	}

	const c = config[difficulty]

	return (
		<output
			className={cn(
				'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
				// Small bold text needs a stronger ink/plate pair than the
				// difficulty-button tint: these two pairs clear 4.5:1 on light.
				c.badgeColor,
				c.badgeBg,
				className,
			)}
			aria-label={c.label}
		>
			{showIcon && <Gauge className="h-3 w-3" aria-hidden="true" />}
			{c.label}
		</output>
	)
}
