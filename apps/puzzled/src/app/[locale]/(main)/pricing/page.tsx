import { Check, Play } from 'lucide-react'
import { cookies, headers } from 'next/headers'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { MarketingHero, MarketingSection } from '@/features/marketing/components'
import { getAllGameMetadata } from '@/games/registry'
import { getServerPlans, getServerPlusAccess } from '@/lib/api/server'
import {
	availableCurrencies,
	COUNTRY_HEADER,
	CURRENCY_COOKIE,
	chooseCurrency,
} from '@/lib/billing/currency'
import { formatPrice, planCards, showsCurrentPlan } from '@/lib/billing/plus'
import { getTodaysFreeGame } from '@/lib/free-rotation'
import { slugToCamelCase } from '@/lib/game-slug'
import { Link } from '@/lib/i18n/routing'
import { safeCallbackPath } from '@/lib/identity/after-sign-up'
import { currentUser } from '@/lib/identity/server'
import { withPresentationDeadline } from '@/lib/presentation-document'
import { buildPageMetadata, ogImagePath } from '@/lib/seo/metadata'
import { cn } from '@/lib/utils'
import { CurrencySwitcher } from './currency-switcher'
import { PlusOffer } from './plus-offer'

type Props = {
	params: Promise<{ locale: string }>
	searchParams: Promise<{ checkout?: string; plan?: string; callbackUrl?: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'plus.pricing' })
	const tPlus = await getTranslations({ locale, namespace: 'plus' })
	return buildPageMetadata({
		locale,
		path: '/pricing',
		title: t('metaTitle'),
		description: t('metaDescription'),
		imagePath: ogImagePath({
			title: t('metaTitle'),
			subtitle: t('lead', { count: getAllGameMetadata().length }),
			eyebrow: tPlus('name'),
		}),
	})
}

/**
 * Puzzled Plus plans. Every amount is Sylphx Money's catalogue price (ListPlans),
 * tax included, in the currency checkout will charge; nothing is hardcoded.
 * While sales are closed the page says everything is free.
 *
 * When sales are open, Individual (`#plus`) and Family (`#family`) appear once
 * each side by side in the hero comparison, with only the Free tier below.
 */
