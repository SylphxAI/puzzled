'use client'

import type { Plan } from '@sylphx/sdk/react'
import { useBilling, usePlans } from '@sylphx/sdk/react'
import { Button, Card, CardContent, useToast } from '@sylphx/ui'
import { Calendar, Check, Crown, Flame, Snowflake, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { cn } from '@/lib/utils'

/** Plan shape returned by the SDK config */
type PlatformPlan = Plan

/** UI plan representation derived from platform plans */
interface UIPlan {
	id: string
	slug: string
	price: number
	currency: string
	period: 'perMonth' | 'perYear' | null
	interval: 'monthly' | 'annual'
	highlight: boolean
	badge: string | null
	badgeColor: string | null
	trialDays?: number
	savings?: string
	features: string[]
}

/**
 * Map platform plans to UI plan cards.
 *
 * Generates free + monthly + annual cards from the platform plan data.
 * Falls back to hardcoded structure if no plans are available.
 */
function buildUIPlans(platformPlans: PlatformPlan[]): UIPlan[] {
	const plans: UIPlan[] = []

	// Always show a free tier
	plans.push({
		id: 'free',
		slug: 'free',
		price: 0,
		currency: 'usd',
		period: null,
		interval: 'monthly',
		highlight: false,
		badge: null,
		badgeColor: null,
		features: ['dailyPuzzle', 'basicStats'],
	})

	// Find the premium plan (first non-free plan with a monthly price)
	const premiumPlan = platformPlans.find(
		(p) => p.slug !== 'free' && p.monthlyPrice && p.monthlyPrice > 0,
	)

	if (premiumPlan) {
		const features = premiumPlan.features ?? [
			'allGames',
			'streakFreeze',
			'advancedStats',
			'noAds',
			'archive',
		]

		// Monthly card
		plans.push({
			id: 'premium',
			slug: premiumPlan.slug,
			price: premiumPlan.monthlyPrice!,
			currency: 'usd',
			period: 'perMonth',
			interval: 'monthly',
			highlight: true,
			badge: 'popular',
			badgeColor: 'bg-primary',
			trialDays: 7,
			features,
		})

		// Annual card (if annual price exists)
		if (premiumPlan.annualPrice && premiumPlan.annualPrice > 0) {
			plans.push({
				id: 'annual',
				slug: premiumPlan.slug,
				price: premiumPlan.annualPrice,
				currency: 'usd',
				period: 'perYear',
				interval: 'annual',
				highlight: false,
				badge: 'bestValue',
				badgeColor: 'bg-emerald-500',
				trialDays: 7,
				savings: 'savePercent',
				features,
			})
		}
	} else {
		// Fallback: hardcoded premium plans if platform returns nothing
		const defaultFeatures = ['allGames', 'streakFreeze', 'advancedStats', 'noAds', 'archive']
		plans.push({
			id: 'premium',
			slug: 'premium',
			price: 499,
			currency: 'usd',
			period: 'perMonth',
			interval: 'monthly',
			highlight: true,
			badge: 'popular',
			badgeColor: 'bg-primary',
			trialDays: 7,
			features: defaultFeatures,
		})
		plans.push({
			id: 'annual',
			slug: 'premium',
			price: 3999,
			currency: 'usd',
			period: 'perYear',
			interval: 'annual',
			highlight: false,
			badge: 'bestValue',
			badgeColor: 'bg-emerald-500',
			trialDays: 7,
			savings: 'savePercent',
			features: defaultFeatures,
		})
	}

	return plans
}

function formatCurrency(amount: number, currency: string, locale: string): string {
	return new Intl.NumberFormat(locale, {
		style: 'currency',
		currency: currency.toUpperCase(),
		minimumFractionDigits: 0,
		maximumFractionDigits: 2,
	}).format(amount / 100)
}

export function PricingContent({ locale }: { locale: string }) {
	const t = useTranslations('subscription')
	const tPricing = useTranslations('pricing')
	const toast = useToast()
	const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)

	// Plans are now fetched server-side via getAppConfig() and available via usePlans()
	const configPlans = usePlans()
	const { isPremium, subscription, createCheckout, isLoading } = useBilling()

	const PLANS = buildUIPlans(configPlans)

	const handleCheckout = async (planSlug: string, interval: 'monthly' | 'annual' = 'monthly') => {
		const planKey = interval === 'annual' ? `${planSlug}-annual` : planSlug
		setCheckoutLoading(planKey)

		try {
			const checkoutUrl = await createCheckout(planSlug, interval)
			// Show success toast before redirect
			toast.success(tPricing('redirectingToCheckout'), tPricing('securePaymentMessage'))
			window.location.href = checkoutUrl
		} catch (error) {
			console.error('Checkout error:', error)

			// Parse error message for user-friendly feedback
			const errorMessage = error instanceof Error ? error.message : 'Unknown error'

			if (errorMessage.includes('not authenticated') || errorMessage.includes('sign in')) {
				toast.error(tPricing('signInRequired'), tPricing('signInToSubscribe'))
			} else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
				toast.error(tPricing('networkError'), tPricing('checkConnectionRetry'))
			} else {
				toast.error(tPricing('checkoutFailed'), tPricing('tryAgainLater'))
			}
		} finally {
			setCheckoutLoading(null)
		}
	}

	return (
		<div className="mx-auto w-full max-w-4xl space-y-10">
			{/* Hero */}
			<div className="text-center">
				<div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10">
					<Crown className="h-8 w-8 text-primary" />
				</div>
				<h1 className="text-3xl font-bold sm:text-4xl">{tPricing('title')}</h1>
				<p className="mt-3 text-lg text-muted-foreground">{tPricing('subtitle')}</p>
				<p className="mt-2 text-sm text-muted-foreground">Join thousands of daily puzzlers</p>
			</div>

			{/* Value Props */}
			<div className="grid gap-4 sm:grid-cols-3">
				<div className="flex items-center gap-3 rounded-xl bg-muted/50 p-4">
					<Sparkles className="h-6 w-6 text-purple-500" />
					<div>
						<p className="font-medium">{tPricing('valueProp1Title')}</p>
						<p className="text-sm text-muted-foreground">{tPricing('valueProp1Desc')}</p>
					</div>
				</div>
				<div className="flex items-center gap-3 rounded-xl bg-muted/50 p-4">
					<Snowflake className="h-6 w-6 text-cyan-500" />
					<div>
						<p className="font-medium">{tPricing('valueProp2Title')}</p>
						<p className="text-sm text-muted-foreground">{tPricing('valueProp2Desc')}</p>
					</div>
				</div>
				<div className="flex items-center gap-3 rounded-xl bg-muted/50 p-4">
					<Calendar className="h-6 w-6 text-blue-500" />
					<div>
						<p className="font-medium">{tPricing('valueProp3Title')}</p>
						<p className="text-sm text-muted-foreground">{tPricing('valueProp3Desc')}</p>
					</div>
				</div>
			</div>

			{/* Plans */}
			<div className="grid gap-6 sm:grid-cols-3">
				{PLANS.map((plan) => {
					const isCurrentPlan = isPremium && plan.slug === subscription?.planSlug
					const isFree = plan.id === 'free'

					return (
						<Card
							key={plan.id}
							className={cn(
								'relative overflow-hidden transition-all hover:shadow-xl',
								plan.highlight && 'border-primary ring-2 ring-primary shadow-lg sm:scale-[1.05]',
							)}
						>
							{plan.badge && (
								<div
									className={cn(
										'absolute -right-8 top-6 rotate-45 px-10 py-1 text-xs font-semibold text-white',
										plan.badgeColor,
									)}
								>
									{tPricing(plan.badge)}
								</div>
							)}

							<CardContent className="p-6">
								<div className="mb-4">
									<h3 className="text-xl font-bold">
										{t(plan.id as 'free' | 'premium' | 'annual')}
									</h3>
									{plan.savings && (
										<span className="inline-block mt-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
											{tPricing(plan.savings)}
										</span>
									)}
								</div>

								<div className="mb-6">
									<div className="flex items-baseline gap-1">
										<span className="text-4xl font-bold">
											{formatCurrency(plan.price, plan.currency, locale)}
										</span>
										{plan.period && (
											<span className="text-base text-muted-foreground">{t(plan.period)}</span>
										)}
									</div>
									{plan.trialDays && (
										<p className="mt-2 text-sm font-medium text-primary">
											{tPricing('trialDays', { days: plan.trialDays })}
										</p>
									)}
								</div>

								{/* Feature list */}
								<ul className="mb-6 space-y-3">
									{plan.features.map((feature) => (
										<li key={feature} className="flex items-start gap-3">
											<Check className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
											<span className="text-sm leading-tight">
												{tPricing(`feature.${feature}`)}
											</span>
										</li>
									))}
								</ul>

								<Button
									className={cn('w-full', plan.highlight && 'bg-primary hover:bg-primary/90')}
									variant={plan.highlight ? 'default' : 'outline'}
									disabled={isFree || isCurrentPlan || isLoading || checkoutLoading !== null}
									onClick={() => {
										if (!isFree && !isCurrentPlan) {
											handleCheckout(plan.slug, plan.interval)
										}
									}}
								>
									{checkoutLoading === plan.id
										? tPricing('processing')
										: isCurrentPlan
											? t('currentPlan')
											: isFree
												? t('currentPlan')
												: isPremium
													? t('switchPlan')
													: tPricing('startFreeTrial')}
								</Button>
							</CardContent>
						</Card>
					)
				})}
			</div>

			{/* Streak Protection Callout */}
			<Card className="overflow-hidden border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-transparent">
				<CardContent className="flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:text-left">
					<div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-500/20">
						<Flame className="h-7 w-7 text-orange-500" />
					</div>
					<div className="flex-1">
						<h3 className="text-lg font-bold">{tPricing('streakProtectionTitle')}</h3>
						<p className="mt-1 text-sm text-muted-foreground">{tPricing('streakProtectionDesc')}</p>
					</div>
					<Button
						variant="outline"
						className="shrink-0 gap-2 border-orange-500/30 text-orange-600 hover:bg-orange-500/10 dark:text-orange-400"
					>
						<Snowflake className="h-4 w-4" />
						{tPricing('learnAboutFreezes')}
					</Button>
				</CardContent>
			</Card>

			{/* FAQ */}
			<div className="rounded-xl bg-muted/50 p-6 text-center">
				<h3 className="mb-2 font-semibold">{tPricing('questionsTitle')}</h3>
				<p className="text-sm text-muted-foreground">{tPricing('questionsDesc')}</p>
			</div>
		</div>
	)
}
