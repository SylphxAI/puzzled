'use client'

import { BarChart3, Clock, Share2, Target, Trophy, Users } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { NextPuzzleCountdown } from '@/features/daily/components/next-puzzle-countdown'
import { type GameSlug, getGameConfig } from '@/games/registry'
import { Link } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'
import { Button } from '@/shared/components/ui'
import { trpc } from '@/trpc/client'

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
}

// Category colors for displaying missed categories
const CATEGORY_COLORS: Record<0 | 1 | 2 | 3, { bg: string; text: string }> = {
	0: { bg: 'bg-yellow-300', text: 'text-yellow-900' },
	1: { bg: 'bg-emerald-400', text: 'text-emerald-950' },
	2: { bg: 'bg-sky-400', text: 'text-sky-950' },
	3: { bg: 'bg-violet-400', text: 'text-violet-950' },
}

export function GameResultCard({
	gameType,
	status,
	stats,
	solution,
	mode,
	onShare,
	missedCategories,
}: GameResultProps) {
	const _locale = useLocale()
	const t = useTranslations('gameResult')
	const tCommon = useTranslations('common')

	const isWin = status === 'won'

	// Fetch percentile for daily mode wins
	const { data: percentileData } = trpc.stats.getTodayPercentile.useQuery(
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

	// Check if this is a perfect game - config-driven
	const config = getGameConfig(gameType)
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

			<div
				className={cn(
					'rounded-2xl border-2 p-6',
					isWin
						? 'border-correct/30 bg-gradient-to-b from-correct/10 to-correct/5'
						: 'border-muted bg-gradient-to-b from-muted/50 to-muted/30',
				)}
			>
				{/* Header */}
				<div className="mb-6 text-center">
					<div
						className={cn(
							'mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full',
							isWin ? 'bg-correct/20' : 'bg-muted',
						)}
						aria-hidden="true"
					>
						{isWin ? (
							<Trophy className="h-8 w-8 text-correct" />
						) : (
							<Target className="h-8 w-8 text-muted-foreground" />
						)}
					</div>
					<h3 className={cn('text-xl font-bold', isWin ? 'text-correct' : 'text-muted-foreground')}>
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
							{percentileData && percentileData.percentile > 0 && (
								<span className="flex items-center gap-1.5 text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-2 duration-700">
									<Trophy className="h-3.5 w-3.5 text-amber-500" />
									{percentileData.percentile >= 50
										? t('beatPercent', { percent: percentileData.percentile })
										: t('topPercent', { percent: 100 - percentileData.percentile })}
								</span>
							)}
							{percentileData && percentileData.totalPlayers >= 10 && (
								<span className="flex items-center gap-1 text-xs text-muted-foreground/70">
									<Users className="h-3 w-3" />
									{t('playersToday', { count: percentileData.totalPlayers })}
								</span>
							)}
						</div>
					)}
				</div>

				{/* Stats Grid */}
				<div className="mb-6 grid grid-cols-2 gap-3">
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
					<Button onClick={onShare} className="w-full gap-2" size="lg">
						<Share2 className="h-4 w-4" />
						{tCommon('share')}
					</Button>

					<Link
						href="/"
						className="flex flex-1 items-center justify-center rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
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
		<div
			className={cn(
				'flex flex-col items-center rounded-xl p-3',
				highlight ? 'bg-correct/10 text-correct' : 'bg-muted/50 text-muted-foreground',
			)}
		>
			<div className="mb-1 flex items-center gap-1.5">
				{icon}
				<span className="text-xs font-medium">{label}</span>
			</div>
			<span className={cn('text-lg font-bold', highlight ? 'text-correct' : 'text-foreground')}>
				{value}
			</span>
		</div>
	)
}
