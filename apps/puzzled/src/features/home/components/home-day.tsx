import { Flame, Play, Users } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { homeDayCopy } from '@/features/home/lib/home-day-copy'
import { type GameColorTheme, getGameColors } from '@/games/theme-colors'
import { Link } from '@/lib/i18n/routing'
import { cn, formatNumber } from '@/lib/utils'
import { GameMotif } from '@/shared/components/games/game-motif'

/** Today's module, as the day surface needs it. */
export type HomeDayGame = {
	slug: string
	name: string
	theme: GameColorTheme
	/** One line on what the game is, from the game's own copy. */
	tagline?: string
	/** Typical duration from the module config, e.g. "~10 min". */
	duration?: string
	/** Straight to today's board (`todayPlayPath`), not the game page's start card. */
	playHref: string
	/** Where the finished result is read (`todayResultPath`). */
	resultHref: string
}

/**
 * A finish count is shown only above this many players: a small number reads
 * as an empty room, not as proof.
 */
export const MIN_PLAYERS_SHOWN = 500

type HomeDayProps = {
	locale: string
	/** `getPuzzleNumber` for the server-rendered product day and module. */
	puzzleNumber: number
	freeGame: HomeDayGame
	/** Registered games; the hook never hardcodes the count. */
	gameCount: number
	/** Localised category names, the eyebrow over the hook. */
	categories: readonly string[]
	isMember: boolean
	currentStreak: number
	hasPlayedToday: boolean
	/** The server proved today's free module is finished for this viewer. */
	freeGameDone: boolean
	completedCount: number
	availableCount: number
	/** null = the social read has not landed: no count is claimed. */
	playerCount: number | null
	/** True when personal progress could not be read: never shown as zero. */
	progressUnverified: boolean
}

/** Everything the day renders before any identity or aggregate read lands. */
export type HomeDayStaticProps = Pick<
	HomeDayProps,
	'locale' | 'puzzleNumber' | 'freeGame' | 'gameCount' | 'categories'
>

/**
 * The day's lead column: the hook headline and today's featured game.
 *
 * It sits beside the full lineup in the home grid, under the masthead the
 * page renders. One card in today's game colour holds the only primary
 * action. `playerCount` stays `null` until the read lands, and a landed zero
 * renders nothing: a visitor is never told that nobody is playing.
 *
 * LCP: the headline paints in the first frame with no entrance animation.
 */
export async function HomeDay({
	locale,
	puzzleNumber,
	freeGame,
	gameCount,
	categories,
	isMember,
	currentStreak,
	hasPlayedToday,
	freeGameDone,
	completedCount,
	availableCount,
	playerCount,
	progressUnverified,
}: HomeDayProps) {
	const t = await getTranslations('home')
	const tResult = await getTranslations('gameResult')
	const allDone = availableCount > 0 && completedCount >= availableCount
	const showsProgress = isMember && availableCount > 0

	const copy = homeDayCopy({ isMember, allDone, freeGameDone, currentStreak, hasPlayedToday })
	const headline = t(`day.${copy.headlineKey}`, {
		game: freeGame.name,
		days: currentStreak,
		count: gameCount,
	})

	return (
		<div className="home-day-lead min-w-0">
			{isMember && currentStreak > 0 ? (
				<p className="eyebrow flex items-center gap-1.5 text-stat-streak">
					<Flame className="h-3.5 w-3.5" aria-hidden="true" />
					{t('hero.streakChip', { days: currentStreak })}
				</p>
			) : (
				<p className="eyebrow">{categories.join(' · ')}</p>
			)}

			<h1 className="mt-2 font-display text-[2.125rem] leading-[1.02] text-balance sm:text-5xl lg:text-[3.25rem] xl:text-[3.5rem]">
				{headline}
			</h1>

			<p className="home-day-description mt-3 max-w-lg text-[16px] leading-relaxed text-muted-foreground sm:text-[17px]">
				{isMember ? t('day.bodyMember') : t('day.bodyGuest')}
			</p>

			<div className="mt-5">
				<FeaturedCard
					game={freeGame}
					numberLabel={t('day.puzzleNumber', { number: puzzleNumber })}
					label={t('lineup.freeToday')}
					cta={
						copy.cta === 'result'
							? tResult('seeResult')
							: t('day.playToday', { game: freeGame.name })
					}
					href={copy.cta === 'result' ? freeGame.resultHref : freeGame.playHref}
					startIntent={copy.cta === 'play' ? freeGame.slug : undefined}
					note={copy.showsNote ? t('day.guestNote') : undefined}
				/>
				<div className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground empty:hidden">
					<DayFacts
						t={t as Translator}
						locale={locale}
						showsProgress={showsProgress}
						completedCount={completedCount}
						availableCount={availableCount}
						playerCount={playerCount}
						progressUnverified={progressUnverified}
					/>
				</div>
			</div>
		</div>
	)
}

type Translator = (key: string, values?: Record<string, string | number>) => string

