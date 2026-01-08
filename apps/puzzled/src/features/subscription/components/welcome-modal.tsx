'use client'

import { Flame, Sparkles, Target, Trophy, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Button, Dialog, DialogContent } from '@/shared/components/ui'

type WelcomeModalProps = {
	open?: boolean
	onClose: () => void
	onPlay: () => void
	className?: string
}

const FEATURES = [
	{
		icon: Target,
		titleKey: 'dailyPuzzle',
		descKey: 'dailyPuzzleDesc',
		color: 'text-emerald-500',
		bg: 'bg-emerald-500/10',
	},
	{
		icon: Flame,
		titleKey: 'buildStreak',
		descKey: 'buildStreakDesc',
		color: 'text-orange-500',
		bg: 'bg-orange-500/10',
	},
	{
		icon: Trophy,
		titleKey: 'compete',
		descKey: 'competeDesc',
		color: 'text-yellow-500',
		bg: 'bg-yellow-500/10',
	},
]

/**
 * WelcomeModal - Shown on first visit
 *
 * Features:
 * - Brief introduction to the platform
 * - Key value propositions
 * - Clear CTA to start playing
 * - No account required messaging
 */
export function WelcomeModal({ open = true, onClose, onPlay, className }: WelcomeModalProps) {
	const t = useTranslations('onboarding')

	return (
		<Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
			<DialogContent
				className={cn('max-w-md p-0 gap-0 overflow-hidden', className)}
				hideCloseButton
			>
				{/* Close button */}
				<button
					type="button"
					onClick={onClose}
					className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					aria-label="Close welcome dialog"
				>
					<X className="h-4 w-4" />
				</button>

				{/* Header */}
				<div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 pb-4 pt-8 text-center">
					<div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
						<Sparkles className="h-8 w-8 text-primary" />
					</div>
					<h2 className="text-xl font-bold">{t('welcomeTitle')}</h2>
					<p className="mt-2 text-sm text-muted-foreground">{t('welcomeSubtitle')}</p>
				</div>

				{/* Features */}
				<div className="space-y-3 px-6 py-5">
					{FEATURES.map((feature) => {
						const Icon = feature.icon
						return (
							<div key={feature.titleKey} className="flex items-start gap-3">
								<div
									className={cn(
										'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
										feature.bg,
									)}
								>
									<Icon className={cn('h-5 w-5', feature.color)} />
								</div>
								<div>
									<h3 className="text-sm font-semibold">{t(feature.titleKey)}</h3>
									<p className="text-xs text-muted-foreground">{t(feature.descKey)}</p>
								</div>
							</div>
						)
					})}
				</div>

				{/* Actions */}
				<div className="border-t bg-muted/30 px-6 py-4">
					<Button onClick={onPlay} size="lg" className="w-full gap-2 text-base">
						<Target className="h-5 w-5" />
						{t('playNow')}
					</Button>
					<p className="mt-3 text-center text-xs text-muted-foreground">{t('noAccountNeeded')}</p>
				</div>
			</DialogContent>
		</Dialog>
	)
}