export default async function PricingPage({ params, searchParams }: Props) {
	const { locale } = await params
	const { checkout, plan, callbackUrl: rawCallbackUrl } = await searchParams
	setRequestLocale(locale)
	const callbackUrl = safeCallbackPath(rawCallbackUrl) ?? undefined

	const t = await getTranslations('plus.pricing')
	const tPlus = await getTranslations('plus')
	const tGames = await getTranslations('games')
	const user = await withPresentationDeadline(currentUser(), null)
	const [plans, access] = await Promise.all([
		withPresentationDeadline(getServerPlans(), null),
		withPresentationDeadline(getServerPlusAccess(Boolean(user)), null),
	])

	const gameCount = getAllGameMetadata().length
	const freeSlug = getTodaysFreeGame()
	const freeName = tGames(`${slugToCamelCase(freeSlug)}.name`)
	const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()])
	const currencies = plans?.salesOpen ? availableCurrencies(plans.plans) : []
	const currency = chooseCurrency({
		cookie: cookieStore.get(CURRENCY_COOKIE)?.value,
		country: requestHeaders.get(COUNTRY_HEADER),
		locale,
		available: currencies,
	})
	const cards = plans?.salesOpen ? planCards(plans.plans, currency) : []
	const monthly = (family: boolean) =>
		cards.find((c) => c.family === family && c.interval === 'month')
	const yearly = (family: boolean) =>
		cards.find((c) => c.family === family && c.interval === 'year')
	const familyMax = plans?.familyMaxMembers ?? 4

	const includes = (family: boolean) => [
		t('includesAllGames', { count: gameCount }),
		t('includesArchive'),
		t('includesStats'),
		...(family ? [t('includesFamily', { count: familyMax })] : []),
	]

	const plusMember = showsCurrentPlan(access)
	const plusOnce = cards.find((card) => !card.family && card.interval === 'once')
	const plusYear = yearly(false)
	const plusMonth = monthly(false)
	const familyYear = yearly(true)
	const familyMonth = monthly(true)
	const memberButtonClass = [
		'pressable inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full',
		'bg-primary px-5 font-semibold text-primary-foreground transition-colors hover:bg-primary-hover',
		'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
	].join(' ')
	const textLinkClass = [
		'inline-flex min-h-11 items-center justify-center text-[15px] font-semibold',
		'underline underline-offset-4 hover:text-foreground',
	].join(' ')

	if (cards.length === 0) {
		return (
			<main className="flex-1">
				<MarketingHero
					eyebrow={tPlus('name')}
					title={t('title')}
					lead={t('lead', { count: gameCount })}
					actions={
						<Link
							href={`/games/${freeSlug}`}
							className="pressable inline-flex h-12 items-center gap-2 rounded-full border border-border bg-card px-5 font-semibold transition-colors hover:bg-muted"
						>
							<Play className="h-4 w-4" aria-hidden="true" />
							{t('playFree', { game: freeName })}
						</Link>
					}
				/>
				<MarketingSection id="plans" flush>
					<div className="surface-card max-w-xl p-6 sm:p-7">
						<p className="flex items-center gap-2 text-sm font-semibold">
							<span
								className="inline-block h-2.5 w-2.5 rounded-[3px] bg-accent-warm"
								aria-hidden="true"
							/>
							{tPlus('name')}
						</p>
						<h2 className="mt-2 font-display text-2xl">{t('closedTitle')}</h2>
						<p className="mt-2 text-[15px] text-muted-foreground">{t('closedBody')}</p>
						<p className="mt-1 text-[15px] font-semibold">{t('purchasesSoon')}</p>
						<ul className="mt-5 space-y-2.5 border-t border-border pt-5">
							{includes(true).map((line) => (
								<li key={line} className="flex items-start gap-2.5 text-[15px]">
									<Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
									{line}
								</li>
							))}
						</ul>
					</div>
				</MarketingSection>
			</main>
		)
	}

	const individualFooter = (
		<div className="mt-1 flex flex-col items-center">
			<a href="#family" className={textLinkClass}>
				{t('familyLink', { count: familyMax })}
			</a>
			<Link href={`/games/${freeSlug}`} className={textLinkClass}>
				{t('notNowPlayFree')}
			</Link>
		</div>
	)

	return (
		<main className="flex-1">
			<section className="page-shell-wide pb-8 pt-4 md:pb-12 md:pt-10">
				{checkout === 'cancelled' ? (
					<output className="mb-3 block rounded-xl bg-muted px-4 py-3 text-sm">
						{t('checkoutCancelled')}
					</output>
				) : null}
				<div className="mb-4 max-w-2xl md:mb-8">
					<p className="eyebrow">{tPlus('name')}</p>
					<h1
						className={cn(
							'mt-1 font-display text-[1.75rem] leading-tight text-balance',
							'lg:mt-2 lg:text-5xl',
						)}
					>
						{t('title')}
					</h1>
					<p className="mt-1.5 text-[15px] text-muted-foreground lg:mt-3 lg:text-lg">
						{t('offerLead', { count: gameCount })}
					</p>
				</div>
				<div className="grid gap-6 lg:grid-cols-2 lg:items-start lg:gap-8">
					{plusMember ? (
						<div id="plus" className="scroll-mt-24">
							<CurrencySwitcher currencies={currencies} current={currency} />
							<div className="surface-card border-2 border-foreground p-5 shadow-lg">
								<p className="font-display text-xl">{t('currentPlan')}</p>
								<Link href="/settings/subscription" className={cn(memberButtonClass, 'mt-4')}>
									{t('manage')}
								</Link>
							</div>
							{individualFooter}
						</div>
					) : (
						<PlusOffer
							id="plus"
							title={tPlus('name')}
							subtitle={t('individualBody')}
							accentDot
							emphasized
							features={includes(false)}
							radioName="plus-interval"
							returnAnchor="plus"
							initialPlan={plan}
							callbackUrl={callbackUrl}
							once={plusOnce}
							yearly={plusYear}
							monthly={plusMonth}
							locale={locale}
							signedIn={Boolean(user)}
							subscribed={false}
							headerSlot={<CurrencySwitcher currencies={currencies} current={currency} />}
							footerSlot={individualFooter}
						/>
					)}
					{familyYear || familyMonth ? (
						<PlusOffer
							id="family"
							title={t('family')}
							subtitle={t('familyBody', { count: familyMax })}
							features={includes(true)}
							radioName="family-interval"
							returnAnchor="family"
							guestPrefix={t('family')}
							initialPlan={plan}
							callbackUrl={callbackUrl}
							yearly={familyYear}
							monthly={familyMonth}
							locale={locale}
							signedIn={Boolean(user)}
							subscribed={plusMember}
						/>
					) : null}
				</div>
			</section>

			<MarketingSection id="plans" className="pt-0 md:pt-0">
				<div
					className={cn(
						'flex flex-col justify-between gap-4 rounded-2xl border border-border p-5',
						'sm:flex-row sm:items-center sm:p-6',
					)}
				>
					<div>
						<h2 className="font-display text-xl">{t('freeTitle')}</h2>
						<p className="mt-1 text-sm text-muted-foreground">{t('freeBody')}</p>
					</div>
					<p className="shrink-0 font-display text-3xl tnum">{formatPrice(0, currency, locale)}</p>
				</div>
				<p className="mt-6 max-w-3xl text-xs leading-relaxed text-muted-foreground">
					{t('legal')}{' '}
					<Link href="/terms#subscriptions" className="underline">
						{t('manage')}
					</Link>
				</p>
			</MarketingSection>
		</main>
	)
}
