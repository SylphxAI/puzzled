export const dynamic = 'force-dynamic'

import { Info, Trophy } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import {
	ConsoleCard,
	ConsoleHeader,
	HonestNotice,
} from '@/features/console/components/console-chrome'
import { type BoardEntry, LeaderboardBoard } from '@/features/console/components/leaderboard-board'
import { LeaderboardControls } from '@/features/console/components/leaderboard-controls'
import { toLeaderboardPeriod } from '@/features/console/lib/leaderboard-period'
import { getAllGameMetadata } from '@/games/registry'
import { admitLeaderboardViaConnect } from '@/lib/connect/stats-admission'
import { slugToCamelCase } from '@/lib/game-slug'
import { Link } from '@/lib/i18n/routing'
import { auth } from '@/lib/identity/server'
import { buildPageMetadata, ogImagePath } from '@/lib/seo/metadata'

/** Rows per board. The API clamps to 100; ten keeps one board readable. */
const BOARD_LIMIT = 10
const PANEL_ID = 'board-panel'

type Props = {
	params: Promise<{ locale: string }>
	searchParams: Promise<{ period?: string; module?: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'leaderboard' })

	return buildPageMetadata({
		locale,
		path: '/leaderboard',
		title: t('title'),
		description: t('metaDescription'),
		imagePath: ogImagePath({
			title: t('title'),
			subtitle: t('metaDescription'),
			eyebrow: t('eyebrow'),
		}),
		// Boards are personal-score surfaces: the SEO contract keeps them out of
		// the index alongside /stats and /settings.
		noindex: true,
	})
}

/**
 * The leaderboard.
 *
 * One module and one scope at a time, exactly as `StatsService.GetLeaderboard`
 * answers: score boards per module for today, this week, or all time. The page
 * does not add up boards the API does not return, and a read that fails says so
 * instead of drawing an empty table.
 */
export default async function LeaderboardPage({ params, searchParams }: Props) {
	const { locale } = await params
	const { period: periodParam, module: moduleParam } = await searchParams
	setRequestLocale(locale)

	const t = await getTranslations('leaderboard')
	const tGames = await getTranslations('games')

	const modules = getAllGameMetadata().map((game) => ({
		slug: game.slug,
		name: tGames(`${slugToCamelCase(game.slug)}.name`, { defaultValue: game.name }),
	}))
	const period = toLeaderboardPeriod(periodParam)
	const selected = modules.find((module) => module.slug === moduleParam) ?? modules[0]
	const moduleSlug = selected?.slug ?? ''
	const moduleName = selected?.name ?? ''

	const { user } = await auth()
	const viewerId = user?.id ?? null

	let entries: BoardEntry[] = []
	let boardReadable = false

	if (moduleSlug) {
		const admit = await admitLeaderboardViaConnect({
			gameSlug: moduleSlug,
			type: 'score',
			period,
			limit: BOARD_LIMIT,
		}).catch(() => null)

		if (admit?.ok) {
			boardReadable = true
			entries = admit.response.entries.map((entry) => ({
				rank: entry.rank,
				name: entry.userName.trim() || t('anonymous'),
				score: entry.value,
				isViewer: Boolean(viewerId && entry.userId === viewerId),
			}))
		}
	}

	const retryHref = `/leaderboard?period=${period}&module=${moduleSlug}`

	return (
		<main className="page-shell-wide py-8 md:py-10">
			<div className="space-y-6">
				<ConsoleHeader
					eyebrow={t('eyebrow')}
					title={t('title')}
					description={t('description')}
					chips={
						<span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
							<Trophy className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
							{t('chip', { module: moduleName })}
						</span>
					}
				/>

				<LeaderboardControls
					period={period}
					moduleSlug={moduleSlug}
					modules={modules}
					panelId={PANEL_ID}
				/>

				{boardReadable ? (
					<LeaderboardBoard
						panelId={PANEL_ID}
						period={period}
						moduleSlug={moduleSlug}
						moduleName={moduleName}
						entries={entries}
						viewerSignedIn={Boolean(viewerId)}
						locale={locale}
					/>
				) : (
					<div
						id={PANEL_ID}
						role="tabpanel"
						aria-labelledby={`board-tab-${period}`}
						tabIndex={-1}
						className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						<ConsoleCard
							title={t('boardTitle', { module: moduleName })}
							description={t('boardDescription', { period: t(`period.${period}`) })}
						>
							<HonestNotice
								icon={Trophy}
								title={t('unavailable.title')}
								body={t('unavailable.body')}
								footnote={t('unavailable.footnote')}
								action={{ href: retryHref, label: t('unavailable.retry') }}
							/>
						</ConsoleCard>
					</div>
				)}

				<ConsoleCard title={t('how.title')} description={t('how.description')}>
					<ul className="space-y-2 text-sm text-muted-foreground">
						<li className="flex items-start gap-2">
							<Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
							{t('how.scores')}
						</li>
						<li className="flex items-start gap-2">
							<Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
							{t('how.visibility')}
						</li>
						<li className="flex items-start gap-2">
							<Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
							{t('how.boards')}
						</li>
					</ul>
					<Link
						href="/settings/privacy"
						className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-border bg-background px-4 text-sm font-semibold transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						{t('how.visibilityCta')}
					</Link>
				</ConsoleCard>
			</div>
		</main>
	)
}
