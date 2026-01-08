'use client'

import { Check, Flame, Trophy, UserPlus, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Link } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'
import { Button, Card, Dialog, DialogContent } from '@sylphx/ui'

type SignupPromptProps = {
	open?: boolean
	guestStreak?: number
	onDismiss: () => void
	variant?: 'modal' | 'card' | 'banner'
	className?: string
}

const BENEFITS = [
	{ icon: Flame, textKey: 'saveStreak' },
	{ icon: Trophy, textKey: 'leaderboards' },
	{ icon: Check, textKey: 'trackStats' },
]

/**
 * SignupPrompt - Encourages guest users to create an account
 *
 * Shown after completing first game as guest
 * Emphasizes what they'll keep/unlock by signing up
 */
export function SignupPrompt({
	open = true,
	guestStreak = 1,
	onDismiss,
	variant = 'modal',
	className,
}: SignupPromptProps) {
	const t = useTranslations('onboarding')
	const tAuth = useTranslations('auth')

	if (variant === 'banner') {
		return (
			<div
				className={cn(
					'flex items-center justify-between gap-4 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3',
					className,
				)}
			>
				<div className="flex items-center gap-3">
					<UserPlus className="h-5 w-5 text-primary" />
					<p className="text-sm">
						<span className="font-medium">{t('signupBannerTitle')}</span>
						<span className="text-muted-foreground"> {t('signupBannerDesc')}</span>
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Link href="/auth/signup">
						<Button size="sm">{tAuth('signUp')}</Button>
					</Link>
					<button
						type="button"
						onClick={onDismiss}
						className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
						aria-label="Close signup prompt"
					>
						<X className="h-4 w-4" />
					</button>
				</div>
			</div>
		)
	}

	if (variant === 'card') {
		return (
			<Card className={cn('overflow-hidden', className)}>
				<div className="flex items-start justify-between p-4">
					<div className="flex items-start gap-3">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
							<UserPlus className="h-5 w-5 text-primary" />
						</div>
						<div>
							<h3 className="font-semibold">{t('signupCardTitle')}</h3>
							<p className="mt-0.5 text-sm text-muted-foreground">{t('signupCardDesc')}</p>
							<Link href="/auth/signup">
								<Button size="sm" className="mt-3">
									{tAuth('signUp')}
								</Button>
							</Link>
						</div>
					</div>
					<button
						type="button"
						onClick={onDismiss}
						className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
						aria-label="Close signup prompt"
					>
						<X className="h-4 w-4" />
					</button>
				</div>
			</Card>
		)
	}

	// Modal variant - uses Radix Dialog
	return (
		<Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDismiss()}>
			<DialogContent
				className={cn('max-w-sm p-0 gap-0 overflow-hidden', className)}
				hideCloseButton
			>
				{/* Close button */}
				<button
					type="button"
					onClick={onDismiss}
					className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					aria-label="Close signup prompt"
				>
					<X className="h-4 w-4" />
				</button>

				{/* Content */}
				<div className="p-6 text-center">
					{/* Icon */}
					<div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10">
						<Check className="h-8 w-8 text-emerald-500" />
					</div>

					<h2 className="text-lg font-bold">{t('niceWork')}</h2>
					<p className="mt-2 text-sm text-muted-foreground">{t('signupPromptDesc')}</p>

					{/* Benefits */}
					<div className="mt-5 space-y-2.5 text-left">
						{BENEFITS.map((benefit) => {
							const Icon = benefit.icon
							return (
								<div key={benefit.textKey} className="flex items-center gap-2.5">
									<div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10">
										<Icon className="h-3.5 w-3.5 text-emerald-500" />
									</div>
									<span className="text-sm">{t(benefit.textKey)}</span>
								</div>
							)
						})}
					</div>

					{/* Streak callout if applicable */}
					{guestStreak > 0 && (
						<div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-orange-500/10 px-3 py-2">
							<Flame className="h-4 w-4 text-orange-500" />
							<span className="text-sm font-medium text-orange-600 dark:text-orange-400">
								{t('keepStreak', { days: guestStreak })}
							</span>
						</div>
					)}
				</div>

				{/* Actions */}
				<div className="border-t bg-muted/30 px-6 py-4">
					<Link href="/auth/signup" className="block">
						<Button size="lg" className="w-full">
							{t('createFreeAccount')}
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
