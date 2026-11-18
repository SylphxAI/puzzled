export const dynamic = 'force-dynamic'

import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AdSlot } from '@/features/ads/components/ad-slot'
import { CATALOG_CATEGORIES } from '@/features/catalog/lib/catalog'
import { ArchiveAlmanac } from '@/features/daily/components/archive-almanac'
import { ARCHIVE_WINDOW_DAYS, archiveDayKeys } from '@/features/daily/lib/archive-days'
import { CheckoutOffer } from '@/features/plus-offer/components/checkout-offer'
import { getAllGameMetadata } from '@/games/registry'
import { adsConfig, adsFor } from '@/lib/ads'
import { getServerPlusAccess } from '@/lib/api/server'
import { OPEN_ACCESS } from '@/lib/billing/plus'
import { env } from '@/lib/env'
import { slugToCamelCase } from '@/lib/game-slug'
import { Link } from '@/lib/i18n/routing'
import { currentUser } from '@/lib/identity/server'
import { withPresentationDeadline } from '@/lib/presentation-document'
import { productDayKey } from '@/lib/product-day'
import { buildPageMetadata, ogImagePath } from '@/lib/seo/metadata'

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

/** Same server product-day calendar for every viewer; Connect admits dated play. */
export default async function ArchivePage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)
	const t = await getTranslations('archive')
	const tGames = await getTranslations('games')
	const tCatalog = await getTranslations('catalog')
	const user = await withPresentationDeadline(currentUser(), null)
	const access = await withPresentationDeadline(getServerPlusAccess(Boolean(user?.id)), OPEN_ACCESS)
	const locked = access.salesOpen && !access.entitled
	const ads = adsFor(adsConfig(env), access.entitled)
	const games = getAllGameMetadata().map((game) => ({
		slug: game.slug,
		name: tGames(`${slugToCamelCase(game.slug)}.name`),
		theme: game.display.theme,
		category: game.category,
	}))
	const categories = CATALOG_CATEGORIES.filter((value) =>
		games.some((game) => game.category === value),
	).map((value) => ({ value, label: tCatalog(`category.${value}`) }))
	const days = archiveDayKeys(productDayKey())

	return (
		<main className="flex-1">
			<section className="page-shell-wide py-6 md:py-10">
				<div
					className={
						locked
							? 'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-8'
							: 'grid items-start gap-6'
					}
				>
					<div className="min-w-0">
						<div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
							<div className="min-w-0">
								<p className="eyebrow">{t('eyebrow')}</p>
								<h1 className="mt-1.5 font-display text-3xl leading-tight md:text-4xl">
									{t('title')}
								</h1>
								<p className="mt-2 max-w-2xl text-[15px] text-muted-foreground">
									{t('listBody', { count: ARCHIVE_WINDOW_DAYS, games: games.length })}
								</p>
							</div>
							<Link
								href="/games"
								className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
							>
								{t('backToGames')}
							</Link>
						</div>
						<section className="mt-5" aria-labelledby="archive-list-title">
							<h2 id="archive-list-title" className="sr-only">
								{t('listTitle')}
							</h2>
							<ArchiveAlmanac
								days={days}
								games={games}
								locale={locale}
								locked={locked}
								categories={categories}
								labels={{
									dayPicker: t('dayPicker'),
									filter: t('filterLabel'),
									all: tCatalog('filterAll'),
									yesterday: t('yesterday'),
									dayCount: t.raw('dayCount') as string,
									play: t('play'),
									locked: t('locked'),
								}}
							/>
						</section>
					</div>
					{locked ? (
						<aside className="lg:sticky lg:top-20">
							<CheckoutOffer
								locale={locale}
								signedIn={Boolean(user?.id)}
								callbackUrl="/archive"
								gameCount={games.length}
							/>
						</aside>
					) : null}
				</div>
				{ads ? (
					<div className="mt-8 max-w-2xl">
						<AdSlot config={ads} />
					</div>
				) : null}
			</section>
		</main>
	)
}
