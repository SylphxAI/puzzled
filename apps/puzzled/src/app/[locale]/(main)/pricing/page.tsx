import { Calendar, Check, Crown, Flame, Snowflake, Sparkles, X } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getServerUser } from '@/features/auth/server'
import { CheckoutButton, FeatureComparison } from '@/features/subscription'
import { getPlans, getPricingFeatures, hasPremiumAccess } from '@/features/subscription/server'
import { TRIAL_CONFIG } from '@/lib/config/subscription'
import { cn } from '@/lib/utils'
import { formatCurrency, getMonthlyEquivalent } from '@/lib/utils/locale-map'
import { Header } from '@/shared/components/layout'
import { Button, Card, CardContent } from '@sylphx/ui'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'subscription' })

	return {
		title: t('premium'),
	}
}

// Plan display configuration (prices come from database)
const PLAN_CONFIG = {
	free: {
		highlight: false,
		badge: null,
		ctaKey: 'startFreeTrial',
		badgeColor: null,
	},
	premium: {
		highlight: true,
		badge: 'popular',
		ctaKey: 'startFreeTrial',
		badgeColor: 'bg-primary',
		trialDays: TRIAL_CONFIG.TRIAL_PERIOD_DAYS,
	},
	annual: {
		highlight: false,
		badge: 'bestValue',
		ctaKey: 'startFreeTrial',
		savings: 'savePercent',
		badgeColor: 'bg-emerald-500',
		trialDays: TRIAL_CONFIG.TRIAL_PERIOD_DAYS,
	},
} as const

export default async function PricingPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	const t = await getTranslations('subscription')
	const tPricing = await getTranslations('pricing')

	const user = await getServerUser()
	const isPremium = user ? await hasPremiumAccess(user.id) : false

	// Fetch prices from database (Stripe as source of truth)
	const dbPlans = await getPlans()

	// Build plan data with prices from database
	const plans = (['free', 'premium', 'annual'] as const).map((planId) => {
		const config = PLAN_CONFIG[planId]
		const dbPlan = dbPlans.find((p) => p.slug === (planId === 'annual' ? 'premium' : planId))
		const price =
			planId === 'free'
				? { amount: 0, currency: 'usd', interval: null }
				: dbPlan?.prices.find((p) => p.interval === (planId === 'annual' ? 'annual' : 'monthly'))

		return {
			id: planId,
			price: price?.amount ?? 0,
			currency: price?.currency ?? 'usd',
			period: planId === 'free' ? null : planId === 'annual' ? 'perYear' : 'perMonth',
			...config,
		}
	})

	// Get annual price for monthly equivalent calculation
	const annualPlan = plans.find((p) => p.id === 'annual')
	const monthlyEquivalent = annualPlan
		? getMonthlyEquivalent(annualPlan.price, annualPlan.currency, locale)
		: null

	return (
		<>
			<Header />
			<main className="flex flex-1 flex-col px-4 py-8 pb-nav">
				<div className="mx-auto w-full max-w-4xl space-y-10">
					{/* Hero */}
					<div className="text-center">
						<div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10">
							<Crown className="h-8 w-8 text-primary" />
						</div>
						<h1 className="text-3xl font-bold sm:text-4xl">{tPricing('title')}</h1>
						<p className="mt-3 text-lg text-muted-foreground">{tPricing('subtitle')}</p>
						<p className="mt-2 text-sm text-muted-foreground">⭐ {tPricing('socialProof')}</p>
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
						{plans.map((plan) => {
							const planFeatures = getPricingFeatures(plan.id as 'free' | 'premium' | 'annual')
							return (
								<Card
									key={plan.id}
									className={cn(
										'relative overflow-hidden transition-all hover:shadow-xl',
										plan.highlight &&
											'border-primary ring-2 ring-primary shadow-lg sm:scale-[1.05]',
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
											{'savings' in plan && plan.savings && (
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
													<span className="text-base text-muted-foreground">
														{t(plan.period as 'perMonth' | 'perYear')}
													</span>
												)}
											</div>
											{plan.id === 'annual' && monthlyEquivalent && (
												<p className="mt-1 text-sm text-muted-foreground">
													{tPricing('monthlyEquivalent', { amount: monthlyEquivalent })}
												</p>
											)}
											{'trialDays' in plan && plan.trialDays && (
												<p className="mt-2 text-sm font-medium text-primary">
													{tPricing('trialDays', { days: plan.trialDays })}
												</p>
											)}
										</div>

										{/* Feature list */}
										<ul className="mb-6 space-y-3">
											{planFeatures.map((feature) => {
												const Icon = feature.icon
												return (
													<li key={feature.key} className="flex items-start gap-3">
														{feature.included ? (
															<Check className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
														) : (
															<X className="h-5 w-5 text-muted-foreground/50 shrink-0 mt-0.5" />
														)}
														<div className="flex items-center gap-2 flex-1">
															<Icon
																aria-hidden="true"
																className={cn(
																	'h-4 w-4 shrink-0',
																	feature.included ? 'text-foreground' : 'text-muted-foreground/50',
																)}
															/>
															<span
																className={cn(
																	'text-sm leading-tight',
																	!feature.included && 'text-muted-foreground/50 line-through',
																)}
															>
																{tPricing(`feature.${feature.key}`)}
															</span>
														</div>
													</li>
												)
											})}
										</ul>

										<CheckoutButton
											planId={plan.id as 'free' | 'premium' | 'annual'}
											userId={user?.id ?? null}
											userEmail={user?.email ?? null}
											isPremium={isPremium}
											highlight={plan.highlight}
											ctaKey={plan.ctaKey}
										/>
									</CardContent>
								</Card>
							)
						})}
					</div>

					{/* Feature Comparison Table */}
					<FeatureComparison
						premiumPriceFormatted={formatCurrency(
							plans.find((p) => p.id === 'premium')?.price ?? 499,
							plans.find((p) => p.id === 'premium')?.currency ?? 'usd',
							locale,
						)}
					/>

					{/* Streak Protection Callout */}
					<Card className="overflow-hidden border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-transparent">
						<CardContent className="flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:text-left">
							<div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-500/20">
								<Flame className="h-7 w-7 text-orange-500" />
							</div>
							<div className="flex-1">
								<h3 className="text-lg font-bold">{tPricing('streakProtectionTitle')}</h3>
								<p className="mt-1 text-sm text-muted-foreground">
									{tPricing('streakProtectionDesc')}
								</p>
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
			</main>
		</>
	)
}
