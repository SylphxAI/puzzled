import { Calendar, Check, Crown, Sparkles, X } from 'lucide-react'
import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ManageSubscriptionButton } from '@/features/auth/components'
import { requireServerUser } from '@/features/auth/server'
import { BillingHistory, GameSettingsCard, StatusBadge } from '@/features/settings/components'
import {
	getExcludedFreeFeatures,
	getIncludedFeatures,
	getUserSubscription,
	isFreePlan,
	isLifetimePlan,
	isPremiumPlan,
	isTrialing,
} from '@/features/subscription/server'
import { TRIAL_CONFIG } from '@/lib/config/subscription'
import { cn } from '@/lib/utils'
import { Progress } from '@sylphx/ui'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'settings' })

	return {
		title: t('subscription.title'),
	}
}

export default async function SubscriptionSettingsPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	// Auth is handled by layout, but we need user.id for subscription query
	const user = await requireServerUser(locale)
	const t = await getTranslations()

	// Get subscription info - use SSOT helpers for plan checks
	const subscription = await getUserSubscription(user.id)
	const isPremium = isPremiumPlan(subscription.plan)
	const isLifetime = isLifetimePlan(subscription.plan)
	const isFree = isFreePlan(subscription.plan)

	// Calculate trial days remaining if in trial (using SSOT helper)
	const isTrial = isTrialing(subscription.status)
	const trialDaysRemaining =
		isTrial && subscription.currentPeriodEnd
			? Math.max(
					0,
					Math.ceil((subscription.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
				)
			: null

	return (
		<div className="space-y-6">
			{/* Page Header */}
			<div className="flex items-center gap-3">
				<div
					className={cn(
						'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
						isPremium
							? 'bg-gradient-to-br from-amber-500/20 to-orange-500/20'
							: 'bg-gradient-to-br from-primary/20 to-violet-500/20',
					)}
				>
					<Crown className={cn('h-6 w-6', isPremium ? 'text-amber-500' : 'text-primary')} />
				</div>
				<div>
					<h1 className="text-xl font-semibold tracking-tight">
						{t('settings.subscription.title')}
					</h1>
					<p className="text-sm text-muted-foreground">{t('settings.subscription.description')}</p>
				</div>
			</div>

			{/* Current Plan Card */}
			<GameSettingsCard
				title={t('settings.subscription.currentPlan')}
				description={t('settings.subscription.currentPlanDescription')}
				iconElement={
					isPremium ? (
						<Crown className="h-5 w-5 text-amber-500 dark:text-amber-400" />
					) : (
						<Sparkles className="h-5 w-5 text-primary" />
					)
				}
				variant={isPremium ? 'premium' : 'default'}
				badge={
					isPremium && (
						<StatusBadge status={isTrial ? 'warning' : 'active'}>
							{isTrial ? t('settings.subscription.trial') : t('settings.subscription.active')}
						</StatusBadge>
					)
				}
			>
				<div className="space-y-6">
					{/* Plan Badge and Status */}
					<div className="flex items-start justify-between">
						<div className="space-y-2">
							<div className="flex items-center gap-3">
								<div
									className={cn(
										'flex h-12 w-12 items-center justify-center rounded-xl',
										isPremium
											? 'bg-gradient-to-br from-yellow-400/20 to-orange-500/20'
											: 'bg-muted',
									)}
								>
									<Crown
										className={cn(
											'h-6 w-6',
											isPremium ? 'text-yellow-500' : 'text-muted-foreground',
										)}
									/>
								</div>
								<div>
									<h3 className="text-xl font-bold">
										{isLifetime
											? t('settings.subscription.lifetime')
											: isPremium
												? t('settings.subscription.premium')
												: t('settings.subscription.free')}
									</h3>
									{subscription.cancelAtPeriodEnd && (
										<StatusBadge status="warning">
											{t('settings.subscription.cancelling')}
										</StatusBadge>
									)}
								</div>
							</div>

							{/* Billing Details */}
							{isPremium && !isLifetime && subscription.currentPeriodEnd && (
								<div className="mt-3 space-y-1 text-sm text-muted-foreground">
									{isTrial && trialDaysRemaining !== null && (
										<p className="font-medium text-primary">
											{t('settings.subscription.trialDaysRemaining', { days: trialDaysRemaining })}
										</p>
									)}
									{subscription.cancelAtPeriodEnd ? (
										<p>
											{t('settings.subscription.accessUntil', {
												date: subscription.currentPeriodEnd.toLocaleDateString(locale, {
													year: 'numeric',
													month: 'long',
													day: 'numeric',
												}),
											})}
										</p>
									) : (
										<p>
											{t('settings.subscription.renewsOn', {
												date: subscription.currentPeriodEnd.toLocaleDateString(locale, {
													year: 'numeric',
													month: 'long',
													day: 'numeric',
												}),
											})}
										</p>
									)}
								</div>
							)}

							{isLifetime && (
								<p className="mt-2 text-sm text-muted-foreground">
									{t('settings.subscription.lifetimeDescription')}
								</p>
							)}
						</div>
					</div>

					{/* Trial Progress Bar */}
					{isTrial && trialDaysRemaining !== null && (
						<div className="rounded-xl border bg-muted/30 p-4">
							<div className="mb-2 flex items-center justify-between text-sm">
								<span className="font-medium">
									{t('settings.subscription.trialProgress', { days: trialDaysRemaining })}
								</span>
								<span className="text-muted-foreground">
									{t('settings.subscription.daysLeft', { days: trialDaysRemaining })}
								</span>
							</div>
							<Progress
								value={TRIAL_CONFIG.TRIAL_PERIOD_DAYS - trialDaysRemaining}
								max={TRIAL_CONFIG.TRIAL_PERIOD_DAYS}
								variant="default"
								size="md"
							/>
						</div>
					)}

					{/* Feature Comparison */}
					<div className="rounded-xl border bg-muted/30 p-4">
						<h4 className="mb-4 text-sm font-medium">{t('settings.subscription.yourFeatures')}</h4>
						<div className="grid gap-6 sm:grid-cols-2">
							{/* Current Plan Features */}
							<div>
								<p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
									{isPremium
										? t('settings.subscription.included')
										: t('settings.subscription.freePlan')}
								</p>
								<ul className="space-y-2.5">
									{getIncludedFeatures(isPremium ? 'premium' : 'free').map((feature) => (
										<li key={feature.key} className="flex items-start gap-2.5 text-sm">
											<div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
												<Check className="h-3 w-3 text-emerald-500" />
											</div>
											<span>{t(`settings.subscription.features.${feature.key}`)}</span>
										</li>
									))}
								</ul>
							</div>

							{/* Missing Features (for free users) */}
							{isFree && (
								<div>
									<p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
										{t('settings.subscription.upgradeToUnlock')}
									</p>
									<ul className="space-y-2.5">
										{getExcludedFreeFeatures().map((feature) => (
											<li
												key={feature.key}
												className="flex items-start gap-2.5 text-sm text-muted-foreground"
											>
												<div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted">
													<X className="h-3 w-3" />
												</div>
												<span>{t(`settings.subscription.features.${feature.key}`)}</span>
											</li>
										))}
									</ul>
								</div>
							)}
						</div>
					</div>
				</div>
			</GameSettingsCard>

			{/* Upgrade/Manage Section */}
			<div
				className={cn(
					'group relative overflow-hidden rounded-2xl border bg-card transition-all duration-300 hover:shadow-xl',
					isFree &&
						'border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 hover:shadow-primary/15',
				)}
			>
				{/* Top accent line */}
				<div
					className={cn(
						'absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r opacity-80',
						isFree
							? 'from-primary/80 via-violet-500 to-purple-500/80'
							: 'from-amber-500/80 via-yellow-400 to-orange-500/80',
					)}
				/>

				{/* Decorative gradient for upgrade CTA */}
				{isFree && (
					<div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 blur-3xl transition-opacity duration-500 group-hover:opacity-150" />
				)}

				<div className="relative p-6">
					<div className="mb-4 flex items-start gap-3">
						<div
							className={cn(
								'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105',
								isFree ? 'bg-primary/10' : 'bg-amber-500/10',
							)}
						>
							<Crown className={cn('h-5 w-5', isFree ? 'text-primary' : 'text-amber-500')} />
						</div>
						<div className="space-y-1">
							<h3 className="text-lg font-semibold">
								{isFree
									? t('settings.subscription.upgradeTitle')
									: isLifetime
										? t('settings.subscription.lifetimeAccess')
										: t('settings.subscription.manageTitle')}
							</h3>
							<p className="text-sm text-muted-foreground">
								{isFree
									? t('settings.subscription.upgradeDescription')
									: isLifetime
										? t('settings.subscription.lifetimeAccessDescription')
										: t('settings.subscription.manageDescription')}
							</p>
						</div>
					</div>

					{isFree ? (
						<Link
							href={`/${locale}/pricing`}
							className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98]"
						>
							<Crown className="h-4 w-4" />
							{t('settings.subscription.upgradeToPremium')}
						</Link>
					) : subscription.stripeCustomerId && !isLifetime ? (
						<div className="flex flex-col gap-4">
							<ManageSubscriptionButton label={t('settings.subscription.manageSubscription')} />
							<p className="text-xs text-muted-foreground">
								{t('settings.subscription.billingPortalDescription')}
							</p>
						</div>
					) : null}
				</div>
			</div>

			{/* Billing History (Premium Only) */}
			{isPremium && (
				<GameSettingsCard
					title={t('settings.subscription.billingHistory')}
					description={t('settings.subscription.billingHistoryDescription')}
					iconElement={<Calendar className="h-5 w-5 text-primary" />}
					variant="default"
				>
					<BillingHistory />
				</GameSettingsCard>
			)}
		</div>
	)
}
