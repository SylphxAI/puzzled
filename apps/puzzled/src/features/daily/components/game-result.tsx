'use client'

import { Button } from '@sylphx/ui'
import { BarChart3, Clock, Image, Share2, Target, Trophy, Users } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { NextPuzzleCountdown } from '@/features/daily/components/next-puzzle-countdown'
import {
	buildResultCard,
	type ResultCardStrings,
	type ResultCardTile,
	resultCardTextAlternative,
} from '@/features/daily/lib/result-card'
import { resolveModuleDisplayName } from '@/features/daily/lib/result-share'
import { shareRitualResultCard } from '@/features/daily/lib/share-result-card'
import { type GameSlug, getHowToPlayConfig } from '@/games/how-to-play-registry'
import { useTodayPercentile } from '@/lib/api'
import { Link } from '@/lib/i18n/routing'
import { productDayKey } from '@/lib/product-day'
import { cn, getBaseUrl } from '@/lib/utils'

type MissedCategory = {
	name: string
	words: string[]
	level: 0 | 1 | 2 | 3
}

type GameResultProps = {
	gameType: GameSlug
	status: 'won' | 'lost'
	stats: {
		attempts?: number
		maxAttempts?: number
		timeSpentMs?: number
		score?: number
		mistakes?: number
		hintsUsed?: number
	}
	solution?: string
	mode: 'daily' | 'archive'
	onShare: () => void
	/** For connections: categories the user didn't solve */
	missedCategories?: MissedCategory[]
	/** Product day (YYYY-MM-DD) the run was served for; labels the shareable card. */
	puzzleDate?: string
	/** Current streak, shown on the card when known. */
	currentStreak?: number
	/** Content-free pattern (hit / near / miss); modules opt in. */
	pattern?: ResultCardTile[][]
}

// Category colors for displaying missed categories
const CATEGORY_COLORS: Record<0 | 1 | 2 | 3, { bg: string; text: string }> = {
	0: { bg: 'bg-accent-warm', text: 'text-accent-warm-foreground' },
	1: { bg: 'bg-success', text: 'text-success' },
	2: { bg: 'bg-info', text: 'text-info' },
	3: { bg: 'bg-muted', text: 'text-foreground' },
}

