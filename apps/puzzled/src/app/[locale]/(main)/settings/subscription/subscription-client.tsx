'use client'

import { BillingSection, useBilling } from '@sylphx/sdk/react'
import { Button } from '@sylphx/ui'
import { Crown } from 'lucide-react'
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
	const { isPremium, subscription, openPortal, isLoading } = useBilling()

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
			<div className="rounded-2xl border bg-card p-6">
				<div className="flex items-center justify-between">
					<div>
						<h3 className="font-semibold">{isPremium ? 'Premium' : 'Free Plan'}</h3>
						<p className="text-sm text-muted-foreground">
							{isPremium
								? `Subscribed to ${subscription?.planSlug || 'Premium'}`
								: 'Upgrade to unlock all features'}
						</p>
					</div>
					{isPremium ? (
						<Button variant="outline" onClick={() => openPortal()} disabled={isLoading}>
							Manage Subscription
						</Button>
					) : (
						<Button asChild>
							<Link href={`/${locale}/pricing`}>Upgrade to Premium</Link>
						</Button>
					)}
				</div>
			</div>

			{/* SDK Billing Section Component */}
			{isPremium && (
				<div className="rounded-2xl border bg-card overflow-hidden p-6">
					<BillingSection />
				</div>
			)}
		</div>
	)
}
