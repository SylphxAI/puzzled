export const dynamic = 'force-dynamic'

import { CalendarDays } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AdSlot } from '@/features/ads/components/ad-slot'
import { ArchiveGrid } from '@/features/daily/components/archive-grid'
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
	const user = await withPresentationDeadline(currentUser(), null)
	const access = await withPresentationDeadline(getServerPlusAccess(Boolean(user?.id)), OPEN_ACCESS)
	const locked = access.salesOpen && !access.entitled
	const ads = adsFor(adsConfig(env), access.entitled)
	const games = getAllGameMetadata().map((game) => ({
		slug: game.slug,
		name: tGames(`${slugToCamelCase(game.slug)}.name`),
		theme: game.display.theme,
	}))
	const days = archiveDayKeys(productDayKey())

	return (
		<main className="flex-1">
			<section className="page-shell py-10 md:py-14">
				<div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
					<header>
						<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							{t('eyebrow')}
						</p>
						<h1 className="mt-2 font-display text-3xl md:text-4xl">{t('title')}</h1>
						<p className="mt-3 max-w-2xl text-muted-foreground">{t('body')}</p>
						<Link
							href="/games"
							className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
						>
							{t('backToGames')}
						</Link>
					</header>
					{locked ? (
						<CheckoutOffer
							locale={locale}
							signedIn={Boolean(user?.id)}
							callbackUrl="/archive"
							gameCount={games.length}
						/>
					) : null}
				</div>
				<section className="mt-8" aria-labelledby="archive-list-title">
					<div className="flex items-center gap-3">
						<CalendarDays className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
						<h2 id="archive-list-title" className="font-display text-xl">
							{t('listTitle')}
						</h2>
					</div>
					<p className="mb-6 mt-2 max-w-2xl text-sm text-muted-foreground">
						{t('listBody', { count: ARCHIVE_WINDOW_DAYS, games: games.length })}
					</p>
					<ArchiveGrid
						days={days}
						games={games}
						locale={locale}
						locked={locked}
						lockedLabel={t('locked')}
						playLabel={t('play')}
					/>
				</section>
				{ads ? (
					<div className="mt-8 max-w-2xl">
						<AdSlot config={ads} />
					</div>
				) : null}
			</section>
		</main>
	)
}
