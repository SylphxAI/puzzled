import { ArrowRight, Calendar, Check, Clock, Flame, Play, Sparkles, Users } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { type GameColorTheme, getGameColors } from '@/games/theme-colors'
import { Link } from '@/lib/i18n/routing'
import { cn, formatNumber } from '@/lib/utils'
import { GameIcon } from '@/shared/components/ui/game-icons'
import { ProgressRing } from '@/shared/components/ui/progress-ring'
import { GreetingLine } from './greeting-line'

export type HomeHeroGame = {
	slug: string
	name: string
	tagline: string
	duration: string
	highlight: string
	theme: GameColorTheme
	difficultyLabels: readonly string[]
}

type HomeHeroProps = {
	locale: string
	/** Product day (Asia/Hong_Kong) formatted for the viewer's locale. */
	dateLabel: string
	freeGame: HomeHeroGame
	isMember: boolean
	currentStreak: number
	hasPlayedToday: boolean
	completedCount: number
	availableCount: number
	playerCount: number
	/** True when personal progress could not be read: never shown as zero. */
	progressUnverified: boolean
}

export async function HomeHero({
	locale,
	dateLabel,
	freeGame,
	isMember,
	currentStreak,
	hasPlayedToday,
	completedCount,
	availableCount,
	playerCount,
	progressUnverified,
}: HomeHeroProps) {
	const t = await getTranslations('home')
	const colors = getGameColors(freeGame.theme)
	const allDone = availableCount > 0 && completedCount >= availableCount

	const headline = isMember
		? allDone
			? t('hero.memberDoneTitle')
			: currentStreak > 0 && !hasPlayedToday
				? t('hero.memberStreakTitle', { days: currentStreak })
				: t('hero.memberReadyTitle')
		: t('hero.guestTitle')

	return (
		<section className="relative overflow-hidden border-b border-border/60 bg-aurora">
			<div className="page-shell-wide pb-10 pt-8 md:pb-16 md:pt-14">
				<div className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
					<div className="animate-enter">
						<p className="inline-flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
							<GreetingLine className="font-semibold text-foreground" />
							<span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-3 py-1 font-medium backdrop-blur">
								<Calendar className="h-3.5 w-3.5" aria-hidden="true" />
								{dateLabel}
							</span>
							{isMember && currentStreak > 0 ? (
								<span className="inline-flex items-center gap-1.5 rounded-full bg-stat-streak/10 px-3 py-1 font-semibold text-stat-streak">
									<Flame className="h-3.5 w-3.5" aria-hidden="true" />
									{t('hero.streakChip', { days: currentStreak })}
								</span>
							) : (
								<span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 font-semibold text-emerald-600 dark:text-emerald-400">
									<Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
									{t('hero.freeChip')}
								</span>
							)}
						</p>

						<h1 className="mt-4 font-display text-[2rem] font-extrabold leading-[1.08] tracking-tight text-balance sm:text-[2.5rem] lg:text-[3rem]">
							<span className="text-gradient">{headline}</span>
						</h1>

						<p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
							{isMember
								? t('hero.memberSubtitle')
								: playerCount > 0
									? t('hero.guestSubtitle', {
											game: freeGame.name,
											count: formatNumber(playerCount, locale),
										})
									: t('hero.guestSubtitleNew', { game: freeGame.name })}
						</p>

						<div className="mt-6 flex flex-wrap items-center gap-3">
							<Link
								href={`/games/${freeGame.slug}`}
								className="inline-flex h-12 items-center gap-2 rounded-2xl bg-primary px-6 font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:-translate-y-0.5 hover:bg-primary-hover active:scale-[0.98]"
							>
								<Play className="h-4 w-4" aria-hidden="true" />
								{t('hero.playCta', { game: freeGame.name })}
							</Link>
							<Link
								href="/games"
								className="inline-flex h-12 items-center gap-2 rounded-2xl border border-border bg-background/80 px-5 font-semibold text-foreground backdrop-blur transition-colors hover:border-primary/30 hover:text-primary"
							>
								{t('hero.browseCta')}
								<ArrowRight className="h-4 w-4" aria-hidden="true" />
							</Link>
						</div>

						<ul className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
							<li className="inline-flex items-center gap-1.5">
								<Check className="h-4 w-4 text-emerald-500" aria-hidden="true" />
								{t('hero.trustFree')}
							</li>
							<li className="inline-flex items-center gap-1.5">
								<Check className="h-4 w-4 text-emerald-500" aria-hidden="true" />
								{t('hero.trustAccount')}
							</li>
							<li className="inline-flex items-center gap-1.5">
								<Check className="h-4 w-4 text-emerald-500" aria-hidden="true" />
								{t('hero.trustReset')}
							</li>
						</ul>
					</div>

					<div
						className="animate-enter"
						style={{ '--enter-delay': '120ms' } as React.CSSProperties}
					>
						<div className="relative overflow-hidden rounded-3xl border border-border/70 bg-card p-5 shadow-glow md:p-6">
							<div
								className={cn('pointer-events-none absolute inset-0 opacity-80', colors.pattern)}
								aria-hidden="true"
							/>
							<div className="relative flex items-start gap-4">
								<span
									className={cn(
										'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md',
										colors.gradient,
									)}
								>
									<GameIcon slug={freeGame.slug} size={28} />
								</span>
								<div className="min-w-0">
									<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
										{t('hero.featuredLabel')}
									</p>
									<h2 className="font-display text-2xl font-extrabold leading-tight">
										{freeGame.name}
									</h2>
									<p className="mt-1 text-sm text-muted-foreground">{freeGame.tagline}</p>
								</div>
								{isMember && (
									<ProgressRing
										size={76}
										strokeWidth={7}
										value={completedCount}
										max={availableCount}
										className="ml-auto hidden sm:inline-flex"
										title={t('hero.progressRingLabel', {
											done: completedCount,
											total: availableCount,
										})}
									/>
								)}
							</div>

							<div className="relative mt-5 flex flex-wrap items-center gap-2 text-xs">
								<span className="chip bg-background/80 text-muted-foreground">
									<Clock className="h-3 w-3" aria-hidden="true" />
									{freeGame.duration}
								</span>
								{freeGame.difficultyLabels.map((level) => (
									<span key={level} className="chip bg-background/80 text-muted-foreground">
										{level}
									</span>
								))}
								{freeGame.difficultyLabels.length === 0 && (
									<span className="chip bg-background/80 text-muted-foreground">
										{freeGame.highlight}
									</span>
								)}
							</div>

							<Link
								href={`/games/${freeGame.slug}`}
								/*
								 * Solid brand fill: the module gradient stays on the icon tile
								 * where no text sits on it, so the CTA keeps AA contrast in both
								 * themes instead of white-on-light-gradient.
								 */
								className="relative mt-5 flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary font-semibold text-primary-foreground shadow-md transition-transform hover:-translate-y-0.5 hover:bg-primary-hover active:scale-[0.99]"
							>
								<Play className="h-4 w-4" aria-hidden="true" />
								{t('hero.playCta', { game: freeGame.name })}
							</Link>

							<p className="relative mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
								<Users className="h-3.5 w-3.5" aria-hidden="true" />
								{playerCount > 0
									? t('hero.playersToday', { count: formatNumber(playerCount, locale) })
									: t('hero.playersTodayNone')}
							</p>

							{progressUnverified && (
								<p className="relative mt-3 rounded-xl bg-accent-warm-soft px-3 py-2 text-xs text-accent-warm-foreground">
									{t('hero.progressUnverified')}
								</p>
							)}
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}
