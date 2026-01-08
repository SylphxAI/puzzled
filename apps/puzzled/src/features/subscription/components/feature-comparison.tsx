'use client'

import { Check, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { PLAN_FEATURES } from '@/features/subscription/lib/plan-features'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@sylphx/ui'

type FeatureComparisonProps = {
	className?: string
	/** Formatted premium price string (e.g., "$4.99") - passed from server component */
	premiumPriceFormatted?: string
}

/**
 * FeatureComparison - Side-by-side comparison of Free vs Premium features
 *
 * Shows a clear table with checkmarks and X marks for each feature
 * Price is passed as a prop from server component (Stripe as source of truth)
 */
export function FeatureComparison({ className, premiumPriceFormatted }: FeatureComparisonProps) {
	const t = useTranslations('pricing.feature')
	const tPricing = useTranslations('pricing')
	const tSubscription = useTranslations('subscription')

	return (
		<Card className={cn('overflow-hidden', className)}>
			<CardHeader className="border-b bg-muted/30 text-center">
				<CardTitle className="text-xl sm:text-2xl">{tPricing('comparisonTitle')}</CardTitle>
			</CardHeader>
			<CardContent className="p-0">
				{/* Table Header */}
				<div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b bg-muted/20 px-4 py-4 font-semibold sm:gap-4 sm:px-6">
					<div className="text-xs text-muted-foreground sm:text-sm">{tPricing('features')}</div>
					<div className="w-16 text-center text-xs sm:w-24 sm:text-sm">{tSubscription('free')}</div>
					<div className="relative w-16 sm:w-24">
						<div className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-primary to-primary/80 px-2 py-0.5 text-[10px] font-bold text-white shadow-lg sm:px-3 sm:text-xs">
							{tPricing('popular')}
						</div>
						<div className="pt-4 text-center text-xs font-bold text-primary sm:text-sm">
							{tSubscription('premium')}
						</div>
					</div>
				</div>

				{/* Feature Rows */}
				<div className="divide-y">
					{PLAN_FEATURES.map((feature, index) => {
						const Icon = feature.icon
						return (
							<div
								key={feature.key}
								className={cn(
									'grid grid-cols-[1fr_auto_auto] items-center gap-2 px-4 py-3 transition-colors hover:bg-muted/30 sm:gap-4 sm:px-6 sm:py-4',
									index % 2 === 0 ? 'bg-background' : 'bg-muted/5',
								)}
							>
								{/* Feature name */}
								<div className="flex items-center gap-2 sm:gap-3">
									<Icon className="h-4 w-4 shrink-0 text-muted-foreground sm:h-5 sm:w-5" />
									<span className="text-xs font-medium sm:text-sm">{t(feature.key)}</span>
								</div>

								{/* Free plan */}
								<div className="flex w-16 justify-center sm:w-24">
									{feature.free ? (
										<div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 sm:h-6 sm:w-6">
											<Check className="h-3 w-3 text-emerald-500 sm:h-4 sm:w-4" />
										</div>
									) : (
										<div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted sm:h-6 sm:w-6">
											<X className="h-3 w-3 text-muted-foreground/50 sm:h-4 sm:w-4" />
										</div>
									)}
								</div>

								{/* Premium plan */}
								<div className="flex w-16 justify-center sm:w-24">
									{feature.premium ? (
										<div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 sm:h-6 sm:w-6">
											<Check className="h-3 w-3 text-primary sm:h-4 sm:w-4" />
										</div>
									) : (
										<div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted sm:h-6 sm:w-6">
											<X className="h-3 w-3 text-muted-foreground/50 sm:h-4 sm:w-4" />
										</div>
									)}
								</div>
							</div>
						)
					})}
				</div>

				{/* Footer CTA */}
				<div className="grid grid-cols-[1fr_auto_auto] gap-2 border-t bg-gradient-to-br from-primary/5 to-transparent px-4 py-4 sm:gap-4 sm:px-6 sm:py-6">
					<div className="flex items-center">
						<p className="text-xs font-medium text-muted-foreground sm:text-sm">
							{tPricing('comparisonFooter')}
						</p>
					</div>
					<div className="w-16 text-center sm:w-24">
						<div className="text-base font-bold text-foreground sm:text-lg">$0</div>
						<div className="text-[10px] text-muted-foreground sm:text-xs">
							{tSubscription('free')}
						</div>
					</div>
					<div className="w-16 text-center sm:w-24">
						<div className="text-base font-bold text-primary sm:text-lg">
							{premiumPriceFormatted ?? '$4.99'}
						</div>
						<div className="text-[10px] text-muted-foreground sm:text-xs">
							{tSubscription('perMonth')}
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}
