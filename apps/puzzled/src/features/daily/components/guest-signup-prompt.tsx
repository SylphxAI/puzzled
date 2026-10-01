'use client'

import {
	Button,
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@sylphx/ui'
import { Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/lib/i18n/routing'
import { signupHref } from './save-streak-prompt'

type GuestSignupPromptProps = {
	open: boolean
	onClose: () => void
	streakCount?: number
	/** Game the player came from; sign-up sends them back here. */
	gameSlug?: string
}

/**
 * Modal shown after a guest finishes a daily with a streak of at least two days.
 * The inline `StreakSaveCard` carries the first ask; this is the stronger one
 * once there is a run worth keeping.
 */
export function GuestSignupPrompt({
	open,
	onClose,
	streakCount = 1,
	gameSlug,
}: GuestSignupPromptProps) {
	const t = useTranslations('onboarding')
	const router = useRouter()

	const handleSignup = () => {
		router.push(signupHref(gameSlug))
	}

	return (
		<Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Sparkles className="h-5 w-5 text-primary" />
						<span>{t('saveStreak')}</span>
					</DialogTitle>
				</DialogHeader>
				<DialogBody className="space-y-4">
					{/* Main message */}
					<div className="text-center">
						<p className="text-sm text-muted-foreground">
							{t('keepStreak', { days: streakCount })}
						</p>
					</div>

					{/* Benefits list */}
					<div className="space-y-3 rounded-lg bg-muted/50 p-4">
						<div className="flex items-start gap-3">
							<div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-sm">
								✓
							</div>
							<div className="flex-1">
								<p className="text-sm font-medium">{t('saveStreak')}</p>
							</div>
						</div>

						<div className="flex items-start gap-3">
							<div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-sm">
								✓
							</div>
							<div className="flex-1">
								<p className="text-sm font-medium">{t('leaderboards')}</p>
							</div>
						</div>

						<div className="flex items-start gap-3">
							<div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-sm">
								✓
							</div>
							<div className="flex-1">
								<p className="text-sm font-medium">{t('trackStats')}</p>
							</div>
						</div>
					</div>
				</DialogBody>
				<DialogFooter className="flex-col gap-2 sm:flex-col">
					<Button onClick={handleSignup} className="w-full gap-2">
						<Sparkles className="h-4 w-4" />
						{t('createFreeAccount')}
					</Button>
					<button
						type="button"
						onClick={onClose}
						className="text-sm text-muted-foreground hover:text-foreground"
					>
						{t('maybeLater')}
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
