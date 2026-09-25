export const dynamic = 'force-dynamic'

import { Card, CardContent } from '@sylphx/ui'
import { CalendarDays, Lock, Play } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import {
	ARCHIVE_WINDOW_DAYS,
	archiveDays,
	archivePlayPath,
} from '@/features/daily/lib/archive-days'
import { getAllGameMetadata } from '@/games/registry'
import { getTodaysFreeGame } from '@/lib/free-rotation'
import { slugToCamelCase } from '@/lib/game-slug'
import { Link } from '@/lib/i18n/routing'
import { currentUser } from '@/lib/identity/server'
import { withPresentationDeadline } from '@/lib/presentation-document'
import { productDayKey } from '@/lib/product-day'
import { buildPageMetadata, ogImagePath } from '@/lib/seo/metadata'
import { GameIcon } from '@/shared/components/ui/game-icons'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'archive' })

	return buildPageMetadata({
		locale,
		path: '/archive',
		title: t('metaTitle'),
		description: t('metaDescription'),
		imagePath: ogImagePath({
			title: t('metaTitle'),
			subtitle: t('metaDescription'),
			eyebrow: t('eyebrow'),
		}),
		// The archive is a per-identity surface, not search content.
		noindex: true,
	})
}

/** Civil day key rendered in the product-day timezone, never shifted. */
function formatDayKey(dayKey: string, locale: string): string {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey)
	if (!match) return dayKey
	const utc = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
	return new Intl.DateTimeFormat(locale, {
		dateStyle: 'medium',
		timeZone: 'UTC',
	}).format(utc)
}

/**
 * The archive index (`/archive`) — the surface that lets a player reach past
 * product days.
 *
 * A guest is pointed at sign-in (the archive is per-identity); every signed-in
 * account sees the day list. Every row links the dated play route,
 * `/games/<slug>?mode=archive&date=YYYY-MM-DD`, which Connect admits or refuses
 * on its own — this page decides nothing about play.
 *
 * The list is the product-day calendar walked backwards (Asia/Hong_Kong), not
 * a client's history: it is the same day-key space the ritual and the share
 * deep link use, and it is derived on the server for every request.
 */
export default async function ArchivePage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	const t = await getTranslations('archive')
	const tGames = await getTranslations('games')

	const user = await withPresentationDeadline(currentUser(), null)
	const isGuest = !user?.id

	const todaysFreeGame = getTodaysFreeGame()
	const freeName = tGames(`${slugToCamelCase(todaysFreeGame)}.name`, {
		defaultValue: todaysFreeGame,
	})

	const moduleNames = new Map(getAllGameMetadata().map((game) => [game.slug, game.name]))
	const days = !isGuest
		? archiveDays(productDayKey()).map((day) => ({
				...day,
				name: tGames(`${slugToCamelCase(day.gameSlug)}.name`, {
					defaultValue: moduleNames.get(day.gameSlug) ?? day.gameSlug,
				}),
			}))
		: []

	return (
		<main className="flex-1">
			<section className="page-shell py-10 md:py-14">
				<p className="text-xs font-semibold uppercase tracking-wide text-primary">{t('eyebrow')}</p>
				<h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
					{t('title')}
				</h1>
				<p className="mt-3 max-w-2xl text-muted-foreground">{t('body')}</p>

				{isGuest ? (
					<Card className="mt-8 max-w-xl">
						<CardContent className="flex flex-col gap-4 p-6">
							<div className="flex items-center gap-3">
								<Lock className="h-5 w-5 text-primary" aria-hidden="true" />
								<h2 className="font-display text-lg font-bold">{t('guestTitle')}</h2>
							</div>
							<p className="text-sm text-muted-foreground">{t('guestBody')}</p>
							<div className="flex flex-wrap items-center gap-3">
								<Link
									href="/login"
									className="inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
								>
									{t('signInCta')}
								</Link>
								<Link
									href={`/games/${todaysFreeGame}`}
									className="inline-flex h-11 items-center rounded-xl border border-border px-5 text-sm font-semibold transition-colors hover:border-primary/30 hover:text-primary"
								>
									{t('playFreeToday', { game: freeName })}
								</Link>
							</div>
						</CardContent>
					</Card>
				) : (
					<section className="mt-8">
						{days.length === 0 ? (
							/* Warm empty state: never an empty grid as the default. */
							<div className="rounded-2xl border border-border/70 bg-surface-muted/50 p-6">
								<div className="flex items-center gap-3">
									<CalendarDays className="h-5 w-5 text-accent-warm" aria-hidden="true" />
									<h2 className="font-display text-xl font-bold">{t('emptyTitle')}</h2>
								</div>
								<p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
									{t('emptyBody')}
								</p>
								<Link
									href={`/games/${todaysFreeGame}`}
									className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-accent-warm/40 bg-accent-warm/10 px-5 text-sm font-semibold text-accent-warm-foreground transition-colors hover:bg-accent-warm/20"
								>
									{t('emptyPlay', { game: freeName })}
								</Link>
							</div>
						) : (
							<>
								<div className="flex items-center gap-3">
									<CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />
									<h2 className="font-display text-xl font-bold">{t('listTitle')}</h2>
								</div>
								<p className="mt-2 max-w-2xl text-sm text-muted-foreground">
									{t('listBody', { count: ARCHIVE_WINDOW_DAYS })}
								</p>

								<ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
									{days.map((day) => (
										<li key={day.dayKey}>
											<Link
												href={archivePlayPath(day.gameSlug, day.dayKey)}
												className="flex h-full min-h-11 items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 transition-colors hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
												aria-label={t('playDayLabel', {
													game: day.name,
													date: formatDayKey(day.dayKey, locale),
												})}
											>
												<GameIcon slug={day.gameSlug} size={22} aria-hidden="true" />
												<span className="min-w-0 flex-1">
													<span className="block truncate text-sm font-semibold">{day.name}</span>
													<span className="block text-xs text-muted-foreground">
														{formatDayKey(day.dayKey, locale)}
													</span>
												</span>
												<Play className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
												<span className="sr-only">{t('play')}</span>
											</Link>
										</li>
									))}
								</ul>

								<div className="mt-6 flex flex-wrap items-center gap-3">
									<Link
										href={`/games/${todaysFreeGame}`}
										className="inline-flex h-11 items-center rounded-xl border border-border px-5 text-sm font-semibold transition-colors hover:border-primary/30 hover:text-primary"
									>
										{t('playToday', { game: freeName })}
									</Link>
									<Link href="/games" className="text-sm font-medium text-primary hover:underline">
										{t('backToGames')}
									</Link>
								</div>
							</>
						)}
					</section>
				)}
			</section>
		</main>
	)
}
