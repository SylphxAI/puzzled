import { ArrowRight, Play } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import {
	MarketingCta,
	MarketingFaq,
	MarketingHero,
	MarketingSection,
	PricingBillingFacts,
	PricingComparison,
} from '@/features/marketing/components'
import { getAllGameMetadata } from '@/games/registry'
import { getServerTodayOverview } from '@/lib/api/server'
import { getFreeGameRotation, getTodaysFreeGame } from '@/lib/billing/server'
import { SUPPORT_EMAIL } from '@/lib/config/app'
import { slugToCamelCase } from '@/lib/game-slug'
import { Link } from '@/lib/i18n/routing'
import { withPresentationDeadline } from '@/lib/presentation-document'
import { buildPageMetadata, ogImagePath } from '@/lib/seo/metadata'
import { formatNumber } from '@/lib/utils'
import { PricingContent } from './pricing-client'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'pricing' })

	return buildPageMetadata({
		locale,
		path: '/pricing',
		title: t('metaTitle'),
		description: t('metaDescription'),
		imagePath: ogImagePath({
			title: t('metaTitle'),
			subtitle: t('hero.title'),
			eyebrow: t('hero.eyebrow'),
			theme: 'violet',
		}),
	})
}

/**
 * Pricing surface.
 *
 * The free floor is a product rule (one module every day, no account) and the
 * rotation comes from `src/lib/free-rotation.ts`; every amount is read from
 * the billing authority inside the plan cards, and a price the authority has
 * not published stays unprinted rather than invented. The player count is the
 * same server overview the home surface uses, and stays hidden when the read
 * fails.
 */
export default async function PricingPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	const t = await getTranslations('pricing')
	const tRoot = await getTranslations()

	const freeGameSlug = getTodaysFreeGame()
	const freeGameName = tRoot(`games.${slugToCamelCase(freeGameSlug)}.name`)
	const modules = getAllGameMetadata()
	const rotation = getFreeGameRotation()

	const overview = await withPresentationDeadline(getServerTodayOverview(), null)
	const playersToday = overview?.playerCount ?? 0

	const facts = [
		t('hero.factFree'),
		t('hero.factNoAccount'),
		...(playersToday > 0
			? [t('hero.playersToday', { count: formatNumber(playersToday, locale) })]
			: []),
	]

	const faqItems = [
		{ question: t('faq.cancel.question'), answer: t('faq.cancel.answer') },
		{ question: t('faq.trial.question'), answer: t('faq.trial.answer') },
		{ question: t('faq.price.question'), answer: t('faq.price.answer') },
		{
			question: t('faq.refund.question'),
			answer: t('faq.refund.answer', { email: SUPPORT_EMAIL }),
		},
		{ question: t('faq.access.question'), answer: t('faq.access.answer') },
		{ question: t('faq.switch.question'), answer: t('faq.switch.answer') },
	]

	return (
		<main className="flex-1">
			<MarketingHero
				eyebrow={t('hero.eyebrow')}
				title={t('hero.title')}
				lead={t('hero.lead')}
				facts={facts}
				actions={
					<>
						<Link
							href={`/games/${freeGameSlug}`}
							className="inline-flex h-12 items-center gap-2 rounded-2xl bg-primary px-6 font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:-translate-y-0.5 hover:bg-primary-hover active:scale-[0.98]"
						>
							<Play className="h-4 w-4" aria-hidden="true" />
							{t('hero.freeCta', { game: freeGameName })}
						</Link>
						<a
							href="#plans"
							className="inline-flex h-12 items-center gap-2 rounded-2xl border border-border bg-background/80 px-5 font-semibold backdrop-blur transition-colors hover:border-primary/30 hover:text-primary"
						>
							{t('hero.plansCta')}
							<ArrowRight className="h-4 w-4" aria-hidden="true" />
						</a>
					</>
				}
				aside={
					<div
						className="surface-card animate-enter p-5 md:p-6"
						style={{ '--enter-delay': '120ms' } as React.CSSProperties}
					>
						<h2 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
							{t('hero.todayTitle')}
						</h2>
						<p className="mt-2 font-display text-2xl font-extrabold leading-tight">
							{freeGameName}
						</p>
						<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
							{t('hero.rotationBody', {
								rotating: rotation.length,
								total: modules.length,
							})}
						</p>
						<Link
							href={`/games/${freeGameSlug}`}
							className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background px-5 font-semibold transition-colors hover:border-primary/30 hover:text-primary"
						>
							{t('hero.todayOpen', { game: freeGameName })}
						</Link>
						<p className="mt-3 text-xs text-muted-foreground">{t('hero.rotationNote')}</p>
					</div>
				}
			/>

			<MarketingSection id="plans" title={t('plans.title')} subtitle={t('plans.subtitle')} flush>
				<PricingContent
					locale={locale}
					freeGameSlug={freeGameSlug}
					freeGameName={freeGameName}
					moduleCount={modules.length}
				/>
			</MarketingSection>

			<PricingBillingFacts />
			<PricingComparison moduleCount={modules.length} />

			<MarketingFaq
				id="billing-faq"
				title={t('faq.title')}
				subtitle={t('faq.subtitle')}
				items={faqItems}
			/>

			<MarketingCta title={t('cta.title')} body={t('cta.body', { game: freeGameName })}>
				<Link
					href={`/games/${freeGameSlug}`}
					className="inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-6 font-semibold text-ink transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
				>
					<Play className="h-4 w-4" aria-hidden="true" />
					{t('cta.play', { game: freeGameName })}
				</Link>
				<Link
					href="/games"
					className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/25 px-5 font-semibold text-white transition-colors hover:bg-white/10"
				>
					{t('cta.browse', { count: modules.length })}
					<ArrowRight className="h-4 w-4" aria-hidden="true" />
				</Link>
			</MarketingCta>
		</main>
	)
}
