import { Card } from '@sylphx/ui'
import { Lock, Search, Sparkles } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { buildCatalogEntries, filterCatalogEntries } from '@/features/catalog/lib/catalog'
import { getAllGameMetadata } from '@/games/registry'
import { getTodaysFreeGame, hasPremiumAccess } from '@/lib/billing/server'
import { Link } from '@/lib/i18n/routing'
import { currentUser } from '@/lib/identity/server'
import { withPresentationDeadline } from '@/lib/presentation-document'
import { Header } from '@/shared/components/layout'
import { GameIcon } from '@/shared/components/ui/game-icons'

// Force dynamic rendering - entitlement decides the premium badges
export const dynamic = 'force-dynamic'

type Props = {
	params: Promise<{ locale: string }>
	searchParams: Promise<{ q?: string | string[] }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'catalog' })

	return {
		title: t('metaTitle'),
		description: t('metaDescription'),
	}
}

/**
 * Full catalog page (`/games`).
 *
 * Home exposure is bounded; this page is where every registered module stays
 * reachable. Data is registry + free rotation (static/pure) and one
 * fail-closed entitlement read for the premium badges, so an unavailable
 * identity/commerce read degrades to "premium" instead of crashing.
 */
export default async function GamesCatalogPage({ params, searchParams }: Props) {
	const { locale } = await params
	const { q } = await searchParams
	setRequestLocale(locale)

	const t = await getTranslations('catalog')
	const tRoot = await getTranslations()

	const user = await withPresentationDeadline(currentUser(), null)
	const isPremium = user?.id
		? await withPresentationDeadline(hasPremiumAccess(user.id), false)
		: false

	const entries = buildCatalogEntries({
		modules: getAllGameMetadata(),
		freeGameSlug: getTodaysFreeGame(),
		isPremium,
	}).map((entry) => ({
		...entry,
		title: tRoot(entry.titleKey, { defaultValue: entry.canonicalTitle }),
		tagline: tRoot(entry.taglineKey, { defaultValue: '' }),
	}))

	const query = (Array.isArray(q) ? q[0] : q)?.trim() ?? ''
	const visibleEntries = filterCatalogEntries(entries, query)

	return (
		<>
			<Header />
			<main className="flex flex-1 flex-col px-4 py-8 pb-nav">
				<div className="mx-auto w-full max-w-4xl space-y-6">
					<div className="text-center">
						<h1 className="text-3xl font-bold">{t('title')}</h1>
						<p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
					</div>

					{/* SearchAction target: /games?q= filters the registry by player title */}
					<search className="mx-auto block w-full max-w-md">
						<form method="get" className="relative">
							<Search
								className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
								aria-hidden="true"
							/>
							<input
								type="search"
								name="q"
								defaultValue={query}
								placeholder={t('searchPlaceholder')}
								aria-label={t('searchLabel')}
								className="w-full rounded-xl border bg-background py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
							/>
						</form>
					</search>

					{query && (
						<div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
							<output>
								{t('showing', { count: visibleEntries.length, total: entries.length })}
							</output>
							<Link href="/games" className="font-medium text-primary hover:underline">
								{t('clearFilter')}
							</Link>
						</div>
					)}

					{visibleEntries.length === 0 ? (
						<div className="rounded-xl border border-dashed px-6 py-12 text-center">
							<p className="font-medium">{t('emptyTitle')}</p>
							<p className="mt-1 text-sm text-muted-foreground">{t('emptyDescription')}</p>
						</div>
					) : (
						<ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{visibleEntries.map((entry) => (
								<li key={entry.slug}>
									<Link href={`/games/${entry.slug}`} className="group block h-full">
										<Card className="relative flex h-full flex-col p-4 transition-all duration-200 hover:border-primary/40 hover:shadow-lg">
											<div className="mb-3 flex items-start justify-between gap-3">
												<div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-sm">
													<GameIcon slug={entry.slug} size={22} className="text-white" />
												</div>

												{entry.freeToday ? (
													<span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
														<Sparkles className="h-3 w-3" aria-hidden="true" />
														<span>{t('freeToday')}</span>
													</span>
												) : entry.locked ? (
													<span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
														<Lock className="h-3 w-3" aria-hidden="true" />
														<span>{t('premium')}</span>
													</span>
												) : null}
											</div>

											<h2 className="text-lg font-bold">{entry.title}</h2>
											<p className="mt-1 flex-1 text-sm text-muted-foreground">{entry.tagline}</p>

											<div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
												<span>{entry.duration}</span>
												<span className="font-medium text-primary">{t('open')} →</span>
											</div>
										</Card>
									</Link>
								</li>
							))}
						</ul>
					)}
				</div>
			</main>
		</>
	)
}