export function GameResultCard({
	gameType,
	status,
	stats,
	solution,
	mode,
	onShare,
	missedCategories,
	puzzleDate,
	currentStreak,
	pattern,
}: GameResultProps) {
	const locale = useLocale()
	const t = useTranslations('gameResult')
	const tCommon = useTranslations('common')
	const tShare = useTranslations('share')
	const tGames = useTranslations('games')
	const [cardBusy, setCardBusy] = useState(false)
	const [cardNotice, setCardNotice] = useState<string | null>(null)

	const isWin = status === 'won'

	// One copy object for the model, the image and the text alternative, so the
	// card and the accessible sentence always speak the same words.
	const cardStrings: ResultCardStrings = {
		statusWon: tShare('card.statusWon'),
		statusLost: tShare('card.statusLost'),
		attemptsLabel: tShare('card.attemptsLabel'),
		scoreLabel: tShare('card.scoreLabel'),
		streakLabel: tShare('card.streakLabel'),
		timeLabel: tShare('card.timeLabel'),
		mistakesLabel: tShare('card.mistakesLabel'),
		timeUnder1m: tShare('card.timeUnder1m'),
		timeUnder5m: tShare('card.timeUnder5m'),
		timeOver5m: tShare('card.timeOver5m'),
		attemptsOf: tShare('card.attemptsOf'),
		attemptsCount: tShare('card.attemptsCount'),
		scorePoints: tShare('card.scorePoints'),
		streakDays: tShare('card.streakDays'),
		patternSummary: tShare('card.patternSummary'),
		altOnDay: tShare('card.altOnDay'),
		altTemplate: tShare('card.altTemplate'),
		altDetailsTemplate: tShare('card.altDetailsTemplate'),
		altLinkTemplate: tShare('card.altLinkTemplate'),
		detailSeparator: tShare('card.detailSeparator'),
	}

	/** Card model for this result: non-spoiler by construction (see result-card.ts). */
	const buildCard = () =>
		buildResultCard({
			origin: getBaseUrl('origin'),
			gameSlug: gameType,
			gameName: resolveModuleDisplayName(tGames, gameType),
			theme: getHowToPlayConfig(gameType)?.display.theme ?? 'slate',
			mode,
			status,
			locale,
			// A daily finish still in its day can label itself; archive runs carry their own day.
			puzzleDate: puzzleDate ?? (mode === 'daily' ? productDayKey() : undefined),
			attempts: stats.attempts,
			maxAttempts: stats.maxAttempts,
			mistakes: stats.mistakes,
			score: stats.score,
			timeSpentMs: stats.timeSpentMs,
			currentStreak,
			pattern,
		})

	// The same sentence the share fallback copies; also the card's accessible text.
	const cardAltText = resultCardTextAlternative(buildCard(), cardStrings)

	const handleShareCard = async () => {
		if (cardBusy) return
		setCardBusy(true)
		setCardNotice(null)
		try {
			const result = await shareRitualResultCard({
				model: buildCard(),
				strings: cardStrings,
				title: tShare('card.title'),
			})
			if (result.outcome === 'downloaded') setCardNotice(tShare('card.downloaded'))
			else if (result.outcome === 'copied') setCardNotice(tShare('card.copied'))
			else if (result.outcome === 'unavailable') setCardNotice(tShare('card.unavailable'))
		} finally {
			setCardBusy(false)
		}
	}

	// Fetch percentile for daily mode wins
	const { data: percentileData } = useTodayPercentile(
		{
			gameSlug: gameType,
			status,
			attempts: stats.attempts,
			score: stats.score,
			mistakes: stats.mistakes,
		},
		{
			enabled: mode === 'daily' && isWin,
			staleTime: 1000 * 60 * 5, // Cache for 5 minutes
		},
	)

	// Check if this is a perfect game - config-driven (using client-safe registry)
	const config = getHowToPlayConfig(gameType)
	const isPerfect = isWin && config?.isPerfectGame?.(stats)

	// Format time spent
	const formatTime = (ms: number) => {
		const seconds = Math.floor(ms / 1000)
		if (seconds < 60) return `${seconds}s`
		const minutes = Math.floor(seconds / 60)
		const remainingSeconds = seconds % 60
		return `${minutes}m ${remainingSeconds}s`
	}

	// Build announcement message for screen readers
	const getAnnouncementMessage = () => {
		if (isWin) {
			if (stats.attempts !== undefined) {
				return t('srWonWithAttempts', { attempts: stats.attempts })
			}
			if (stats.score !== undefined) {
				return t('srWonWithScore', { score: stats.score })
			}
			return t('congratulations')
		}
		if (solution) {
			return t('srLostWithSolution', { word: solution.toUpperCase() })
		}
		return t('gameOver')
	}

	return (
		<div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
			{/* Screen reader announcement */}
			<output aria-live="polite" className="sr-only">
				{getAnnouncementMessage()}
			</output>

			<div className="px-5 pb-5 pt-3 sm:p-6">
				{/* Header */}
				<div className="mb-6 text-center">
					<div
						className={cn(
							'mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl',
							isWin ? 'bg-accent-warm text-[#1a1712]' : 'bg-muted text-muted-foreground',
						)}
						aria-hidden="true"
					>
						{isWin ? <Trophy className="h-7 w-7" /> : <Target className="h-7 w-7" />}
					</div>
					<h3 className="font-display text-[1.75rem] leading-tight">
						{isWin ? t('congratulations') : t('gameOver')}
					</h3>
					{solution && !isWin && (
						<p className="mt-1 text-sm text-muted-foreground">
							{t('theWordWas', { word: solution.toUpperCase() })}
						</p>
					)}

					{/* Missed categories for Connections */}
					{missedCategories && missedCategories.length > 0 && !isWin && (
						<div className="mt-4 space-y-2">
							<p className="text-xs font-medium text-muted-foreground">{t('missedCategories')}</p>
							{missedCategories
								.sort((a, b) => a.level - b.level)
								.map((category) => {
									const colors = CATEGORY_COLORS[category.level]
									return (
										<div
											key={category.name}
											className={cn('rounded-lg px-3 py-2 text-center', colors.bg, colors.text)}
										>
											<div className="text-xs font-bold uppercase">{category.name}</div>
											<div className="text-[10px] opacity-80">{category.words.join(', ')}</div>
										</div>
									)
								})}
						</div>
					)}

					{/* Competitive Framing - Show percentile for daily wins */}
					{mode === 'daily' && isWin && (
						<div className="mt-3 flex flex-col items-center gap-1">
							{isPerfect && (
								<span className="text-sm font-semibold text-correct animate-in fade-in duration-500">
									{t('perfectGame')}
								</span>
							)}
							{percentileData &&
								percentileData.percentile != null &&
								percentileData.percentile > 0 && (
									<span className="flex items-center gap-1.5 text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-2 duration-700">
										<Trophy className="h-3.5 w-3.5 text-accent-warm-foreground" />
										{percentileData.percentile >= 50
											? t('beatPercent', { percent: percentileData.percentile })
											: t('topPercent', {
													percent: 100 - percentileData.percentile,
												})}
									</span>
								)}
							{percentileData &&
								percentileData.totalPlayers != null &&
								percentileData.totalPlayers >= 10 && (
									<span className="flex items-center gap-1 text-xs text-muted-foreground/70">
										<Users className="h-3 w-3" />
										{t('playersToday', { count: percentileData.totalPlayers })}
									</span>
								)}
						</div>
					)}
				</div>

				{/* Stats Grid */}
				<div className="mb-6 flex divide-x divide-border rounded-2xl border border-border">
					{/* Attempts (Wordle/Connections) */}
					{stats.attempts !== undefined && stats.maxAttempts !== undefined && (
						<StatBox
							icon={<Target className="h-4 w-4" aria-hidden="true" />}
							label={t('attempts')}
							value={`${stats.attempts}/${stats.maxAttempts}`}
							highlight={isWin && stats.attempts <= 2}
						/>
					)}

					{/* Mistakes (Connections) */}
					{stats.mistakes !== undefined && (
						<StatBox
							icon={<BarChart3 className="h-4 w-4" aria-hidden="true" />}
							label={t('mistakes')}
							value={stats.mistakes.toString()}
							highlight={isWin && stats.mistakes === 0}
						/>
					)}

					{/* Time */}
					{stats.timeSpentMs !== undefined && (
						<StatBox
							icon={<Clock className="h-4 w-4" aria-hidden="true" />}
							label={t('time')}
							value={formatTime(stats.timeSpentMs)}
							highlight={false}
						/>
					)}
				</div>

				{/* Actions */}
				<div className="flex flex-col gap-2">
					{/* The card is the primary share; the text share stays beside it. */}
					<Button
						onClick={handleShareCard}
						className="w-full gap-2"
						size="lg"
						disabled={cardBusy}
						aria-busy={cardBusy}
					>
						<Image className="h-4 w-4" aria-hidden="true" />
						{tShare('card.share')}
					</Button>

					<Button onClick={onShare} variant="secondary" className="w-full gap-2" size="lg">
						<Share2 className="h-4 w-4" aria-hidden="true" />
						{tCommon('share')}
					</Button>

					{cardNotice && (
						<output className="block text-center text-xs text-muted-foreground">
							{cardNotice}
						</output>
					)}
					<p className="sr-only">{cardAltText}</p>

					<Link
						href="/"
						className="flex min-h-11 flex-1 items-center justify-center rounded-full px-4 text-[15px] font-medium text-muted-foreground transition-colors hover:text-foreground"
					>
						{t('backToHome')}
					</Link>
				</div>

				{/* Daily mode: Countdown to next puzzle */}
				{mode === 'daily' && (
					<div className="mt-4 border-t pt-4">
						<NextPuzzleCountdown variant="compact" className="justify-center" />
					</div>
				)}
			</div>
		</div>
	)
}

function StatBox({
	icon,
	label,
	value,
	highlight,
}: {
	icon: React.ReactNode
	label: string
	value: string
	highlight: boolean
}) {
	return (
		<div className="flex flex-1 flex-col items-center px-2 py-3">
			<span className={cn('font-display text-2xl leading-none tnum', highlight && 'text-success')}>
				{value}
			</span>
			<span className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
				{icon}
				{label}
			</span>
		</div>
	)
}
