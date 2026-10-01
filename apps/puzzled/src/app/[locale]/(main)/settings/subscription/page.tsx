import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireMember } from '@/features/console/lib/require-member'
import { getServerSubscription } from '@/lib/api/server'
import { subscriptionView } from '@/lib/billing/plus'
import { logger } from '@/lib/logger'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { CheckoutReturnTracker } from './checkout-return-tracker'
import { SubscriptionPanel } from './subscription-client'

type Props = {
	params: Promise<{ locale: string }>
	searchParams: Promise<{ checkout?: string; s?: string }>
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
	const { checkout, s: checkoutSession } = await searchParams
	setRequestLocale(locale)
	const user = await requireMember({ locale, returnTo: '/settings/subscription' })

	const fromCheckout = checkout === 'success'
	let view = null
	try {
		view = subscriptionView(await getServerSubscription(fromCheckout))
	} catch (error) {
		logger.error('plus.subscription-page-read-failed', { error })
	}

	// A confirmed subscription coming back from Money checkout is a conversion.
	const conversion =
		fromCheckout && checkoutSession && view?.entitled
			? view.status === 'trialing'
				? 'trialing'
				: view.status === 'active'
					? 'paid'
					: null
			: null

	return (
		<>
			{conversion && checkoutSession ? (
				<CheckoutReturnTracker sessionId={checkoutSession} status={conversion} userId={user?.id} />
			) : null}
			<SubscriptionPanel view={view} locale={locale} fromCheckout={fromCheckout} />
		</>
	)
}
