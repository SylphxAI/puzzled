import { Check } from 'lucide-react'
import { cookies, headers } from 'next/headers'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireMember } from '@/features/console/lib/require-member'
import { claimServerCheckout, getServerPlans, getServerSubscription } from '@/lib/api/server'
import {
	availableCurrencies,
	COUNTRY_HEADER,
	CURRENCY_COOKIE,
	chooseCurrency,
} from '@/lib/billing/currency'
import {
	checkoutConfirmed,
	minorUnitsToMajor,
	planCards,
	subscriptionView,
} from '@/lib/billing/plus'
import { CHECKOUT_CLAIM_COOKIE } from '@/lib/connect/billing-client'
import { Link } from '@/lib/i18n/routing'
import { safeCallbackPath } from '@/lib/identity/after-sign-up'
import { currentUser } from '@/lib/identity/server'
import { logger } from '@/lib/logger'
import { withPresentationDeadline } from '@/lib/presentation-document'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { CheckoutReturnTracker } from './checkout-return-tracker'
import { SubscriptionPanel } from './subscription-client'

type SearchParamValue = string | string[] | undefined

type Props = {
	params: Promise<{ locale: string }>
	searchParams: Promise<{
		checkout?: SearchParamValue
		s?: SearchParamValue
		session_id?: SearchParamValue
		checkout_session_id?: SearchParamValue
		callbackUrl?: SearchParamValue
	}>
}

const VALID_CHECKOUT_SESSION_RE = /^[A-Za-z0-9_-]{1,128}$/

function firstParam(value: SearchParamValue): string | undefined {
	return Array.isArray(value) ? value[0] : value
}

function sanitizeCheckoutSessionId(raw: string | undefined): string | undefined {
	if (!raw) return undefined
	const trimmed = raw.trim()
	return VALID_CHECKOUT_SESSION_RE.test(trimmed) ? trimmed : undefined
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
 * Tryit Plus for the signed-in account, plus the post-payment claim handoff for
 * cold-guest checkouts returning from Stripe Checkout (both cookie-backed and
 * cross-browser verified-email match).
 */
export default async function SubscriptionSettingsPage({ params, searchParams }: Props) {
	const { locale } = await params
	const sp = await searchParams
	setRequestLocale(locale)
	const callbackUrl = safeCallbackPath(firstParam(sp.callbackUrl)) ?? undefined
	const rawS = firstParam(sp.s)
	const rawSessionId = firstParam(sp.session_id)
	const rawCheckoutSessionId = firstParam(sp.checkout_session_id)
	const checkoutSession = sanitizeCheckoutSessionId(rawS ?? rawSessionId ?? rawCheckoutSessionId)
	const sessionParamName: 's' | 'session_id' = !rawS && rawSessionId ? 'session_id' : 's'
	const fromCheckout = firstParam(sp.checkout) === 'success' || Boolean(checkoutSession)

	const returnQuery = new URLSearchParams()
	if (fromCheckout) {
		returnQuery.set('checkout', 'success')
	}
	if (checkoutSession) {
		returnQuery.set(sessionParamName, checkoutSession)
	}
	if (callbackUrl) {
		returnQuery.set('callbackUrl', callbackUrl)
	}
	const returnTo =
		returnQuery.size > 0
			? `/settings/subscription?${returnQuery.toString()}`
			: '/settings/subscription'

	const [user, cookieStore, requestHeaders] = await Promise.all([
		withPresentationDeadline(currentUser(), null),
		cookies(),
		headers(),
	])
	const hasClaimCookie = Boolean(cookieStore.get(CHECKOUT_CLAIM_COOKIE)?.value)

	if (!user) {
		if (fromCheckout || hasClaimCookie) {
			const t = await getTranslations('plus.subscription')
			return (
				<section className="mx-auto max-w-lg">
					<div className="surface-card flex flex-col items-center p-6 text-center sm:p-8">
						<span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
							<Check className="h-7 w-7" aria-hidden="true" />
						</span>
						<h1 className="mt-4 font-display text-2xl text-balance">{t('claimTitle')}</h1>
						<p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t('claimBody')}</p>
						<div className="mt-6 flex w-full flex-col gap-3">
							<Link
								href={{ pathname: '/signup', query: { callbackUrl: returnTo } }}
								className="pressable inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-5 font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
							>
								{t('claimCreateAccount')}
							</Link>
							<Link
								href={{ pathname: '/login', query: { callbackUrl: returnTo } }}
								className="pressable inline-flex min-h-12 w-full items-center justify-center rounded-full border border-border bg-background px-5 font-semibold transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
							>
								{t('claimSignIn')}
							</Link>
						</div>
					</div>
				</section>
			)
		}
		await requireMember({ locale, returnTo })
		return null
	}

	// Run :claim BEFORE reading getServerSubscription (which is React.cache-memoized
	// per request): handles both HttpOnly claim_secret cookies and cookie-less
	// cross-browser returns carrying session_id / s via Money verified-email match.
	if (hasClaimCookie || (fromCheckout && checkoutSession)) {
		try {
			await claimServerCheckout(fromCheckout && checkoutSession ? checkoutSession : '', locale)
		} catch (error) {
			// A 409 on an already-bound authenticated checkout is expected.
			logger.warn('plus.checkout-claim-skipped', { error })
		}
	}

	let view = null
	try {
		view = subscriptionView(await getServerSubscription(fromCheckout || hasClaimCookie))
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
			const plans = await getServerPlans()
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
				checkoutSessionId={checkoutSession}
				hasClaimCookie={hasClaimCookie}
				callbackUrl={callbackUrl}
			/>
		</>
	)
}
