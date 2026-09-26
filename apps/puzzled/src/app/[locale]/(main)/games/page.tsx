import { getTranslations, setRequestLocale } from 'next-intl/server'
import { CatalogFaq } from '@/features/catalog/components/catalog-faq'
import { CatalogHero } from '@/features/catalog/components/catalog-hero'
import {
	buildCatalogEntries,
	filterCatalogEntries,
	parseCatalogCategory,
	readMessage,
} from '@/features/catalog/lib/catalog'
import { getAllGameMetadata } from '@/games/registry'
import { getTodaysFreeGame } from '@/lib/free-rotation'
import { Link } from '@/lib/i18n/routing'
import { buildPageMetadata, localizedPath, ogImagePath } from '@/lib/seo/metadata'
import { getRequestSiteOrigin } from '@/lib/site-origin.server'
import { GameTile } from '@/shared/components/games/game-tile'

// Force dynamic rendering - the featured module follows the product day
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
 * day's featured module leads, the rest of the suite follows, and the page
 * explains the daily ritual for a first-time visitor. Every module is open to
 * every player. Data is registry + free rotation (static/pure).
 */
export default async function GamesCatalogPage({ params, searchParams }: Props) {
	const { locale } = await params
	const { q, category: categoryParam } = await searchParams
	setRequestLocale(locale)

	const t = await getTranslations('catalog')
	// Catalog entry keys are root-qualified (`games.wordGuess.name`).
	const tRoot = await getTranslations()

	const entries = buildCatalogEntries({
		modules: getAllGameMetadata(),
		freeGameSlug: getTodaysFreeGame(),
	}).map((entry) => ({
		...entry,
		title: readMessage(tRoot, entry.titleKey, entry.canonicalTitle),
		tagline: readMessage(tRoot, entry.taglineKey, ''),
		highlight: readMessage(tRoot, entry.highlightKey, ''),
	}))

	const query = (Array.isArray(q) ? q[0] : q)?.trim() ?? ''
	const category = parseCatalogCategory(categoryParam)
	const visibleEntries = filterCatalogEntries(entries, { query, category })

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

			<section className="pb-12 md:pb-16" aria-labelledby="catalog-suite">
				<div className="page-shell-wide">
					<h2 id="catalog-suite" className="sr-only">
						{t('suiteTitle')}
					</h2>
					{visibleEntries.length === 0 ? (
						<div className="mt-5 rounded-3xl border border-dashed border-border px-6 py-12 text-center">
							<p className="font-display text-lg">{t('emptyTitle')}</p>
							<p className="mt-1 text-sm text-muted-foreground">{t('emptyDescription')}</p>
							<Link
								href="/games"
								className="pressable mt-4 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
							>
								{t('clearFilter')}
							</Link>
						</div>
					) : (
						<ul className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
							{visibleEntries.map((entry, index) => (
								<li key={entry.slug} className="h-full">
									<GameTile
										slug={entry.slug}
										name={entry.title}
										tagline={entry.tagline}
										meta={[entry.duration, entry.highlight].filter(Boolean).join(' • ')}
										theme={entry.theme}
										status={entry.freeToday ? 'free' : 'play'}
										index={index}
										labels={{
											play: t('play'),
											playAgain: t('play'),
											freeToday: t('freeToday'),
										}}
									/>
								</li>
							))}
						</ul>
					)}
				</div>
			</section>

			<CatalogFaq />

			<script
				type="application/ld+json"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD built from the registry and translations
				dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
			/>
		</main>
	)
}
