export const dynamic = 'force-dynamic'

import { BarChart3, Check, Flame, Play, RefreshCw, Snowflake, Trophy } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import {
	ConsoleCard,
	ConsoleHeader,
	ConsoleStat,
	HonestNotice,
} from '@/features/console/components/console-chrome'
import { FinishCalendarCard } from '@/features/console/components/finish-calendar'
import { type Milestone, MilestoneRingsCard } from '@/features/console/components/milestone-rings'
import { FinishHistoryCard, ModuleBreakdownCard } from '@/features/console/components/stats-tables'
import {
	buildFinishCalendar,
	moduleStatRows,
	winRatePercent,
} from '@/features/console/lib/finish-activity'
import { getNextAchievements } from '@/features/gamification'
import { getAllGameMetadata } from '@/games/registry'
import {
	getServerHistory,
	getServerPersonalDailyResults,
	getServerStreakInfo,
	getServerUserStats,
	hasServerProgressIdentity,
	type PersonalDailyResult,
	type StreakInfo,
	type UserStats,
} from '@/lib/api/server'
import { getTodaysFreeGame, hasPremiumAccess } from '@/lib/billing/server'
import { slugToCamelCase } from '@/lib/game-slug'
import { Link } from '@/lib/i18n/routing'
import { currentUser } from '@/lib/identity/server'
import { withPresentationDeadline } from '@/lib/presentation-document'
import { productDayKey } from '@/lib/product-day'
import { buildPageMetadata, ogImagePath } from '@/lib/seo/metadata'
import { GameIcon } from '@/shared/components/ui/game-icons'

/** The server clamps history to 100 rows; the console asks for the ceiling. */
const HISTORY_LIMIT = 100
/** Rows shown inline before the list is trimmed. */
const HISTORY_ROWS = 12

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'stats' })

	return buildPageMetadata({
		locale,
		path: '/stats',
		title: t('title'),
		description: t('metaDescription'),
		imagePath: ogImagePath({
			title: t('title'),
			subtitle: t('metaDescription'),
			eyebrow: t('eyebrow'),
		}),
		// A personal progress surface is not search content.
		noindex: true,
	})
}

/**
 * The stats console.
 *
 * Every number comes from Connect (`StatsService.GetUserStats`,
 * `GetHistory`, `GamificationService.GetStreakInfo`) or from the product-day
 * rotation. When a read does not come back the surface says so and offers a
 * retry: it never prints a zero in place of a number it did not receive.
 */
