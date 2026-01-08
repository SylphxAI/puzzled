'use client'

import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { trackExperimentConversion, useExperiment } from '@/features/analytics/lib/ab-testing'
import { cn } from '@/lib/utils'
import { Button } from '@sylphx/ui'
import { createCheckout } from '../actions'

type Props = {
	planId: 'free' | 'premium' | 'annual'
	userId: string | null
	userEmail: string | null
	isPremium: boolean
	highlight?: boolean
	ctaKey: string
}

export function CheckoutButton({ planId, userId, userEmail, isPremium, highlight, ctaKey }: Props) {
	const t = useTranslations('subscription')
	const tPricing = useTranslations('pricing')
	const [isPending, startTransition] = useTransition()

	// A/B test for CTA variant (only for premium/annual plans)
	const ctaVariant = useExperiment('pricing_cta_variant')

	const handleCheckout = () => {
		if (!userId || !userEmail) {
			// Redirect to login if not authenticated
			window.location.href = '/login?redirect=/pricing'
			return
		}

		if (planId === 'free' || isPremium) return

		// Track conversion when user clicks checkout
		trackExperimentConversion('pricing_cta_variant', ctaVariant, {
			plan: planId,
			userId,
		})

		startTransition(async () => {
			try {
				const plan = planId === 'annual' ? 'annual' : 'monthly'
				// SECURITY: createCheckout gets user from session server-side
				await createCheckout(plan)
			} catch {
				// Checkout failed - redirect happens in the action or silent fail
			}
		})
	}

	const isDisabled = planId === 'free' || isPremium || isPending

	// Get button text based on experiment variant
	const getButtonText = () => {
		if (isPending) return null
		if (isPremium && planId !== 'free') return t('currentPlan')
		if (planId === 'free') return t('currentPlan')

		// Use experiment variant for CTA text (only for premium/annual)
		if (planId === 'premium' || planId === 'annual') {
			// Map variant to translation key
			const variantKeyMap: Record<string, string> = {
				start_trial: 'startFreeTrial',
				get_premium: 'getPremium',
				upgrade_now: 'upgradeNow',
				control: ctaKey, // Use default CTA for control
			}

			const translationKey = variantKeyMap[ctaVariant] || ctaKey
			return tPricing(
				translationKey as 'startFreeTrial' | 'getPremium' | 'getAnnual' | 'upgradeNow',
			)
		}

		return tPricing(ctaKey as 'startFreeTrial' | 'getPremium' | 'getAnnual')
	}

	const buttonText = getButtonText()

	return (
		<Button
			variant={highlight ? 'default' : 'outline'}
			className={cn(
				'w-full',
				highlight && 'bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/20',
			)}
			disabled={isDisabled}
			onClick={handleCheckout}
		>
			{isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : buttonText}
		</Button>
	)
}
