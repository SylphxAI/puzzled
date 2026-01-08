'use client'

import { Crown, Flame, X, Zap } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { PREMIUM_PROMPT_FEATURES } from '@/features/subscription/lib/plan-features'
import { Link } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'
import { Button, Card, Dialog, DialogContent } from '@sylphx/ui'

type PremiumPromptProps = {
	open?: boolean
	currentStreak?: number
	onDismiss: () => void
	variant?: 'modal' | 'card' | 'streak-milestone'
	className?: string
}

/**
 * PremiumPrompt - Encourages users to upgrade to premium
 *
 * Triggered:
 * - After 3+ day streak (milestone celebration)
 * - When trying to access locked features
 * - Periodic gentle nudges
 */
export function PremiumPrompt({
	open = true,
	currentStreak = 0,
	onDismiss,
	variant = 'modal',
	className,
}: PremiumPromptProps) {
	const t = useTranslations('onboarding')

	// Card variant - inline upsell (not a modal)
	if (variant === 'card') {
		return (
			<Card
				className={cn(
					'overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 to-transparent',
					className,
				)}
			>
				<div className="flex items-start justify-between p-4">
					<div className="flex items-start gap-3">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
							<Zap className="h-5 w-5 text-primary" />
						</div>
						<div>
							<h3 className="font-semibold">{t('upgradeToPremium')}</h3>
							<p className="mt-0.5 text-sm text-muted-foreground">{t('premiumCardDesc')}</p>
							<Link href="/pricing">
								<Button size="sm" className="mt-3 gap-1">
									<Crown className="h-3.5 w-3.5" />
									{t('learnMore')}
								</Button>
							</Link>
						</div>
					</div>
					<button
						type="button"
						onClick={onDismiss}
						className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
						aria-label="Close premium prompt"
					>
						<X className="h-4 w-4" />
					</button>
				</div>
			</Card>
		)
	}

	// Streak milestone variant - celebratory modal
	if (variant === 'streak-milestone' && currentStreak >= 3) {
		return (
			<Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDismiss()}>
				<DialogContent
					className={cn('max-w-sm p-0 gap-0 overflow-hidden', className)}
					hideCloseButton
				>
					<button
						type="button"
						onClick={onDismiss}
						className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
						aria-label="Close premium prompt"
					>
						<X className="h-4 w-4" />
					</button>

					{/* Celebration header */}
					<div className="bg-gradient-to-br from-orange-500/20 via-orange-500/10 to-transparent px-6 pb-4 pt-8 text-center">
						<div className="mb-3 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/30 to-orange-600/20 animate-streak-pulse">
							<Flame className="h-10 w-10 text-orange-500" />
						</div>
						<h2 className="text-2xl font-bold">
							{currentStreak} {t('dayStreak')}!
						</h2>
						<p className="mt-1 text-sm text-muted-foreground">{t('streakMilestoneDesc')}</p>
					</div>

					{/* Upgrade pitch */}
					<div className="px-6 py-5">
						<p className="mb-4 text-center text-sm font-medium">{t('protectStreak')}</p>

						<div className="space-y-2">
							{PREMIUM_PROMPT_FEATURES.map((feature) => {
								const Icon = feature.icon
								return (
									<div key={feature.key} className="flex items-center gap-2.5">
										<div
											className={cn(
												'flex h-7 w-7 items-center justify-center rounded-lg',
												feature.bgColor,
											)}
										>
											<Icon className={cn('h-4 w-4', feature.color)} />
										</div>
										<span className="text-sm">{t(feature.key)}</span>
									</div>
								)
							})}
						</div>
					</div>

					{/* CTA */}
					<div className="border-t bg-muted/30 px-6 py-4">
						<Link href="/pricing" className="block">
							<Button
								size="lg"
								className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80"
							>
								<Crown className="h-5 w-5" />
								{t('tryPremiumFree')}
							</Button>
						</Link>
						<button
							type="button"
							onClick={onDismiss}
							className="mt-3 w-full text-center text-sm text-muted-foreground hover:text-foreground"
						>
							{t('continueFree')}
						</button>
					</div>
				</DialogContent>
			</Dialog>
		)
	}

	// Default modal variant
	return (
		<Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDismiss()}>
			<DialogContent
				className={cn('max-w-sm p-0 gap-0 overflow-hidden', className)}
				hideCloseButton
			>
				<button
					type="button"
					onClick={onDismiss}
					className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					aria-label="Close premium prompt"
				>
					<X className="h-4 w-4" />
				</button>

				{/* Header */}
				<div className="p-6 text-center">
					<div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10">
						<Crown className="h-8 w-8 text-primary" />
					</div>
					<h2 className="text-lg font-bold">{t('goPremium')}</h2>
					<p className="mt-2 text-sm text-muted-foreground">{t('premiumModalDesc')}</p>
				</div>

				{/* Features */}
				<div className="space-y-2.5 px-6 pb-5">
					{PREMIUM_PROMPT_FEATURES.map((feature) => {
						const Icon = feature.icon
						return (
							<div key={feature.key} className="flex items-center gap-2.5">
								<div
									className={cn(
										'flex h-7 w-7 items-center justify-center rounded-lg',
										feature.bgColor,
									)}
								>
									<Icon className={cn('h-4 w-4', feature.color)} />
								</div>
								<span className="text-sm">{t(feature.key)}</span>
							</div>
						)
					})}
				</div>

				{/* CTA */}
				<div className="border-t bg-muted/30 px-6 py-4">
					<Link href="/pricing" className="block">
						<Button size="lg" className="w-full">
							{t('viewPlans')}
						</Button>
					</Link>
					<button
						type="button"
						onClick={onDismiss}
						className="mt-3 w-full text-center text-sm text-muted-foreground hover:text-foreground"
					>
						{t('maybeLater')}
					</button>
				</div>
			</DialogContent>
		</Dialog>
	)
}