function DayFacts({
	t,
	locale,
	showsProgress,
	completedCount,
	availableCount,
	playerCount,
	progressUnverified,
}: {
	t: Translator
	locale: string
	showsProgress: boolean
	completedCount: number
	availableCount: number
	playerCount: number | null
	progressUnverified: boolean
}) {
	return (
		<>
			{showsProgress ? (
				<p className="day-numeral">
					{t('hero.progressRingLabel', { done: completedCount, total: availableCount })}
				</p>
			) : null}
			{playerCount !== null && playerCount > MIN_PLAYERS_SHOWN ? (
				<p className="flex items-center gap-1.5">
					<Users className="h-4 w-4" aria-hidden="true" />
					{t('day.finishersToday', { count: formatNumber(playerCount, locale) })}
				</p>
			) : null}
			{progressUnverified ? (
				<p className="rounded-xl bg-accent-warm-soft px-3 py-2 text-accent-warm-foreground">
					{t('hero.progressUnverified')}
				</p>
			) : null}
		</>
	)
}

/**
 * Today's game as one tactile card: its colour field with the board
 * miniature, the name and the play action. The field is decorative; the
 * button carries the accessible name.
 */
function FeaturedCard({
	game,
	numberLabel,
	label,
	cta,
	href,
	startIntent,
	note,
}: {
	game: HomeDayGame
	numberLabel: string
	label: string
	cta: string
	href: string
	/** Set when the action starts today's board: the press is the explicit start. */
	startIntent?: string
	/** Reassurance under the action, shown to first-time visitors only. */
	note?: string
}) {
	const colors = getGameColors(game.theme)
	return (
		<div
			data-day-puzzle-card=""
			className="home-featured-card tactile-card grid grid-cols-[6.5rem_minmax(0,1fr)] overflow-hidden sm:block"
		>
			<div
				className={cn(
					'home-featured-art relative flex items-center justify-center border-r-[1.5px] border-[var(--tactile-line)] sm:border-b-[1.5px] sm:border-r-0',
					colors.bg,
				)}
				aria-hidden="true"
			>
				<GameMotif slug={game.slug} className="home-featured-motif" />
				<span className="absolute left-3 top-3 hidden rounded-full bg-[#1a1712] px-2.5 py-1 text-xs font-semibold text-[#fbf9f4] sm:block">
					{label}
				</span>
				<span className="numeral absolute right-3 top-3 hidden rounded-full bg-[#fbf9f4]/80 px-2 py-0.5 text-xs font-semibold text-[#1a1712] sm:block">
					{numberLabel}
				</span>
			</div>
			<div className="home-featured-content p-3 sm:p-5">
				<div className="flex items-baseline justify-between gap-3">
					<p className="home-featured-title font-display text-[1.375rem] leading-tight sm:text-[1.75rem]">
						{game.name}
					</p>
					{game.duration ? (
						<span className="numeral hidden shrink-0 text-sm text-muted-foreground sm:inline">
							{game.duration}
						</span>
					) : null}
				</div>
				{game.tagline ? (
					<p className="mt-0.5 line-clamp-1 text-[14px] text-muted-foreground sm:text-[15px]">
						{game.tagline}
					</p>
				) : null}
				<Link
					href={href}
					// The day's primary action: the install offer stays off it.
					data-day-primary-action=""
					data-start-intent={startIntent}
					className="pressable home-featured-action mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-[#1a1712] bg-cta px-4 text-[15px] font-bold text-cta-foreground shadow-[0_3px_0_0_#1a1712] transition-colors hover:bg-cta-hover sm:mt-4 sm:text-[16px]"
				>
					<Play className="h-4 w-4 shrink-0" fill="currentColor" aria-hidden="true" />
					<span className="truncate">{cta}</span>
				</Link>
				{note ? (
					<p className="mt-2 text-center text-xs text-muted-foreground sm:mt-2.5 sm:text-[13px]">
						{note}
					</p>
				) : null}
			</div>
		</div>
	)
}

/**
 * First paint for a first-time visitor: the same day surface with the facts a
 * visitor has: no streak, no personal numbers, no player count.
 */
export function HomeDayFallback(props: HomeDayStaticProps) {
	return (
		<HomeDay
			{...props}
			isMember={false}
			currentStreak={0}
			hasPlayedToday={false}
			freeGameDone={false}
			completedCount={0}
			availableCount={0}
			playerCount={null}
			progressUnverified={false}
		/>
	)
}

/**
 * Reserved space for viewers whose progress we owe but have not read yet. It
 * carries no copy (the guest variant would be wrong for a member) and matches
 * the real lead column's geometry, so nothing moves when it lands.
 */
export function HomeDaySkeleton() {
	return (
		<div className="home-day-lead min-w-0" aria-busy="true">
			<div className="h-3 w-40 animate-pulse rounded bg-muted" />
			<div className="mt-3 h-10 w-full animate-pulse rounded-lg bg-muted sm:h-12" />
			<div className="mt-2 h-10 w-3/4 animate-pulse rounded-lg bg-muted sm:h-12" />
			<div className="mt-4 h-5 w-full animate-pulse rounded bg-muted" />
			<div className="mt-5 overflow-hidden rounded-[1.125rem] border border-border bg-card">
				<div className="h-28 animate-pulse bg-muted sm:h-52" />
				<div className="p-4 sm:p-5">
					<div className="h-7 w-40 animate-pulse rounded bg-muted" />
					<div className="mt-4 h-12 w-full animate-pulse rounded-xl bg-muted" />
				</div>
			</div>
		</div>
	)
}
