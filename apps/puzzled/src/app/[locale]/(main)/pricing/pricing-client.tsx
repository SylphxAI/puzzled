'use client'

import { useToast } from '@sylphx/ui'
import { Check, ExternalLink, Play } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import {
	annualSavingsPercent,
	formatAmount,
	selectPaidPlans,
} from '@/features/marketing/lib/pricing-plans'
import { Link } from '@/lib/i18n/routing'
import { useBilling, usePlans } from '@/lib/identity/react'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'

type Interval = 'monthly' | 'annual'

type PlanCardModel = {
	key: string
	name: string
	subtitle: string
	/** Null when the authority published no price: nothing is printed. */
	amount: string | null
	cadence: string | null
	/** A derived rate line, e.g. the annual price expressed per month. */
	rate: string | null
	/** A saving computed from both authoritative prices. */
	saving: string | null
	features: readonly string[]
	footnote: string | null
	interval: Interval | null
	slug: string | null
	isFree: boolean
}

type PricingContentProps = {
	locale: string
	freeGameSlug: string
	freeGameName: string
	moduleCount: number
}

/**
 * Plan cards.
 *
 * Prices are presentation of an authority: every figure is read through
 * `usePlans()` from the server-bootstrapped app config, and a card with no
 * price says so instead of printing a number. The previous build shipped
 * hardcoded $4.99/$39.99 fallbacks plus a "POPULAR" badge, neither of which
 * the billing system ever returned. Checkout, entitlement and the sign-in
 * error mapping below are unchanged.
 */
