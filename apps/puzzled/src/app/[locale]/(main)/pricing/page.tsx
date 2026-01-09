import { Calendar, Check, Crown, Flame, Snowflake, Sparkles } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { currentUser } from '@sylphx/platform-sdk/nextjs'
import { cn } from '@/lib/utils'
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

// Static plan configuration
const PLANS = [
	{
		id: 'free',
		price: 0,
		currency: 'usd',
		period: null,
		highlight: false,
		badge: null,
		badgeColor: null,
		features: ['dailyPuzzle', 'basicStats'],
	},
	{
		id: 'premium',
		price: 499,
		currency: 'usd',
		period: 'perMonth',
		highlight: true,
		badge: 'popular',
		badgeColor: 'bg-primary',
		trialDays: 7,
		features: ['allGames', 'streakFreeze', 'advancedStats', 'noAds', 'archive'],
	},
	{
		id: 'annual',
		price: 3999,
		currency: 'usd',
		period: 'perYear',
		highlight: false,
		badge: 'bestValue',
		badgeColor: 'bg-emerald-500',
		trialDays: 7,
		savings: 'savePercent',
		features: ['allGames', 'streakFreeze', 'advancedStats', 'noAds', 'archive'],
	},
] as const

function formatCurrency(amount: number, currency: string, locale: string): string {
	return new Intl.NumberFormat(locale, {
		style: 'currency',
		currency: currency.toUpperCase(),
		minimumFractionDigits: 0,
		maximumFractionDigits: 2,
	}).format(amount / 100)
}

export default async function PricingPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	const t = await getTranslations('subscription')
	const tPricing = await getTranslations('pricing')

	const user = await currentUser()
	// For now, premium status would come from SDK billing in the future
	const isPremium = false

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
						{PLANS.map((plan) => (
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
										{'trialDays' in plan && plan.trialDays && (
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
										disabled={plan.id === 'free' || isPremium}
									>
										{isPremium
											? t('currentPlan')
											: plan.id === 'free'
												? t('currentPlan')
												: tPricing('startFreeTrial')}
									</Button>
								</CardContent>
							</Card>
						))}
					</div>

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
