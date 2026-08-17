'use client'

import { BillingSection, useBilling } from '@sylphx/sdk/react'
import { Button } from '@sylphx/ui'
import { AlertCircle, Crown, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { SettingsPageHeader } from '@/shared/components/layout'

/**
 * Subscription Settings Client Component
 *
 * Uses the SDK's BillingSection component for:
 * - Current subscription status
 * - Billing history
 * - Manage subscription portal
 */
export function SubscriptionSettingsContent() {
	const t = useTranslations('settings')
	const locale = useLocale()
	const { isPremium, openPortal, isLoading, error, refresh } = useBilling()

	return (
		<div className="space-y-6">
			<SettingsPageHeader
				icon={Crown}
				gradientClasses="from-amber-500/20 to-orange-500/20"
				iconColorClass="text-amber-500"
				title={t('subscription.title')}
				description={t('subscription.description')}
			/>

			{/* Current Plan Status */}
			{isLoading ? (
				<div className="rounded-2xl border bg-card p-6" aria-busy="true">
					<p className="text-sm text-muted-foreground">{t('subscription.statusLoading')}</p>
				</div>
			) : error ? (
				<div className="rounded-2xl border bg-card p-6" role="alert">
					<AlertCircle className="h-6 w-6 text-destructive" />
					<h3 className="mt-3 font-semibold">{t('subscription.unavailableTitle')}</h3>
					<p className="mt-1 text-sm text-muted-foreground">
						{t('subscription.unavailableDescription')}
					</p>
					<Button
						variant="outline"
						className="mt-4"
						onClick={() => void refresh()}
						disabled={isLoading}
					>
						<RefreshCw className="mr-2 h-4 w-4" />
						{t('subscription.retry')}
					</Button>
				</div>
			) : (
				<div className="rounded-2xl border bg-card p-6">
					<div className="flex items-center justify-between">
						<div>
							<h3 className="font-semibold">
								{isPremium ? t('subscription.premium') : t('subscription.freePlan')}
							</h3>
							<p className="text-sm text-muted-foreground">
								{isPremium
									? t('subscription.currentPlanDescription')
									: t('subscription.upgradeDescription')}
							</p>
						</div>
						{isPremium ? (
							<Button variant="outline" onClick={() => void openPortal()} disabled={isLoading}>
								{t('subscription.manageSubscription')}
							</Button>
						) : (
							<Button asChild>
								<Link href={`/${locale}/pricing`}>{t('subscription.upgradeToPremium')}</Link>
							</Button>
						)}
					</div>
				</div>
			)}

			{/* SDK Billing Section Component */}
			{!isLoading && !error && isPremium && (
				<div className="rounded-2xl border bg-card overflow-hidden p-6">
					<BillingSection />
				</div>
			)}
		</div>
	)
}
