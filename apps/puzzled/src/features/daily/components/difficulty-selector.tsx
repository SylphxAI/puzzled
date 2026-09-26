'use client'

import { Gauge } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { PuzzleDifficulty } from '@/games/types'
import { cn } from '@/lib/utils'

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
			badgeColor: 'text-success',
			badgeBg: 'bg-success/15',
		},
		medium: {
			label: t('medium'),
			badgeColor: 'text-accent-warm-foreground',
			badgeBg: 'bg-accent-warm/15',
		},
		hard: {
			label: t('hard'),
			badgeColor: 'text-destructive',
			badgeBg: 'bg-destructive/15',
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
