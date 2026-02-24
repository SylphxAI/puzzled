'use client'

import { Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn, formatNumber } from '@/lib/utils'

type SocialProofProps = {
	playerCount: number
	locale: string
	className?: string
	variant?: 'default' | 'compact' | 'banner'
}

/**
 * SocialProof - Shows how many players have completed today's puzzle
 *
 * Creates FOMO and social validation:
 * - "1,247 players completed today"
 * - Animated on mount
 */
export function SocialProof({
	playerCount,
	locale,
	className,
	variant = 'default',
}: SocialProofProps) {
	const t = useTranslations('home')

	if (playerCount === 0) return null

	const formattedCount = formatNumber(playerCount, locale)

	if (variant === 'compact') {
		return (
			<div className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
				<Users className="h-3.5 w-3.5" />
				<span className="tabular-nums">{formattedCount}</span>
				<span>{t('playersToday')}</span>
			</div>
		)
	}

	if (variant === 'banner') {
		return (
			<div
				className={cn(
					'flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 px-4 py-2.5',
					'animate-slide-up-fade',
					className,
				)}
			>
				<div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20">
					<Users className="h-4 w-4 text-primary" />
				</div>
				<p className="text-sm">
					<span className="font-bold tabular-nums text-primary">{formattedCount}</span>
					<span className="text-muted-foreground"> {t('playersCompletedToday')}</span>
				</p>
			</div>
		)
	}

	// Default variant
	return (
		<div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
			<Users className="h-4 w-4" />
			<span>
				<span className="font-semibold tabular-nums text-foreground">{formattedCount}</span>{' '}
				{t('playersCompletedToday')}
			</span>
		</div>
	)
}
