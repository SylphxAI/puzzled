'use client'

import { Button } from '@sylphx/ui'
import { ArrowLeft, HelpCircle, MoreVertical } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { StreakBar } from '@/features/gamification/components/streak-bar'
import type { PuzzleDifficulty } from '@/games/types'
import type { GameMode } from '@/lib/db/schema'
import { Link } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'
import { DifficultyBadge } from './difficulty-selector'
import { ModeBadge } from './mode-badge'

/**
 * Format puzzle date for display (e.g., "Dec 18" or locale-appropriate short format)
 */
function formatPuzzleDate(dateString: string, locale: string): string {
	const date = new Date(`${dateString}T00:00:00Z`)
	return new Intl.DateTimeFormat(locale, {
		month: 'short',
		day: 'numeric',
	}).format(date)
}

type MinimalHeaderProps = {
	gameName: string
	/** Puzzle date in YYYY-MM-DD format */
	puzzleDate: string
	currentStreak?: number
	mode?: GameMode
	locale: string
	className?: string
	onHelpClick?: () => void
	onMenuClick?: () => void
	/** Difficulty level for games that support it */
	difficulty?: PuzzleDifficulty
}

/**
 * MinimalHeader - Compact game header for focused gameplay
 *
 * Features:
 * - Back button
 * - Game name with puzzle number
 * - Streak indicator (compact)
 * - Mode badge (daily/archive)
 * - Optional help and menu buttons
 */
export function MinimalHeader({
	gameName,
	puzzleDate,
	currentStreak = 0,
	mode = 'daily',
	locale,
	className,
	onHelpClick,
	onMenuClick,
	difficulty,
}: MinimalHeaderProps) {
	const t = useTranslations('common')

	return (
		/*
		 * Game chrome, not a document banner: the shell already provides the one
		 * `banner` landmark, so this stays a plain block to avoid a second one.
		 */
		<div
			className={cn(
				'sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-sticky border-b border-hairline bg-background/85 backdrop-blur-xl md:top-16',
				className,
			)}
		>
			<div className="mx-auto flex h-12 max-w-3xl items-center justify-between gap-2 px-1 sm:px-3">
				<div className="flex min-w-0 items-center gap-1">
					<Link
						href="/"
						className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-muted"
					>
						<ArrowLeft className="h-5 w-5" aria-hidden="true" />
						<span className="sr-only">{t('back')}</span>
					</Link>
					<p className="min-w-0 truncate text-[15px]">
						<span className="font-semibold">{gameName}</span>
						<span className="ml-1.5 text-muted-foreground">
							{formatPuzzleDate(puzzleDate, locale)}
						</span>
					</p>
				</div>

				<div className="flex shrink-0 items-center gap-1">
					{currentStreak > 0 && (
						<StreakBar currentStreak={currentStreak} variant="compact" showMilestone={false} />
					)}
					<ModeBadge mode={mode} />
					{difficulty && <DifficultyBadge difficulty={difficulty} />}
					{onHelpClick && (
						<Button variant="ghost" size="icon" onClick={onHelpClick}>
							<HelpCircle className="h-5 w-5" aria-hidden="true" />
							<span className="sr-only">{t('help')}</span>
						</Button>
					)}
					{onMenuClick && (
						<Button variant="ghost" size="icon" onClick={onMenuClick}>
							<MoreVertical className="h-5 w-5" aria-hidden="true" />
							<span className="sr-only">{t('menu')}</span>
						</Button>
					)}
				</div>
			</div>
		</div>
	)
}
