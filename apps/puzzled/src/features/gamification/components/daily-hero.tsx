'use client'

import { Calendar, Check, Clock, Lock, Play, Sparkles, Target, TrendingUp, Zap } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { NextPuzzleCountdown } from '@/features/daily/components'
import { DEFAULT_GAME_COLORS, getGameColors } from '@/games/theme-colors'
import type { GameDisplayMeta } from '@/games/types'
import { Link } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'
import { Card } from '@sylphx/ui'
import { GameIcon } from '@/shared/components/ui/game-icons'

type GameInfo = {
	slug: string
	name: string
	completed: boolean
	score?: string
	locked?: boolean
	isFreeToday?: boolean
	display: GameDisplayMeta
}

type DailyHeroProps = {
	games: GameInfo[]
	/** Display date string (e.g., "Wednesday, December 18, 2024") */
	dateString: string
	/** Tomorrow's free game name for teaser */
	tomorrowsFreeGameName?: string
	/** User's current streak for personalized messaging */
	currentStreak?: number
	className?: string
}

// Decorative icons for each game
const GAME_DECORATIONS: Record<string, React.ReactNode> = {
	wordle: (
		<div className="absolute -right-4 -top-4 grid grid-cols-3 gap-0.5 opacity-10">
			{Array.from({ length: 15 }).map((_, i) => (
				<div key={i} className="h-3 w-3 rounded-sm bg-current" />
			))}
		</div>
	),
	connections: (
		<div className="absolute -right-2 -top-2 grid grid-cols-2 gap-1 opacity-10">
			{Array.from({ length: 4 }).map((_, i) => (
				<div key={i} className="h-5 w-5 rounded-lg bg-current" />
			))}
		</div>
	),
	'spelling-bee': (
		<div className="absolute -right-3 -top-3 opacity-10">
			<div
				className="h-12 w-12 rotate-12 rounded-lg bg-current"
				style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
			/>
		</div>
	),
	crossword: (
		<div className="absolute -right-4 -top-4 grid grid-cols-3 gap-0.5 opacity-10">
			{[1, 1, 0, 1, 1, 1, 0, 1, 1].map((filled, i) => (
				<div key={i} className={`h-3 w-3 ${filled ? 'bg-current' : ''}`} />
			))}
		</div>
	),
	sudoku: (
		<div className="absolute -right-3 -top-3 grid grid-cols-3 gap-0.5 rounded border border-current/30 p-0.5 opacity-10">
			{Array.from({ length: 9 }).map((_, i) => (
				<div key={i} className="h-2.5 w-2.5 bg-current" />
			))}
		</div>
	),
	nonogram: (
		<div className="absolute -right-3 -top-3 grid grid-cols-4 gap-0.5 opacity-10">
			{[1, 0, 1, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0].map((filled, i) => (
				<div key={i} className={`h-2.5 w-2.5 ${filled ? 'bg-current' : ''}`} />
			))}
		</div>
	),
	'word-ladder': (
		<div className="absolute -right-2 -top-2 flex flex-col gap-0.5 opacity-10">
			{Array.from({ length: 4 }).map((_, i) => (
				<div key={i} className="h-2 w-8 rounded-sm bg-current" />
			))}
		</div>
	),
	arithmo: (
		<div className="absolute -right-4 -top-4 flex gap-0.5 opacity-10">
			{Array.from({ length: 8 }).map((_, i) => (
				<div key={i} className="h-8 w-3 rounded-sm bg-current" />
			))}
		</div>
	),
	'pattern-match': (
		<div className="absolute -right-3 -top-3 grid grid-cols-3 gap-1 opacity-10">
			{Array.from({ length: 9 }).map((_, i) => (
				<div key={i} className="h-3 w-3 rounded bg-current" />
			))}
		</div>
	),
	'block-slide': (
		<div className="absolute -right-3 -top-3 grid grid-cols-2 gap-0.5 opacity-10">
			<div className="col-span-2 h-4 w-8 rounded bg-current" />
			<div className="h-6 w-4 rounded bg-current" />
			<div className="h-6 w-4 rounded bg-current" />
		</div>
	),
	queens: (
		<div className="absolute -right-3 -top-3 grid grid-cols-3 gap-1 opacity-10">
			{Array.from({ length: 9 }).map((_, i) => (
				<div key={i} className={`h-3 w-3 rounded-sm ${i % 4 === 0 ? 'bg-current' : ''}`} />
			))}
		</div>
	),
	nerdle: (
		<div className="absolute -right-4 -top-4 flex gap-0.5 opacity-10">
			{Array.from({ length: 8 }).map((_, i) => (
				<div key={i} className="h-6 w-3 rounded-sm bg-current" />
			))}
		</div>
	),
	tango: (
		<div className="absolute -right-3 -top-3 grid grid-cols-2 gap-1 opacity-10">
			<div className="h-5 w-5 rounded-full bg-current" />
			<div className="h-5 w-5 rounded-full border-2 border-current" />
			<div className="h-5 w-5 rounded-full border-2 border-current" />
			<div className="h-5 w-5 rounded-full bg-current" />
		</div>
	),
	'letter-boxed': (
		<div className="absolute -right-3 -top-3 flex flex-col gap-0.5 opacity-10">
			<div className="flex gap-0.5">
				<div className="h-2 w-2 rounded-sm bg-current" />
				<div className="h-2 w-2 rounded-sm bg-current" />
				<div className="h-2 w-2 rounded-sm bg-current" />
			</div>
			<div className="flex gap-0.5">
				<div className="h-2 w-2 rounded-sm bg-current" />
				<div className="h-6 w-6 border border-current" />
				<div className="h-2 w-2 rounded-sm bg-current" />
			</div>
			<div className="flex gap-0.5">
				<div className="h-2 w-2 rounded-sm bg-current" />
				<div className="h-2 w-2 rounded-sm bg-current" />
				<div className="h-2 w-2 rounded-sm bg-current" />
			</div>
		</div>
	),
	quordle: (
		<div className="absolute -right-3 -top-3 grid grid-cols-2 gap-1 opacity-10">
			{Array.from({ length: 4 }).map((_, i) => (
				<div key={i} className="grid grid-cols-3 gap-0.5">
					{Array.from({ length: 6 }).map((_, j) => (
						<div key={j} className="h-1.5 w-1.5 rounded-sm bg-current" />
					))}
				</div>
			))}
		</div>
	),
	'killer-sudoku': (
		<div className="absolute -right-3 -top-3 grid grid-cols-3 gap-0.5 rounded border-2 border-dashed border-current/30 p-0.5 opacity-10">
			{Array.from({ length: 9 }).map((_, i) => (
				<div key={i} className="h-2.5 w-2.5 bg-current" />
			))}
		</div>
	),
	worldle: (
		<div className="absolute -right-3 -top-3 opacity-10">
			<div className="h-10 w-10 rounded-full border-2 border-current" />
		</div>
	),
}

