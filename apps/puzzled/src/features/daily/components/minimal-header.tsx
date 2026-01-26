'use client'

import { ArrowLeft, HelpCircle, MoreVertical } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { StreakBar } from '@/features/gamification/components/streak-bar'
import type { PuzzleDifficulty } from '@/games/types'
import type { GameMode } from '@/lib/db/schema'
import { Link } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'
import { Button } from '@sylphx/ui'
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
		<header
			className={cn(
				'sticky top-0 z-header border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
				className,
			)}
		>
			<div className="mx-auto flex h-12 max-w-3xl items-center justify-between px-3 sm:h-14 sm:px-4">
				{/* Left: Back + Game Info */}
				<div className="flex items-center gap-2 sm:gap-3">
					<Link href="/" className="flex items-center">
						<Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10">
							<ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
							<span className="sr-only">{t('back')}</span>
						</Button>
					</Link>

					<div className="flex items-center gap-1.5 sm:gap-2">
						<h1 className="text-sm font-semibold sm:text-base">{gameName}</h1>
						<span className="text-xs text-muted-foreground sm:text-sm">
							{formatPuzzleDate(puzzleDate, locale)}
						</span>
					</div>
				</div>

				{/* Right: Streak + Mode + Difficulty + Actions */}
				<div className="flex items-center gap-1.5 sm:gap-2">
					{/* Streak indicator */}
					{currentStreak > 0 && (
						<StreakBar currentStreak={currentStreak} variant="compact" showMilestone={false} />
					)}

					{/* Mode badge */}
					<ModeBadge mode={mode} />

					{/* Difficulty badge (for games that support it) */}
					{difficulty && <DifficultyBadge difficulty={difficulty} />}

					{/* Help button */}
					{onHelpClick && (
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8 sm:h-9 sm:w-9"
							onClick={onHelpClick}
						>
							<HelpCircle className="h-4 w-4 sm:h-5 sm:w-5" />
							<span className="sr-only">Help</span>
						</Button>
					)}

					{/* Menu button */}
					{onMenuClick && (
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8 sm:h-9 sm:w-9"
							onClick={onMenuClick}
						>
							<MoreVertical className="h-4 w-4 sm:h-5 sm:w-5" />
							<span className="sr-only">Menu</span>
						</Button>
					)}
				</div>
			</div>
		</header>
	)
}
