import { ArrowRight, Calendar, Clock, Flame, Play, Users } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { DayCountdown } from '@/features/home/components/day-countdown'
import { type GameColorTheme, getGameColors } from '@/games/theme-colors'
import { Link } from '@/lib/i18n/routing'
import { cn, formatNumber } from '@/lib/utils'
import { GameIcon } from '@/shared/components/ui/game-icons'

/** Today's module, as the day surface needs it: no pitch, no metadata rows. */
export type HomeDayGame = {
	slug: string
	name: string
	theme: GameColorTheme
}

type HomeDayProps = {
	locale: string
	/** Product day (Asia/Hong_Kong) formatted for the viewer's locale. */
	dateLabel: string
	/** `getPuzzleNumber` for today's module — the day has an identity, so it shows. */
	puzzleNumber: number
	freeGame: HomeDayGame
	isMember: boolean
	currentStreak: number
	hasPlayedToday: boolean
	completedCount: number
	availableCount: number
	/** null = the social proof read has not landed: no count is claimed. */
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
 * The day surface — the home page's first screen.
 *
 * It is the day, not the pitch: the product day, the module's puzzle number and
 * the time left in the day lead; exactly one primary action follows; the
 * module's own visuals carry the fold beside it. The three trust bullets that
 * used to sit here moved below the day, and an empty board is never the default
 * — `playerCount` is `null` until the read lands, and a visitor is never told
 * that nobody is playing.
 *
 * LCP discipline is inherited from the composition this replaces: the fold text
 * paints in the first frame with no entrance animation. Chrome only counts text
 * as an LCP candidate once it is painted at full opacity, so animating the hero
 * hands the slot to whatever else paints first (the consent bar, on this page).
 * Motion stays on the board preview beside it.
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
	const colors = getGameColors(freeGame.theme)
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
		<section className="day-surface relative overflow-hidden border-b border-border/60 bg-aurora">
			<div className="page-shell-wide pb-10 pt-8 md:pb-16 md:pt-14">
				<div className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
					{/* The day itself, painted in the first frame. */}
					<div>
						<p className="flex flex-wrap items-center gap-2 text-sm">
							<span className="day-chip">
								<Calendar className="h-3.5 w-3.5" aria-hidden="true" />
								{dateLabel}
							</span>
							<span className="day-chip day-numeral font-semibold">
								{t('day.puzzleNumber', { number: puzzleNumber })}
							</span>
							{isMember && currentStreak > 0 ? (
								<span className="day-chip day-numeral font-semibold">
									<Flame className="h-3.5 w-3.5" aria-hidden="true" />
									{t('hero.streakChip', { days: currentStreak })}
								</span>
							) : (
								<span className="day-chip">{t('day.freeToday')}</span>
							)}
						</p>

						<h1 className="mt-4 font-display text-[2rem] font-extrabold leading-[1.08] tracking-tight text-balance sm:text-[2.5rem] lg:text-[3rem]">
							<span className="text-gradient">{headline}</span>
						</h1>

						<p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
							{isMember ? t('day.bodyMember') : t('day.bodyGuest')}
						</p>

						{/* The day ends: a product-day clock, not a UTC one. */}
						<p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
							<Clock className="h-4 w-4 text-accent-warm" aria-hidden="true" />
							<span>{t('day.resetsIn')}</span>
							<DayCountdown className="font-semibold text-accent-warm-foreground" />
							<span aria-hidden="true">·</span>
							<span>{t('day.resetsAt')}</span>
						</p>

						{/* Exactly one primary action, then a quiet way out. */}
						<div className="mt-6 flex flex-col items-start gap-3">
							<Link
								href={`/games/${freeGame.slug}`}
								className="inline-flex h-12 items-center gap-2 rounded-2xl bg-primary px-6 font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:-translate-y-0.5 hover:bg-primary-hover active:scale-[0.98]"
							>
								<Play className="h-4 w-4" aria-hidden="true" />
								{allDone ? t('day.playAgain') : t('day.playToday', { game: freeGame.name })}
							</Link>
							<Link
								href="/games"
								className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
							>
								{t('day.browseAll')}
								<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
							</Link>
						</div>

						<div className="mt-5 flex flex-col gap-2 text-xs text-muted-foreground">
							{showsProgress ? (
								<p className="day-numeral">
									{t('hero.progressRingLabel', {
										done: completedCount,
										total: availableCount,
									})}
								</p>
							) : null}
							{/*
							 * Social presence, inverted: a visitor is never told that
							 * nobody is playing. The count renders only once a read
							 * has landed and has something to say.
							 */}
							{playerCount !== null && playerCount > 0 ? (
								<p className="flex items-center gap-1.5">
									<Users className="h-3.5 w-3.5" aria-hidden="true" />
									{t('day.finishersToday', {
										count: formatNumber(playerCount, locale),
									})}
								</p>
							) : null}
							{progressUnverified ? (
								<p className="rounded-xl bg-accent-warm-soft px-3 py-2 text-accent-warm-foreground">
									{t('hero.progressUnverified')}
								</p>
							) : null}
						</div>
					</div>

					<div
						className="animate-enter"
						style={{ '--enter-delay': '120ms' } as React.CSSProperties}
					>
						<DayBoardPreview
							slug={freeGame.slug}
							name={freeGame.name}
							colors={colors}
							label={t('day.previewLabel')}
							note={t('day.previewNote', { game: freeGame.name })}
						/>
					</div>
				</div>
			</div>
		</section>
	)
}

