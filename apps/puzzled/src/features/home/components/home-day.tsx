import { ArrowRight, Flame, Users } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { DayCountdown } from '@/features/home/components/day-countdown'
import { type GameColorTheme, getGameColors } from '@/games/theme-colors'
import { Link } from '@/lib/i18n/routing'
import { cn, formatNumber } from '@/lib/utils'
import { GameIcon } from '@/shared/components/ui/game-icons'

/** Today's module, as the day surface needs it. */
export type HomeDayGame = {
	slug: string
	name: string
	theme: GameColorTheme
	/** One line on what the game is, from the game's own copy. */
	tagline?: string
	/** Typical duration from the module config, e.g. "~10 min". */
	duration?: string
}

type HomeDayProps = {
	locale: string
	/** Product day (Asia/Hong_Kong) formatted for the viewer's locale. */
	dateLabel: string
	/** `getPuzzleNumber` for today's module. */
	puzzleNumber: number
	freeGame: HomeDayGame
	isMember: boolean
	currentStreak: number
	hasPlayedToday: boolean
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
	'locale' | 'dateLabel' | 'puzzleNumber' | 'freeGame'
>

/**
 * The day surface: the home page's first screen.
 *
 * A newspaper masthead (the product day, the puzzle number, the clock to the
 * next day), a display headline, and one card in today's game colour that
 * holds the only primary action. `playerCount` stays `null` until the read
 * lands, and a landed zero renders nothing: a visitor is never told that
 * nobody is playing.
 *
 * LCP: the headline paints in the first frame with no entrance animation;
 * motion is kept to the card.
 */
export async function HomeDay({
	locale,
	dateLabel,
	puzzleNumber,
	freeGame,
	isMember,
	currentStreak,
	hasPlayedToday,
	completedCount,
	availableCount,
	playerCount,
	progressUnverified,
}: HomeDayProps) {
	const t = await getTranslations('home')
	const allDone = availableCount > 0 && completedCount >= availableCount
	const showsProgress = isMember && availableCount > 0

	const headline = isMember
		? allDone
			? t('day.titleMemberDone')
			: currentStreak > 0 && !hasPlayedToday
				? t('day.titleMemberStreak', { days: currentStreak })
				: t('day.titleMemberReady', { game: freeGame.name })
		: t('day.title', { game: freeGame.name })

	return (
		<section className="day-surface relative">
			<div className="page-shell-wide pt-5 md:pt-8">
				{/* Masthead: the day has an identity. */}
				<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-foreground/80 pb-2.5 text-[13px] text-muted-foreground">
					<p className="flex items-center gap-2">
						<span className="font-semibold text-foreground">{dateLabel}</span>
						<span aria-hidden="true">·</span>
						<span className="day-numeral">{t('day.puzzleNumber', { number: puzzleNumber })}</span>
					</p>
					<p className="flex items-center gap-1.5">
						<span>{t('day.resetsIn')}</span>
						<DayCountdown className="font-semibold text-foreground" />
					</p>
				</div>

				<div className="grid items-center gap-6 pb-10 pt-6 md:gap-10 md:pb-14 md:pt-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
					<div>
						{isMember && currentStreak > 0 ? (
							<p className="eyebrow flex items-center gap-1.5 text-stat-streak">
								<Flame className="h-3.5 w-3.5" aria-hidden="true" />
								{t('hero.streakChip', { days: currentStreak })}
							</p>
						) : (
							<p className="eyebrow">{t('day.freeToday')}</p>
						)}

						<h1 className="mt-2 font-display text-[2.375rem] leading-[1.04] text-balance sm:text-5xl lg:text-[4rem]">
							{headline}
						</h1>

						<p className="mt-4 max-w-lg text-[17px] leading-relaxed text-muted-foreground">
							{isMember ? t('day.bodyMember') : t('day.bodyGuest')}
						</p>

						<div className="mt-5 hidden flex-col gap-2 text-sm text-muted-foreground lg:flex">
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

					<div>
						<FeaturedCard
							game={freeGame}
							numberLabel={t('day.puzzleNumber', { number: puzzleNumber })}
							label={t('day.freeToday')}
							cta={allDone ? t('day.playAgain') : t('day.playToday', { game: freeGame.name })}
						/>
						<div className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground lg:hidden">
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
						<Link
							href="/games"
							className="mt-3 inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-muted-foreground transition-colors hover:text-foreground"
						>
							{t('day.browseAll')}
							<ArrowRight className="h-4 w-4" aria-hidden="true" />
						</Link>
					</div>
				</div>
			</div>
		</section>
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
			{playerCount !== null && playerCount > 0 ? (
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
 * Today's game as one card: its colour field with the glyph, the number and
 * the name, then the play action. The field is decorative; the button carries
 * the accessible name.
 */
function FeaturedCard({
	game,
	numberLabel,
	label,
	cta,
}: {
	game: HomeDayGame
	numberLabel: string
	label: string
	cta: string
}) {
	const colors = getGameColors(game.theme)
	return (
		<div className="animate-enter overflow-hidden rounded-3xl border border-border bg-card shadow-lg">
			<div
				className={cn(
					'relative flex h-44 items-center justify-center sm:h-56',
					colors.bg,
					colors.onField,
				)}
				aria-hidden="true"
			>
				<GameIcon
					slug={game.slug}
					size={96}
					className="drop-shadow-[0_1px_0_rgb(255_255_255/0.4)]"
				/>
				<span className="absolute left-4 top-4 rounded-full bg-[#1a1712] px-2.5 py-1 text-xs font-semibold text-[#fbf9f4]">
					{label}
				</span>
				<span className="numeral absolute right-4 top-4 text-xs font-semibold opacity-70">
					{numberLabel}
				</span>
			</div>
			<div className="p-5 sm:p-6">
				<p className="font-display text-2xl leading-tight">{game.name}</p>
				{game.tagline ? (
					<p className="mt-1 text-[15px] text-muted-foreground">
						{game.tagline}
						{game.duration ? <span className="numeral"> · {game.duration}</span> : null}
					</p>
				) : null}
				<Link
					href={`/games/${game.slug}`}
					className="pressable mt-5 flex h-12 w-full items-center justify-center rounded-full bg-primary px-6 text-[16px] font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
				>
					{cta}
				</Link>
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
 * the real day's geometry, so nothing moves when it lands.
 */
export function HomeDaySkeleton() {
	return (
		<section className="day-surface relative" aria-busy="true">
			<div className="page-shell-wide pt-5 md:pt-8">
				<div className="flex items-center justify-between border-b border-foreground/80 pb-2.5">
					<div className="h-4 w-52 animate-pulse rounded bg-muted" />
					<div className="h-4 w-28 animate-pulse rounded bg-muted" />
				</div>
				<div className="grid items-center gap-6 pb-10 pt-6 md:gap-10 md:pb-14 md:pt-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
					<div>
						<div className="h-3 w-24 animate-pulse rounded bg-muted" />
						<div className="mt-3 h-10 w-full animate-pulse rounded-lg bg-muted sm:h-12" />
						<div className="mt-2 h-10 w-3/4 animate-pulse rounded-lg bg-muted sm:h-12" />
						<div className="mt-5 h-5 w-full animate-pulse rounded bg-muted" />
						<div className="mt-2 h-5 w-2/3 animate-pulse rounded bg-muted" />
					</div>
					<div className="overflow-hidden rounded-3xl border border-border bg-card">
						<div className="h-44 animate-pulse bg-muted sm:h-56" />
						<div className="p-5 sm:p-6">
							<div className="h-7 w-40 animate-pulse rounded bg-muted" />
							<div className="mt-2 h-4 w-56 animate-pulse rounded bg-muted" />
							<div className="mt-5 h-12 w-full animate-pulse rounded-full bg-muted" />
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}
