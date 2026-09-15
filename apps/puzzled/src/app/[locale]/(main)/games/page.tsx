import { ArrowRight, Play } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { CatalogExplainer } from '@/features/catalog/components/catalog-explainer'
import { CatalogFaq } from '@/features/catalog/components/catalog-faq'
import { CatalogFeatured } from '@/features/catalog/components/catalog-featured'
import { CatalogHero } from '@/features/catalog/components/catalog-hero'
import {
	buildCatalogEntries,
	filterCatalogEntries,
	parseCatalogCategory,
	readMessage,
} from '@/features/catalog/lib/catalog'
import { getAllGameMetadata } from '@/games/registry'
import { getTodaysFreeGame, hasPremiumAccess } from '@/lib/billing/server'
import { Link } from '@/lib/i18n/routing'
import { currentUser } from '@/lib/identity/server'
import { withPresentationDeadline } from '@/lib/presentation-document'
import { buildPageMetadata, localizedPath, ogImagePath } from '@/lib/seo/metadata'
import { getRequestSiteOrigin } from '@/lib/site-origin.server'
import { GameTile } from '@/shared/components/games/game-tile'

// Force dynamic rendering - entitlement decides the premium badges
export const dynamic = 'force-dynamic'

type Props = {
	params: Promise<{ locale: string }>
	searchParams: Promise<{ q?: string | string[]; category?: string | string[] }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'catalog' })

	return buildPageMetadata({
		locale,
		path: '/games',
		title: t('metaTitle'),
		description: t('metaDescription'),
		imagePath: ogImagePath({
			title: t('metaTitle'),
			subtitle: t('metaDescription'),
			eyebrow: t('heroEyebrow'),
		}),
	})
}

/**
 * Full catalog page (`/games`).
 *
 * Every registered module stays reachable here, in its own colour theme: the
 * day's free rotation leads, the rest of the suite follows with honest premium
 * marking, and the page explains the daily ritual for a first-time visitor.
 * Data is registry + free rotation (static/pure) and one fail-closed
 * entitlement read, so an unavailable identity/commerce read degrades to
 * "premium" instead of crashing.
 */
export default async function GamesCatalogPage({ params, searchParams }: Props) {
	const { locale } = await params
	const { q, category: categoryParam } = await searchParams
	setRequestLocale(locale)

	const t = await getTranslations('catalog')
	// Catalog entry keys are root-qualified (`games.wordGuess.name`).
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
		title: readMessage(tRoot, entry.titleKey, entry.canonicalTitle),
		tagline: readMessage(tRoot, entry.taglineKey, ''),
		highlight: readMessage(tRoot, entry.highlightKey, ''),
	}))

	const query = (Array.isArray(q) ? q[0] : q)?.trim() ?? ''
	const category = parseCatalogCategory(categoryParam)
	const visibleEntries = filterCatalogEntries(entries, { query, category })

	const freeEntry = entries.find((entry) => entry.freeToday)
	const origin = await getRequestSiteOrigin()
	const itemList = {
		'@context': 'https://schema.org',
		'@type': 'ItemList',
		name: t('metaTitle'),
		numberOfItems: entries.length,
		itemListElement: entries.map((entry, index) => ({
			'@type': 'ListItem',
			position: index + 1,
			name: entry.title,
			url: `${origin}${localizedPath(locale, `/games/${entry.slug}`)}`,
		})),
	}

	return (
		<main className="flex-1">
			<CatalogHero
				gameCount={entries.length}
				visibleCount={visibleEntries.length}
				query={query}
				category={category}
			/>

			{freeEntry && (
				<CatalogFeatured
					slug={freeEntry.slug}
					name={freeEntry.title}
					tagline={freeEntry.tagline}
					duration={freeEntry.duration}
					highlight={freeEntry.highlight}
					theme={freeEntry.theme}
				/>
			)}

			<section className="section-block">
				<div className="page-shell-wide">
					<h2 className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">
						{t('suiteTitle')}
					</h2>
					<p className="mt-2 max-w-2xl text-muted-foreground">
						{isPremium
							? t('suiteBodyPremium')
							: t('suiteBody', { count: Math.max(entries.length - 1, 0) })}
					</p>

					{visibleEntries.length === 0 ? (
						<div className="mt-6 rounded-3xl border border-dashed border-border px-6 py-12 text-center">
							<p className="font-display text-lg font-bold">{t('emptyTitle')}</p>
							<p className="mt-1 text-sm text-muted-foreground">{t('emptyDescription')}</p>
							<Link
								href="/games"
								className="mt-4 inline-flex h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold transition-colors hover:border-primary/30 hover:text-primary"
							>
								{t('clearFilter')}
							</Link>
						</div>
					) : (
						<ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
							{visibleEntries.map((entry, index) => (
								<li key={entry.slug} className="h-full">
									<GameTile
										slug={entry.slug}
										name={entry.title}
										tagline={entry.tagline}
										meta={[entry.duration, entry.highlight].filter(Boolean).join(' • ')}
										theme={entry.theme}
										status={entry.freeToday ? 'free' : 'premium'}
										showUnlock={!isPremium}
										index={index}
										labels={{
											play: t('play'),
											playAgain: t('play'),
											unlock: t('unlock'),
											freeToday: t('freeToday'),
											premium: t('premium'),
										}}
									/>
								</li>
							))}
						</ul>
					)}
				</div>
			</section>

			<CatalogExplainer gameCount={entries.length} />
			<CatalogFaq />

			<section className="pb-12 md:pb-16">
				<div className="page-shell-wide">
					<div className="flex flex-col items-center gap-4 rounded-3xl border border-border/70 bg-surface-muted/60 px-6 py-8 text-center">
						<h2 className="font-display text-2xl font-extrabold tracking-tight">
							{t('closing.title')}
						</h2>
						<p className="max-w-xl text-sm text-muted-foreground">{t('closing.body')}</p>
						<div className="flex flex-wrap items-center justify-center gap-3">
							{freeEntry && (
								<Link
									href={`/games/${freeEntry.slug}`}
									className="inline-flex h-12 items-center gap-2 rounded-2xl bg-primary px-6 font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:-translate-y-0.5 active:scale-[0.99]"
								>
									<Play className="h-4 w-4" aria-hidden="true" />
									{t('closing.play', { game: freeEntry.title })}
								</Link>
							)}
							<Link
								href="/"
								className="inline-flex h-12 items-center gap-2 rounded-2xl border border-border bg-background px-5 font-semibold transition-colors hover:border-primary/30 hover:text-primary"
							>
								{t('closing.home')}
								<ArrowRight className="h-4 w-4" aria-hidden="true" />
							</Link>
							<Link
								href="/pricing"
								className="inline-flex h-12 items-center rounded-2xl px-4 font-semibold text-primary transition-colors hover:bg-primary/10"
							>
								{t('closing.pricing')}
							</Link>
						</div>
					</div>
				</div>
			</section>

			<script
				type="application/ld+json"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD with trusted registry content
				dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
			/>
		</main>
	)
}
