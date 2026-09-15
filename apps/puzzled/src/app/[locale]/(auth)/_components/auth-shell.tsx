import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'
import { getServerTodayOverview } from '@/lib/api/server'
import { getTodaysFreeGame } from '@/lib/billing/server'
import { slugToCamelCase } from '@/lib/game-slug'
import { Link } from '@/lib/i18n/routing'
import { withPresentationDeadline } from '@/lib/presentation-document'
import { Logo } from '@/shared/components/layout'

type AuthShellProps = {
	locale: string
	children: ReactNode
}

/**
 * Frame for every account surface.
 *
 * Desktop reads as a split: the brand panel carries the promise and one honest
 * proof point (today's free module, plus today's finishes when the aggregate
 * actually answers), and the form sits beside it. On mobile the same panel
 * collapses to a mark and a way straight back to play.
 */
export async function AuthShell({ locale, children }: AuthShellProps) {
	const t = await getTranslations('auth')
	const tGames = await getTranslations('games')

	const freeGameSlug = getTodaysFreeGame()
	const freeGameName = tGames(`${slugToCamelCase(freeGameSlug)}.name`, {
		defaultValue: freeGameSlug,
	})
	// Public aggregate for today; an unreadable payload simply drops the line
	// rather than claiming a number we did not receive.
	const overview = await withPresentationDeadline(getServerTodayOverview(), null)
	const playersToday = overview && overview.playerCount > 0 ? overview.playerCount : null

	const trustPoints = [
		t('brandPanel.trustFree'),
		t('brandPanel.trustNoAccount'),
		t('brandPanel.trustMidnight'),
	]

	return (
		<div className="min-h-screen bg-background">
			<div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
				<aside className="surface-ink relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-14">
					<div className="bg-aurora pointer-events-none absolute inset-0" aria-hidden="true" />
					<div
						className="bg-grid-faint pointer-events-none absolute inset-0 opacity-50"
						aria-hidden="true"
					/>

					<div className="relative">
						<Logo size="lg" tone="inverse" />
						<h2 className="mt-10 max-w-md font-display text-3xl font-extrabold leading-tight text-balance xl:text-4xl">
							{t('brandPanel.title')}
						</h2>
						<p className="mt-3 max-w-md text-sm leading-relaxed text-indigo-100/80">
							{t('brandPanel.body')}
						</p>

						<div className="mt-8 max-w-md rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
							<p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-200">
								{t('brandPanel.proofLabel')}
							</p>
							<p className="mt-1.5 font-display text-lg font-bold">
								{t('brandPanel.proofGame', { game: freeGameName })}
							</p>
							<p className="mt-1 text-sm text-indigo-100/80">
								{playersToday === null
									? t('brandPanel.proofNoCount')
									: t('brandPanel.proofPlayers', {
											count: new Intl.NumberFormat(locale).format(playersToday),
										})}
							</p>
							<Link
								href={`/games/${freeGameSlug}`}
								className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-ink)]"
							>
								{t('brandPanel.playFree')}
								<ArrowRight className="h-4 w-4" aria-hidden="true" />
							</Link>
						</div>

						<ul className="mt-8 max-w-md space-y-2 text-sm text-indigo-100/80">
							{trustPoints.map((point) => (
								<li key={point} className="flex items-start gap-2">
									<Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
									{point}
								</li>
							))}
						</ul>
					</div>

					<Link
						href="/"
						className="relative mt-10 inline-flex min-h-11 w-fit items-center gap-2 rounded-xl text-sm font-semibold text-white/90 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-ink)]"
					>
						<ArrowLeft className="h-4 w-4" aria-hidden="true" />
						{t('backToPlay')}
					</Link>
				</aside>

				<main
					id="main-content"
					className="flex flex-col px-4 py-6 sm:px-6 lg:justify-center lg:py-12"
				>
					<div className="mb-6 flex items-center justify-between gap-3 lg:hidden">
						<Logo size="md" />
						<Link
							href="/"
							className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						>
							<ArrowLeft className="h-4 w-4" aria-hidden="true" />
							{t('backToPlay')}
						</Link>
					</div>
					<div className="mx-auto w-full max-w-md">{children}</div>
				</main>
			</div>
		</div>
	)
}