/**
 * DailyHero - Featured daily challenge card
 *
 * Shows:
 * - Today's date and puzzle number
 * - All available games with completion status
 * - Quick access to play uncompleted games
 * - Countdown to next puzzle
 */
type TimeGreeting = 'morning' | 'afternoon' | 'evening' | 'night'

/**
 * Get time-based greeting key based on hour
 */
function getTimeGreetingFromHour(hour: number): TimeGreeting {
	if (hour >= 5 && hour < 12) return 'morning'
	if (hour >= 12 && hour < 17) return 'afternoon'
	if (hour >= 17 && hour < 22) return 'evening'
	return 'night'
}

/**
 * Get streak-based message key
 */
function getStreakMessageKey(streak: number): 'none' | 'low' | 'medium' | 'high' | 'legend' {
	if (streak === 0) return 'none'
	if (streak <= 3) return 'low'
	if (streak <= 7) return 'medium'
	if (streak <= 30) return 'high'
	return 'legend'
}

export function DailyHero({
	games,
	dateString,
	tomorrowsFreeGameName,
	currentStreak = 0,
	className,
}: DailyHeroProps) {
	const t = useTranslations()
	const completedCount = games.filter((g) => g.completed).length
	const allCompleted = completedCount === games.length

	// Use static greeting on server, update on client to avoid hydration mismatch
	const [timeGreeting, setTimeGreeting] = useState<TimeGreeting>('morning')

	useEffect(() => {
		setTimeGreeting(getTimeGreetingFromHour(new Date().getHours()))
	}, [])

	const streakMessage = getStreakMessageKey(currentStreak)

	return (
		<div className={cn('space-y-4', className)}>
			{/* Header Card */}
			<Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-background via-background to-primary/5">
				<div className="px-4 py-4 sm:px-5">
					<div className="flex items-start justify-between gap-3">
						{/* Left: Greeting + Date */}
						<div className="min-w-0 flex-1">
							<h2 className="text-lg font-bold sm:text-xl">
								{t(`home.greeting.${timeGreeting}`)} 👋
							</h2>
							<p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
								<span className="flex items-center gap-1.5">
									<Calendar className="h-4 w-4 shrink-0" />
									<span>{dateString}</span>
								</span>
								{currentStreak > 0 && (
									<span className="font-medium text-stat-streak">
										• {t(`home.streakMessage.${streakMessage}`)}
									</span>
								)}
							</p>
						</div>

						{/* Right: Progress Badge - Compact */}
						<div className="flex shrink-0 flex-col items-center">
							<div
								className={cn(
									'flex h-11 min-w-11 items-center justify-center rounded-xl px-2',
									allCompleted
										? 'bg-gradient-to-br from-emerald-500 to-green-600'
										: 'bg-gradient-to-br from-primary to-primary/80',
								)}
							>
								<span className="text-base font-bold text-white">
									{completedCount}/{games.length}
								</span>
							</div>
							<p className="mt-1 whitespace-nowrap text-[10px] text-muted-foreground">
								{t('daily.todaysProgress')}
							</p>
						</div>
					</div>

					{/* Progress bar */}
					<div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
						<div
							className={cn(
								'h-full rounded-full transition-all duration-500',
								allCompleted
									? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
									: 'bg-gradient-to-r from-primary to-primary/70',
							)}
							style={{ width: `${(completedCount / games.length) * 100}%` }}
						/>
					</div>
				</div>
			</Card>

			{/* Game Cards Grid */}
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{games.map((game) => {
					// Get display info from props (SSOT from registry)
					const { display } = game
					const colors = display.theme ? getGameColors(display.theme) : DEFAULT_GAME_COLORS
					const decoration = GAME_DECORATIONS[game.slug]

					return (
						<Link key={game.slug} href={`/games/${game.slug}`} className="group block">
							<Card
								className={cn(
									'relative h-full overflow-hidden transition-all duration-200',
									'hover:shadow-lg hover:scale-[1.02]',
									game.completed
										? 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent'
										: 'hover:border-primary/40',
								)}
							>
								{/* Background pattern */}
								<div className={cn('absolute inset-0', colors.pattern)} />

								{/* Decoration */}
								<div className={colors.text}>{decoration}</div>

								<div className="relative p-4">
									{/* Header row: Icon + Badge */}
									<div className="mb-3 flex items-start justify-between">
										<div
											className={cn(
												'flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg',
												colors.gradient,
												game.completed && 'opacity-70',
											)}
										>
											<GameIcon slug={game.slug} size={28} className="text-white" />
										</div>

										{/* Status Badge */}
										{game.completed ? (
											<div className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
												<Check className="h-3.5 w-3.5" />
												<span>{t('daily.completed')}</span>
											</div>
										) : game.isFreeToday ? (
											<div className="flex items-center gap-1 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
												<Sparkles className="h-3 w-3" />
												<span>{t('daily.freeToday')}</span>
											</div>
										) : game.locked ? (
											<div className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
												<Lock className="h-3 w-3" />
												<span>Premium</span>
											</div>
										) : null}
									</div>

									{/* Game name */}
									<h3
										className={cn(
											'text-lg font-bold',
											game.completed ? 'text-muted-foreground' : 'text-foreground',
										)}
									>
										{game.name}
									</h3>

									{/* Tagline */}
									<p className="mt-1 text-sm text-muted-foreground">{t(display.taglineKey)}</p>

									{/* Stats row or Score */}
									<div className="mt-3 flex items-center gap-3">
										{game.completed && game.score ? (
											<div className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
												<TrendingUp className="h-4 w-4" />
												<span>{game.score}</span>
											</div>
										) : (
											<>
												<div className="flex items-center gap-1 text-xs text-muted-foreground">
													<Clock className="h-3.5 w-3.5" />
													<span>{display.duration}</span>
												</div>
												<div className="flex items-center gap-1 text-xs text-muted-foreground">
													<Target className="h-3.5 w-3.5" />
													<span>{t(display.highlightKey)}</span>
												</div>
											</>
										)}
									</div>

									{/* Play button */}
									{!game.completed && !game.locked && (
										<div className="mt-4">
											<div
												className={cn(
													'flex items-center justify-center gap-2 rounded-xl py-2.5 font-semibold text-white transition-all',
													'bg-gradient-to-r shadow-md',
													colors.gradient,
													'group-hover:shadow-lg group-hover:scale-[1.02]',
												)}
											>
												<Play className="h-4 w-4" />
												<span>{t('common.play')}</span>
											</div>
										</div>
									)}

									{/* Locked overlay hint */}
									{game.locked && (
										<div className="mt-4">
											<div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-muted-foreground/30 bg-muted/50 py-2.5 text-sm text-muted-foreground">
												<Zap className="h-4 w-4" />
												<span>{t('daily.unlockWithPremium')}</span>
											</div>
										</div>
									)}

									{/* Completed: Play again hint */}
									{game.completed && (
										<div className="mt-4">
											<div className="flex items-center justify-center gap-2 rounded-xl bg-muted/50 py-2.5 text-sm text-muted-foreground transition-colors group-hover:bg-muted">
												<Check className="h-4 w-4 text-emerald-500" />
												<span>{t('daily.viewResult')}</span>
											</div>
										</div>
									)}
								</div>
							</Card>
						</Link>
					)
				})}
			</div>

			{/* Footer - Countdown + Tomorrow's Free Game Teaser */}
			<Card className="border-primary/10 bg-muted/30">
				<div className="px-4 py-3 sm:px-5">
					<div className="flex flex-col items-center gap-1.5 sm:flex-row sm:justify-between">
						<NextPuzzleCountdown variant="compact" className="justify-center" />
						{tomorrowsFreeGameName && (
							<p className="flex items-center gap-1.5 text-xs text-muted-foreground">
								<Sparkles className="h-3.5 w-3.5 text-emerald-500" />
								<span>{t('daily.tomorrowsFreeGame', { game: tomorrowsFreeGameName })}</span>
							</p>
						)}
					</div>
				</div>
			</Card>
		</div>
	)
}