export function PricingContent({
	locale,
	freeGameSlug,
	freeGameName,
	moduleCount,
}: PricingContentProps) {
	const t = useTranslations('pricing')
	const tPlans = useTranslations('subscription')
	const toast = useToast()
	const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)

	const configPlans = usePlans()
	const { isPremium, subscription, createCheckout, isLoading } = useBilling()

	const { monthly, annual, comparable } = selectPaidPlans(configPlans)
	const monthlyPrice = monthly?.monthlyPrice ?? null
	const annualPrice = annual?.annualPrice ?? null
	const savingsPercent = annualSavingsPercent(monthlyPrice, annualPrice, comparable)

	const premiumFeatures = [
		t('plans.premiumFeatureSuite', { count: moduleCount }),
		t('plans.premiumFeatureArchive'),
		t('plans.premiumFeatureStats'),
		t('plans.premiumFeatureFreeze'),
	]

	const cards: PlanCardModel[] = [
		{
			key: 'free',
			name: tPlans('free'),
			subtitle: t('plans.freeSubtitle'),
			// Zero is a real amount: the free tier costs nothing, always.
			amount: formatAmount(0, locale),
			cadence: null,
			rate: null,
			saving: null,
			features: [
				t('plans.freeFeatureDaily'),
				t('plans.freeFeatureAccount'),
				t('plans.freeFeatureStreak'),
			],
			footnote: null,
			interval: null,
			slug: null,
			isFree: true,
		},
		{
			key: 'premium-monthly',
			name: tPlans('premium'),
			subtitle: t('plans.monthlySubtitle'),
			amount: monthlyPrice ? formatAmount(monthlyPrice, locale) : null,
			cadence: monthlyPrice ? tPlans('perMonth') : null,
			rate: null,
			saving: null,
			// No trial chip: nothing in checkout starts a trial today
			// (`createCheckout` throws `commerce_checkout_unconfigured` and no trial
			// is created anywhere), so promising one would be a claim we cannot keep.
			features: premiumFeatures,
			footnote: monthlyPrice ? t('plans.cancelNote') : null,
			interval: 'monthly',
			slug: monthly?.slug ?? null,
			isFree: false,
		},
		{
			key: 'premium-annual',
			name: tPlans('annual'),
			subtitle: t('plans.annualSubtitle'),
			amount: annualPrice ? formatAmount(annualPrice, locale) : null,
			cadence: annualPrice ? tPlans('perYear') : null,
			rate: annualPrice
				? t('plans.billedYearly', { amount: formatAmount(annualPrice / 12, locale) })
				: null,
			saving:
				savingsPercent !== null ? t('plans.savingVsMonthly', { percent: savingsPercent }) : null,
			features: premiumFeatures,
			footnote: annualPrice ? t('plans.annualNote') : null,
			interval: 'annual',
			slug: annual?.slug ?? null,
			isFree: false,
		},
	]

	const handleCheckout = async (planSlug: string, interval: Interval) => {
		const planKey = interval === 'annual' ? `${planSlug}-annual` : planSlug
		setCheckoutLoading(planKey)

		try {
			const checkoutUrl = await createCheckout(planSlug, interval)
			// Show success toast before redirect
			toast.success(t('redirectingToCheckout'), t('securePaymentMessage'))
			window.location.href = checkoutUrl
		} catch (error) {
			logger.error('pricing.checkout-failed', { error })

			// Parse error message for user-friendly feedback
			const errorMessage = error instanceof Error ? error.message : 'Unknown error'

			if (errorMessage.includes('not authenticated') || errorMessage.includes('sign in')) {
				toast.error(t('signInRequired'), t('signInToSubscribe'))
			} else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
				toast.error(t('networkError'), t('checkConnectionRetry'))
			} else {
				toast.error(t('checkoutFailed'), t('tryAgainLater'))
			}
		} finally {
			setCheckoutLoading(null)
		}
	}

	return (
		<ul className="grid gap-4 lg:grid-cols-3">
			{cards.map((card) => {
				const isCurrentPlan = Boolean(
					!card.isFree && isPremium && card.slug && subscription?.planSlug === card.slug,
				)
				const busy = checkoutLoading !== null
				const cardKey = card.interval === 'annual' ? `${card.slug}-annual` : (card.slug ?? card.key)

				return (
					<li key={card.key} className="surface-card surface-card-hover flex flex-col p-5 sm:p-6">
						<div>
							<h3 className="font-display text-xl font-extrabold">{card.name}</h3>
							<p className="mt-1 text-sm text-muted-foreground">{card.subtitle}</p>
						</div>

						<div className="mt-5">
							{card.amount ? (
								<p className="flex flex-wrap items-baseline gap-1.5">
									<span className="font-display text-3xl font-extrabold tnum">{card.amount}</span>
									{card.cadence && (
										<span className="text-sm text-muted-foreground">{card.cadence}</span>
									)}
								</p>
							) : (
								<p className="font-display text-lg font-bold text-muted-foreground">
									{t('plans.priceAtCheckout')}
								</p>
							)}

							{card.rate && <p className="mt-1 text-sm tnum text-muted-foreground">{card.rate}</p>}

							{card.saving && (
								<p className="mt-3">
									{/* emerald-800 on the raised surface keeps the label past 4.5:1. */}
									<span className="chip bg-emerald-600/15 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200">
										{card.saving}
									</span>
								</p>
							)}

							{!card.amount && (
								<p className="mt-2 text-xs leading-relaxed text-muted-foreground">
									{t('plans.priceAtCheckoutNote')}
								</p>
							)}
						</div>

						<ul className="mt-5 flex-1 space-y-2.5">
							{card.features.map((feature) => (
								<li key={feature} className="flex items-start gap-2.5">
									<Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
									<span className="text-sm leading-relaxed text-muted-foreground">{feature}</span>
								</li>
							))}
						</ul>

						{card.footnote && (
							<p className="mt-4 text-xs leading-relaxed text-muted-foreground">{card.footnote}</p>
						)}

						<div className="mt-5">
							{card.isFree ? (
								<Link
									href={`/games/${freeGameSlug}`}
									className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background px-5 font-semibold text-foreground transition-colors hover:border-primary/30 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
								>
									<Play className="h-4 w-4" aria-hidden="true" />
									{t('plans.playFree', { game: freeGameName })}
								</Link>
							) : (
								<button
									type="button"
									className={cn(
										'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
										card.key === 'premium-annual'
											? 'bg-primary text-primary-foreground hover:bg-primary-hover'
											: 'border border-border bg-background text-foreground hover:border-primary/30 hover:text-primary',
										(isLoading || busy || isCurrentPlan) && 'cursor-not-allowed opacity-60',
									)}
									disabled={isLoading || busy || isCurrentPlan || !card.slug}
									onClick={() => {
										if (card.slug) handleCheckout(card.slug, card.interval ?? 'monthly')
									}}
								>
									{checkoutLoading === cardKey
										? t('processing')
										: isCurrentPlan
											? tPlans('currentPlan')
											: isPremium
												? tPlans('switchPlan')
												: t('subscribeCta')}
									<ExternalLink className="h-4 w-4" aria-hidden="true" />
								</button>
							)}
						</div>
					</li>
				)
			})}
		</ul>
	)
}
