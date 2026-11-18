import { cookies, headers } from 'next/headers'
import { getLocale, getTranslations } from 'next-intl/server'
import { CurrencySwitcher } from '@/app/[locale]/(main)/pricing/currency-switcher'
import { PlusOffer } from '@/app/[locale]/(main)/pricing/plus-offer'
import { getServerPlans } from '@/lib/api/server'
import {
	availableCurrencies,
	COUNTRY_HEADER,
	CURRENCY_COOKIE,
	chooseCurrency,
} from '@/lib/billing/currency'
import { planCards } from '@/lib/billing/plus'
import { Link } from '@/lib/i18n/routing'
import { safeCallbackPath } from '@/lib/identity/after-sign-up'
import { withPresentationDeadline } from '@/lib/presentation-document'

type Props = {
	locale?: string
	signedIn: boolean
	callbackUrl: string
	gameCount: number
}

/** Server-only catalogue loader. Pass its rendered node into client paywalls. */
export async function CheckoutOffer({
	locale: pageLocale,
	signedIn,
	callbackUrl,
	gameCount,
}: Props) {
	const locale = pageLocale ?? (await getLocale())
	const t = await getTranslations({ locale, namespace: 'plus.checkoutOffer' })
	const tPlus = await getTranslations({ locale, namespace: 'plus' })
	const [plans, cookieStore, requestHeaders] = await Promise.all([
		withPresentationDeadline(getServerPlans(), null),
		cookies(),
		headers(),
	])
	const returnTo = safeCallbackPath(callbackUrl) ?? '/archive'
	const individual = plans?.salesOpen
		? plans.plans.filter(
				(plan) =>
					!plan.family &&
					plan.prices.length > 0 &&
					((plan.id === 'individual_once' && plan.interval === '' && plan.accessDays > 0) ||
						(plan.id === 'individual_yearly' && plan.interval === 'year') ||
						(plan.id === 'individual_monthly' && plan.interval === 'month')),
			)
		: []
	const currencies = availableCurrencies(individual)
	const currency = chooseCurrency({
		cookie: cookieStore.get(CURRENCY_COOKIE)?.value,
		country: requestHeaders.get(COUNTRY_HEADER),
		locale,
		available: currencies,
	})
	// Never silently switch an option to a different charge currency.
	const cards = currencies.length
		? planCards(individual, currency).filter((card) => card.currency === currency)
		: []
	const once = cards.find((card) => card.id === 'individual_once' && card.accessDays > 0)
	const yearly = cards.find((card) => card.id === 'individual_yearly')
	const monthly = cards.find((card) => card.id === 'individual_monthly')
	const secondary = (
		<Link
			href={{ pathname: '/pricing', query: { callbackUrl: returnTo } }}
			className="inline-flex min-h-12 items-center text-sm font-semibold underline underline-offset-4 hover:text-foreground"
		>
			{t('comparePlans')}
		</Link>
	)
	if (!once && !yearly && !monthly) {
		return (
			<div className="rounded-2xl border border-border bg-card p-5">
				<p className="font-semibold">{t('unavailableTitle')}</p>
				<p className="mt-2 text-sm text-muted-foreground">{t('unavailableBody')}</p>
				{secondary}
			</div>
		)
	}
	return (
		<PlusOffer
			key={currency}
			id="plus"
			title={tPlus('name')}
			subtitle={t('body', { count: gameCount })}
			accentDot
			emphasized
			radioName="unlock-plan"
			once={once}
			yearly={yearly}
			monthly={monthly}
			initialPlan={once?.id}
			locale={locale}
			signedIn={signedIn}
			subscribed={false}
			callbackUrl={returnTo}
			headerSlot={<CurrencySwitcher currencies={currencies} current={currency} />}
			footerSlot={secondary}
		/>
	)
}
