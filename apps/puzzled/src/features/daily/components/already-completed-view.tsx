'use client'

import { Button, Card, CardContent } from '@sylphx/ui'
import { Check, ChevronRight, Clock, Flame, Gauge, Share2, Target, Trophy, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import type { PuzzleDifficulty } from '@/games/types'
import { Link } from '@/lib/i18n/routing'
import { cn, getBaseUrl } from '@/lib/utils'
import { DifficultyBadge } from './difficulty-selector'
import { NextPuzzleCountdown } from './next-puzzle-countdown'

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

/**
 * Format puzzle date for share text (e.g., "December 18, 2024")
 */
function formatPuzzleDateLong(dateString: string, locale: string): string {
	const date = new Date(`${dateString}T00:00:00Z`)
	return new Intl.DateTimeFormat(locale, {
		month: 'long',
		day: 'numeric',
		year: 'numeric',
	}).format(date)
}

type Session = {
	status: 'won' | 'lost'
	score: number | null
	attempts: number
	completedAt: Date | null
}

type AlreadyCompletedViewProps = {
	gameSlug: string
	gameName: string
	/** Puzzle date in YYYY-MM-DD format */
	puzzleDate: string
	session: Session
	currentStreak?: number
	locale?: string
	className?: string
	/** Difficulty level for games that support it */
	difficulty?: PuzzleDifficulty
	/** Whether the game supports multiple difficulty levels */
	supportsDifficulty?: boolean
}

/**
 * Enhanced celebration messages based on performance
 */
function getCelebrationMessage(attempts: number, maxAttempts: number = 6): string {
	const ratio = attempts / maxAttempts
	if (ratio <= 0.33) return 'Brilliant!'
	if (ratio <= 0.5) return 'Excellent!'
	if (ratio <= 0.67) return 'Great!'
	if (ratio <= 0.83) return 'Nice!'
	return 'Phew!'
}

export function AlreadyCompletedView({
	gameSlug,
	gameName,
	puzzleDate,
	session,
	currentStreak = 0,
	locale = 'en',
	className,
	difficulty,
	supportsDifficulty = false,
}: AlreadyCompletedViewProps) {
	const t = useTranslations('daily')
	const tCommon = useTranslations('common')
	const tResult = useTranslations('gameResult')
	const tDifficulty = useTranslations('common.difficulty')
	const [showToast, setShowToast] = useState(false)
	const [animate, setAnimate] = useState(false)

	// Trigger animations on mount
	useEffect(() => {
		setAnimate(true)
	}, [])

	const isWin = session.status === 'won'
	const celebrationMessage = isWin ? getCelebrationMessage(session.attempts) : null

	// Get difficulty label for share text
	const difficultyLabel = difficulty ? tDifficulty(difficulty) : null

	const handleShare = async () => {
		const appUrl = getBaseUrl('origin').replace(/^https?:\/\//, '')
		const emoji = isWin ? '🏆' : '❌'
		const streakText = currentStreak > 0 ? `🔥 ${currentStreak} day streak\n` : ''
		const dateText = formatPuzzleDateLong(puzzleDate, locale)
		const difficultyText = difficultyLabel ? ` (${difficultyLabel})` : ''
		const text = `${emoji} ${gameName}${difficultyText} • ${dateText}\n${isWin ? `✅ ${session.attempts} attempts` : '❌ Failed'}\n${streakText}\n${appUrl}`

		try {
			if (navigator.share) {
				await navigator.share({ text })
			} else {
				await navigator.clipboard.writeText(text)
				setShowToast(true)
				setTimeout(() => setShowToast(false), 2000)
			}
		} catch {
			// User cancelled
		}
	}

	return (
		<div className={cn('flex w-full max-w-md flex-col items-center gap-5', className)}>
			{/* Victory/Result Header */}
			<div
				className={cn('flex flex-col items-center text-center', animate && 'animate-slide-up-fade')}
			>
				{/* Icon with glow effect */}
				<div
					className={cn(
						'mb-4 flex h-24 w-24 items-center justify-center rounded-full',
						isWin
							? 'bg-gradient-to-br from-emerald-400/20 via-green-500/20 to-emerald-600/20'
							: 'bg-gradient-to-br from-muted to-muted/50',
						isWin && animate && 'animate-achievement-unlock',
					)}
				>
					{isWin ? (
						<Trophy className="h-12 w-12 text-emerald-500" />
					) : (
						<X className="h-12 w-12 text-muted-foreground" />
					)}
				</div>

				{/* Celebration message */}
				{celebrationMessage && (
					<p
						className={cn(
							'mb-1 text-2xl font-bold text-emerald-500',
							animate && 'animate-count-up opacity-0 stagger-1',
						)}
					>
						{celebrationMessage}
					</p>
				)}

				<h2 className="text-lg font-semibold">
					{isWin
						? t('youSolvedTodays', { game: gameName })
						: t('youTriedTodays', { game: gameName })}
				</h2>
				<div className="mt-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
					<span>{gameName}</span>
					{difficulty && <DifficultyBadge difficulty={difficulty} />}
					<span>•</span>
					<span>{formatPuzzleDate(puzzleDate, locale)}</span>
				</div>
			</div>

			{/* Stats Card */}
			<Card
				className={cn(
					'w-full overflow-hidden',
					isWin && 'border-emerald-500/30',
					animate && 'animate-slide-up-fade opacity-0 stagger-2',
				)}
			>
				<CardContent className="p-5">
					<div className="grid grid-cols-2 gap-4">
						{/* Status */}
						<div
							className={cn(
								'flex flex-col items-center rounded-xl p-4',
								isWin ? 'bg-emerald-500/10' : 'bg-muted/50',
							)}
						>
							<div className="mb-2 flex items-center gap-1.5">
								{isWin ? (
									<Check className="h-4 w-4 text-emerald-500" />
								) : (
									<Target className="h-4 w-4 text-muted-foreground" />
								)}
								<span
									className={cn(
										'text-xs font-medium',
										isWin ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
									)}
								>
									{tResult('status')}
								</span>
							</div>
							<span
								className={cn(
									'text-xl font-bold',
									isWin ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground',
								)}
							>
								{isWin ? tResult('won') : tResult('lost')}
							</span>
						</div>

						{/* Attempts */}
						<div className="flex flex-col items-center rounded-xl bg-muted/50 p-4">
							<div className="mb-2 flex items-center gap-1.5 text-muted-foreground">
								<Target className="h-4 w-4" />
								<span className="text-xs font-medium">{tResult('attempts')}</span>
							</div>
							<span className="text-xl font-bold tabular-nums">{session.attempts}</span>
						</div>
					</div>

					{/* Streak indicator (if streak > 0) */}
					{currentStreak > 0 && (
						<div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-orange-500/10 px-4 py-3">
							<Flame className="h-5 w-5 text-orange-500" />
							<span className="font-semibold text-orange-600 dark:text-orange-400">
								{currentStreak} day streak!
							</span>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Share Button - Prominent */}
			<Button
				onClick={handleShare}
				size="lg"
				className={cn(
					'w-full gap-2 bg-gradient-to-r from-primary to-primary/80 text-base',
					animate && 'animate-slide-up-fade opacity-0 stagger-3',
				)}
			>
				<Share2 className="h-5 w-5" />
				{tCommon('share')} Your Result
			</Button>

			{/* Play Other Difficulties - For games with difficulty support */}
			{supportsDifficulty && (
				<Link href={`/games/${gameSlug}`} className="w-full">
					<Button
						variant="outline"
						size="lg"
						className={cn(
							'w-full gap-2 text-base',
							animate && 'animate-slide-up-fade opacity-0 stagger-3',
						)}
					>
						<Gauge className="h-5 w-5" />
						{tDifficulty('playOtherDifficulties')}
						<ChevronRight className="ml-auto h-4 w-4" />
					</Button>
				</Link>
			)}

			{/* Countdown Card */}
			<Card className={cn('w-full', animate && 'animate-slide-up-fade opacity-0 stagger-4')}>
				<CardContent className="p-5 text-center">
					<div className="mb-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
						<Clock className="h-4 w-4" />
						<span className="font-medium">{t('nextPuzzle')}</span>
					</div>
					<NextPuzzleCountdown variant="default" showLabel={false} className="items-center" />
					<p className="mt-3 text-xs text-muted-foreground">{t('comeBackTomorrow')}</p>
				</CardContent>
			</Card>

			{/* Back to Home */}
			<Link
				href="/"
				className="text-sm text-muted-foreground transition-colors hover:text-foreground"
			>
				← {t('backToHome')}
			</Link>

			{/* Toast */}
			{showToast && (
				<div className="fixed bottom-24 left-1/2 z-toast -translate-x-1/2 animate-slide-up rounded-lg bg-foreground px-4 py-2 text-sm text-background shadow-lg">
					{tCommon('copied')}
				</div>
			)}
		</div>
	)
}
