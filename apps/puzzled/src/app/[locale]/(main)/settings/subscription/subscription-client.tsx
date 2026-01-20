'use client'

import { Crown } from 'lucide-react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { useBilling, BillingSection } from '@sylphx/sdk/react'
import { Button } from '@sylphx/ui'

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
			{/* Page Header */}
			<div className="flex items-center gap-3">
				<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20">
					<Crown className="h-6 w-6 text-amber-500" />
				</div>
				<div>
					<h1 className="text-xl font-semibold tracking-tight">{t('subscription.title')}</h1>
					<p className="text-sm text-muted-foreground">{t('subscription.description')}</p>
				</div>
			</div>

			{/* Current Plan Status */}
			<div className="rounded-2xl border bg-card p-6">
				<div className="flex items-center justify-between">
					<div>
						<h3 className="font-semibold">
							{isPremium ? 'Premium' : 'Free Plan'}
						</h3>
						<p className="text-sm text-muted-foreground">
							{isPremium
								? `Subscribed to ${subscription?.planSlug || 'Premium'}`
								: 'Upgrade to unlock all features'}
						</p>
					</div>
					{isPremium ? (
						<Button
							variant="outline"
							onClick={() => openPortal()}
							disabled={isLoading}
						>
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