/**
 * The module's own board, unspoiled.
 *
 * A tile motif in the module's theme — it shows the shape of the puzzle and
 * nothing about the answer, which is the whole point of a shareable ritual: the
 * grid is decorative to assistive technology and the caption says so.
 */
function DayBoardPreview({
	slug,
	name,
	colors,
	label,
	note,
}: {
	slug: string
	name: string
	colors: ReturnType<typeof getGameColors>
	label: string
	note: string
}) {
	return (
		<figure className="relative overflow-hidden rounded-3xl border border-border/70 bg-card p-5 shadow-glow md:p-6">
			<div
				className={cn('pointer-events-none absolute inset-0 opacity-80', colors.pattern)}
				aria-hidden="true"
			/>
			<div className="relative flex items-center gap-3">
				<span
					className={cn(
						'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md',
						colors.gradient,
					)}
				>
					<GameIcon slug={slug} size={24} />
				</span>
				<span className="min-w-0">
					<span className="day-chip day-label block">{label}</span>
					<span className="day-display mt-1 block truncate text-xl font-extrabold">{name}</span>
				</span>
			</div>

			<ul className="relative mt-5 grid grid-cols-6 gap-1.5" aria-hidden="true">
				{Array.from({ length: 36 }, (_, index) => (
					<li
						// Decorative motif: the index is the whole identity of a tile.
						key={index}
						className={cn('day-tile aspect-square', index % 4 === 0 ? colors.bgLight : null)}
					/>
				))}
			</ul>

			<figcaption className="relative mt-4 text-xs leading-relaxed text-muted-foreground">
				{note}
			</figcaption>
		</figure>
	)
}

/**
 * First paint for a first-time visitor: the same day surface with the facts a
 * visitor honestly has — no streak, no personal numbers, no player count.
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
 * Reserved space for viewers whose progress Identity owns but we have not read
 * yet (a session or guest cookie is present).
 *
 * It carries no copy at all: the guest variant is wrong for a signed-in member,
 * and zeros would be a claim we cannot back. The blocks match the real day's
 * geometry so the arrival of the real content does not move the page.
 */
export function HomeDaySkeleton() {
	return (
		<section
			className="day-surface relative overflow-hidden border-b border-border/60 bg-aurora"
			aria-busy="true"
		>
			<div className="page-shell-wide pb-10 pt-8 md:pb-16 md:pt-14">
				<div className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
					<div>
						<div className="h-7 w-64 animate-pulse rounded-full bg-muted" />
						<div className="mt-6 h-8 w-full animate-pulse rounded-lg bg-muted sm:h-10" />
						<div className="mt-3 h-8 w-4/5 animate-pulse rounded-lg bg-muted sm:h-10" />
						<div className="mt-6 h-5 w-full animate-pulse rounded bg-muted" />
						<div className="mt-2 h-5 w-3/4 animate-pulse rounded bg-muted" />
						<div className="mt-6 h-12 w-56 animate-pulse rounded-2xl bg-muted" />
						<div className="mt-3 h-4 w-32 animate-pulse rounded bg-muted" />
						<div className="mt-5 h-4 w-40 animate-pulse rounded bg-muted" />
					</div>

					<div className="rounded-3xl border border-border/70 bg-card p-5 shadow-glow md:p-6">
						<div className="flex items-center gap-3">
							<div className="h-12 w-12 shrink-0 animate-pulse rounded-2xl bg-muted" />
							<div className="min-w-0 flex-1">
								<div className="h-4 w-28 animate-pulse rounded bg-muted" />
								<div className="mt-2 h-6 w-36 animate-pulse rounded bg-muted" />
							</div>
						</div>
						<div className="mt-5 grid grid-cols-6 gap-1.5">
							{Array.from({ length: 36 }, (_, index) => (
								<div key={index} className="day-tile aspect-square animate-pulse bg-muted" />
							))}
						</div>
						<div className="mt-4 h-4 w-3/4 animate-pulse rounded bg-muted" />
					</div>
				</div>
			</div>
		</section>
	)
}
