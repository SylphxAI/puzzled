import { cookies, headers } from 'next/headers'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireMember } from '@/features/console/lib/require-member'
import { getServerPlans, getServerSubscription } from '@/lib/api/server'
import {
	availableCurrencies,
	COUNTRY_HEADER,
	CURRENCY_COOKIE,
	chooseCurrency,
} from '@/lib/billing/currency'
import { checkoutConfirmed, minorUnitsToMajor, planCards, subscriptionView } from '@/lib/billing/plus'
import { safeCallbackPath } from '@/lib/identity/after-sign-up'
import { logger } from '@/lib/logger'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { CheckoutReturnTracker } from './checkout-return-tracker'
import { SubscriptionPanel } from './subscription-client'

type Props = {
	params: Promise<{ locale: string }>
	searchParams: Promise<{ checkout?: string; s?: string; callbackUrl?: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'plus.subscription' })
	return buildPageMetadata({
		locale,
		path: '/settings/subscription',
		title: t('title'),
		description: t('description'),
		noindex: true,
	})
}

/**
 * Puzzled Plus for the signed-in account. Returning from checkout reads the
 * subscription back from Sylphx Money first, so the page never waits on a webhook.
 */
export default async function SubscriptionSettingsPage({ params, searchParams }: Props) {
	const { locale } = await params
	const { checkout, s: checkoutSession, callbackUrl: rawCallbackUrl } = await searchParams
	setRequestLocale(locale)
	const callbackUrl = safeCallbackPath(rawCallbackUrl) ?? undefined
	const returnTo = callbackUrl
		? `/settings/subscription?callbackUrl=${encodeURIComponent(callbackUrl)}`
		: '/settings/subscription'
	const user = await requireMember({ locale, returnTo })

	const fromCheckout = checkout === 'success'
	let view = null
	try {
		view = subscriptionView(await getServerSubscription(fromCheckout))
	} catch (error) {
		logger.error('plus.subscription-page-read-failed', { error })
	}

	// A confirmed subscription coming back from Money checkout is a conversion.
	const conversion =
		fromCheckout && checkoutSession && checkoutConfirmed(view)
			? view?.status === 'trialing'
				? 'trialing'
				: view?.status === 'active'
					? 'paid'
					: null
			: null

	let checkoutPlan: { planId: string; value?: number; currency?: string } | null = null
	if (conversion && checkoutSession && view?.planId) {
		checkoutPlan = { planId: view.planId }
		try {
			const [plans, cookieStore, requestHeaders] = await Promise.all([
				getServerPlans(),
				cookies(),
				headers(),
			])
			if (plans?.plans?.length) {
				const currencies = availableCurrencies(plans.plans)
				const currency = chooseCurrency({
					cookie: cookieStore.get(CURRENCY_COOKIE)?.value,
					country: requestHeaders.get(COUNTRY_HEADER),
					locale,
					available: currencies,
				})
				const card = planCards(plans.plans, currency).find((c) => c.id === view.planId)
				if (card) {
					checkoutPlan = {
						planId: card.id,
						value: minorUnitsToMajor(card.amountMinor, card.currency),
						currency: card.currency.toUpperCase(),
					}
				}
			}
		} catch (error) {
			logger.warn('plus.subscription-plans-read-failed', { error })
		}
	}

	return (
		<>
			{conversion && checkoutSession ? (
				<CheckoutReturnTracker
					sessionId={checkoutSession}
					status={conversion}
					userId={user?.id}
					planId={checkoutPlan?.planId}
					value={checkoutPlan?.value}
					currency={checkoutPlan?.currency}
				/>
			) : null}
			<SubscriptionPanel
				view={view}
				locale={locale}
				fromCheckout={fromCheckout}
				callbackUrl={callbackUrl}
			/>
		</>
	)
}