export default async function StatsPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	const t = await getTranslations('stats')
	const tGames = await getTranslations('games')
	const tCommon = await getTranslations('common')

	const user = await withPresentationDeadline(currentUser(), null)
	const hasProgressIdentity = Boolean(user) || (await hasServerProgressIdentity())
	const todaysFreeGame = getTodaysFreeGame()
	const isPremium = user?.id
		? await withPresentationDeadline(hasPremiumAccess(user.id), false)
		: false

	const modules = getAllGameMetadata().map((game) => ({
		slug: game.slug,
		name: tGames(`${slugToCamelCase(game.slug)}.name`, { defaultValue: game.name }),
	}))
	const moduleNames = Object.fromEntries(modules.map((module) => [module.slug, module.name]))

	const [statsResult, historyResult, streakResult, personalResult] = await Promise.allSettled([
		hasProgressIdentity ? getServerUserStats() : Promise.resolve(null as UserStats | null),
		hasProgressIdentity ? getServerHistory({ limit: HISTORY_LIMIT }) : Promise.resolve(null),
		hasProgressIdentity ? getServerStreakInfo() : Promise.resolve(null as StreakInfo | null),
		getServerPersonalDailyResults({
			gameSlugs: modules.map((module) => module.slug),
			isGuest: !user,
			userId: user?.id ?? null,
			freeGameSlug: todaysFreeGame,
		}),
	])

	// A guest without a progress identity has written nothing yet: that is an
	// empty record, not a failed read.
	const statsRead = statsResult.status === 'fulfilled' ? statsResult.value : null
	const historyRead = historyResult.status === 'fulfilled' ? historyResult.value : null
	const streakRead = streakResult.status === 'fulfilled' ? streakResult.value : null
	const statsKnown = statsRead !== null || !hasProgressIdentity
	const historyKnown = historyRead !== null || !hasProgressIdentity
	const streakKnown = streakRead !== null

	const personalResults: Record<string, PersonalDailyResult> =
		personalResult.status === 'fulfilled' ? personalResult.value : {}
	const personalAvailable =
		personalResult.status === 'fulfilled' &&
		Object.values(personalResults).length > 0 &&
		Object.values(personalResults).every((result) => result.statusAvailable)

	const moduleRows = moduleStatRows(statsRead ?? {}, modules)
	const totalFinished = moduleRows.reduce((sum, row) => sum + row.played, 0)
	const totalWon = moduleRows.reduce((sum, row) => sum + row.won, 0)
	const winRate = winRatePercent(totalFinished, totalWon)
	const history = historyRead ?? []
	const calendar = buildFinishCalendar({ sessions: history, todayKey: productDayKey() })

	// A ring needs both readings: totals for the win milestones and the streak
	// payload for the streak one. Without the streak number a ring would paint a
	// fabricated 0-day best, so the card states that it is unavailable instead.
	const milestonesReadable = statsKnown && streakKnown
	const milestones: Milestone[] = milestonesReadable
		? getNextAchievements({
				totalWins: moduleRows.length > 0 ? totalWon : 0,
				maxStreak: streakRead?.maxStreak ?? 0,
			}).map((achievement) => ({
				id: achievement.id,
				metric: achievement.category === 'streak' ? 'streak' : 'wins',
				tier: achievement.tier,
				progress: achievement.progress ?? 0,
				target: achievement.target ?? 1,
			}))
		: []

	const everythingUnreadable = hasProgressIdentity && !statsKnown && !historyKnown && !streakKnown
	const nothingRecorded = statsKnown && totalFinished === 0 && historyKnown && history.length === 0

	const memberLabel = user?.name?.trim() || user?.email || t('identity.player')
	const streakChip = streakKnown && (streakRead?.currentStreak ?? 0) > 0

	return (
		<main className="page-shell-wide py-8 md:py-10">
			<div className="space-y-6">
				<ConsoleHeader
					eyebrow={t('eyebrow')}
					title={t('title')}
					description={user ? t('descriptionMember', { name: memberLabel }) : t('descriptionGuest')}
					chips={
						<>
							{user ? (
								<span className="chip bg-primary/10 text-primary">{t('identity.member')}</span>
							) : (
								<span className="chip bg-amber-500/10 text-amber-700 dark:text-amber-400">
									{t('identity.guest')}
								</span>
							)}
							{isPremium ? (
								<span className="chip bg-violet-500/10 text-violet-700 dark:text-violet-300">
									{t('identity.premium')}
								</span>
							) : null}
							{streakChip ? (
								<span className="chip bg-stat-streak/10 text-stat-streak">
									{t('identity.streakChip', { days: streakRead?.currentStreak ?? 0 })}
								</span>
							) : null}
							{!user ? (
								<Link
									href="/login"
									className="chip bg-muted text-foreground underline-offset-2 hover:underline"
								>
									{t('identity.signInCta')}
								</Link>
							) : null}
						</>
					}
					actions={
						<Link
							href="/leaderboard"
							className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						>
							<Trophy className="h-4 w-4" aria-hidden="true" />
							{t('viewLeaderboard')}
						</Link>
					}
				/>

				{everythingUnreadable ? (
					<HonestNotice
						icon={BarChart3}
						title={t('unavailableTitle')}
						body={t('unavailableDescription')}
						footnote={t('unavailableFootnote')}
						action={{ href: '/stats', label: t('retry') }}
					/>
				) : null}

				{!everythingUnreadable && nothingRecorded ? (
					<HonestNotice
						tone="quiet"
						icon={Play}
						title={t('noStatsYet')}
						body={t('playFirstGame')}
						action={{ href: '/games', label: t('startPlaying') }}
					/>
				) : null}

				{!everythingUnreadable ? (
					<>
						<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
							<ConsoleStat
								icon={Check}
								label={t('played')}
								value={statsKnown ? String(totalFinished) : t('unknownValue')}
								srValue={statsKnown ? undefined : t('unknownSr')}
								hint={
									statsKnown
										? totalFinished > 0
											? t('playedHint', { modules: moduleRows.length })
											: t('playedHintEmpty')
										: undefined
								}
							/>
							<ConsoleStat
								icon={BarChart3}
								label={t('winRate')}
								tone="win"
								value={
									statsKnown
										? winRate === null
											? t('unknownValue')
											: `${winRate}%`
										: t('unknownValue')
								}
								srValue={
									statsKnown ? (winRate === null ? t('winRateEmptySr') : undefined) : t('unknownSr')
								}
								hint={
									statsKnown
										? winRate === null
											? t('winRateHintEmpty')
											: t('winRateHint', { won: totalWon, played: totalFinished })
										: undefined
								}
							/>
							<ConsoleStat
								icon={Flame}
								label={t('streak')}
								tone="streak"
								value={streakKnown ? String(streakRead?.currentStreak ?? 0) : t('unknownValue')}
								srValue={streakKnown ? undefined : t('unknownSr')}
								hint={
									streakKnown
										? streakRead?.hasPlayedToday
											? t('streakHintPlayed')
											: t('streakHintOpen')
										: undefined
								}
							/>
							<ConsoleStat
								icon={Trophy}
								label={t('best')}
								tone="best"
								value={streakKnown ? String(streakRead?.maxStreak ?? 0) : t('unknownValue')}
								srValue={streakKnown ? undefined : t('unknownSr')}
								hint={streakKnown ? t('bestHint', { days: streakRead?.maxStreak ?? 0 }) : undefined}
							/>
						</div>

						<ConsoleCard
							title={t('today.title')}
							description={t('today.description')}
							actions={
								<Link
									href="/"
									className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
								>
									{t('today.playCta')}
								</Link>
							}
						>
							{personalAvailable ? (
								<ul className="grid gap-2 sm:grid-cols-2">
									{modules.map((module) => {
										const locked = !isPremium && module.slug !== todaysFreeGame
										if (locked) return null
										const result = personalResults[module.slug]
										const done = result?.hasCompleted ?? false
										return (
											<li key={module.slug}>
												<Link
													href={`/games/${module.slug}`}
													className="flex min-h-11 items-center gap-2 rounded-xl bg-surface-muted/70 px-3 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
												>
													<GameIcon slug={module.slug} size={20} aria-hidden="true" />
													<span className="min-w-0 flex-1 truncate">{module.name}</span>
													{done ? (
														<span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
															<Check className="h-4 w-4" aria-hidden="true" />
															{t('today.done')}
														</span>
													) : (
														<span className="text-xs text-muted-foreground">{t('today.open')}</span>
													)}
												</Link>
											</li>
										)
									})}
								</ul>
							) : (
								<HonestNotice
									icon={RefreshCw}
									title={t('dailyStatusUnavailableTitle')}
									body={t('dailyStatusUnavailableDescription')}
									action={{ href: '/stats', label: t('dailyStatusRetry') }}
								/>
							)}
						</ConsoleCard>

						<div className="grid gap-4 lg:grid-cols-2">
							<ConsoleCard title={t('streakCard.title')} description={t('streakCard.description')}>
								{streakKnown ? (
									<>
										<dl className="grid grid-cols-2 gap-4">
											<div>
												<dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
													{t('streak')}
												</dt>
												<dd className="mt-1 font-display text-3xl font-extrabold tnum">
													{streakRead?.currentStreak ?? 0}
												</dd>
											</div>
											<div>
												<dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
													{t('best')}
												</dt>
												<dd className="mt-1 font-display text-3xl font-extrabold tnum">
													{streakRead?.maxStreak ?? 0}
												</dd>
											</div>
										</dl>
										<ul className="mt-4 space-y-2 text-sm">
											<li className="flex items-center gap-2">
												<Flame className="h-4 w-4 text-stat-streak" aria-hidden="true" />
												{streakRead?.hasPlayedToday
													? t('streakCard.playedToday')
													: t('streakCard.notPlayedToday')}
											</li>
											<li className="flex items-center gap-2">
												<Snowflake className="h-4 w-4 text-primary" aria-hidden="true" />
												{t('streakCard.freezes', { count: streakRead?.freezesAvailable ?? 0 })}
											</li>
										</ul>
										{(streakRead?.freezesAvailable ?? 0) > 0 &&
										streakRead?.autoFreezeEnabled !== undefined ? (
											<p className="mt-3 text-xs leading-relaxed text-muted-foreground">
												{streakRead.autoFreezeEnabled
													? t('streakCard.autoFreezeOn')
													: t('streakCard.autoFreezeOff')}
											</p>
										) : null}
									</>
								) : (
									<HonestNotice
										title={t('streakCard.unavailableTitle')}
										body={t('streakCard.unavailableBody')}
										action={{ href: '/stats', label: tCommon('retry') }}
									/>
								)}
							</ConsoleCard>

							{historyKnown ? (
								<FinishCalendarCard calendar={calendar} locale={locale} />
							) : (
								<ConsoleCard title={t('calendar.title')} description={t('calendar.description')}>
									<HonestNotice
										title={t('calendar.unavailableTitle')}
										body={t('calendar.unavailableBody')}
										action={{ href: '/stats', label: tCommon('retry') }}
									/>
								</ConsoleCard>
							)}
						</div>

						{statsKnown ? (
							<ModuleBreakdownCard rows={moduleRows} />
						) : (
							<ConsoleCard title={t('modules.title')} description={t('modules.description')}>
								<HonestNotice
									title={t('modules.unavailableTitle')}
									body={t('modules.unavailableBody')}
									action={{ href: '/stats', label: tCommon('retry') }}
								/>
							</ConsoleCard>
						)}

						<MilestoneRingsCard milestones={milestones} unavailable={!milestonesReadable} />

						{historyKnown ? (
							<FinishHistoryCard
								sessions={history.slice(0, HISTORY_ROWS)}
								moduleNames={moduleNames}
								locale={locale}
							/>
						) : null}
					</>
				) : null}
			</div>
		</main>
	)
}
