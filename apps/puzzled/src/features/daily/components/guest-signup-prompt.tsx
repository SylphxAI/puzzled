'use client'

import { Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
	Button,
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@sylphx/ui'

type GuestSignupPromptProps = {
	open: boolean
	onClose: () => void
	streakCount?: number
}

/**
 * Modal shown after guest completes their first puzzle
 * Encourages sign up to save progress and access features
 */
export function GuestSignupPrompt({ open, onClose, streakCount = 1 }: GuestSignupPromptProps) {
	const t = useTranslations('onboarding')
	const router = useRouter()

	const handleSignup = () => {
		router.push('/signup')
	}

	return (
		<Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Sparkles className="h-5 w-5 text-primary" />
						<span>{t('niceWork')}</span>
					</DialogTitle>
				</DialogHeader>
				<DialogBody className="space-y-4">
					{/* Main message */}
					<div className="text-center">
						<p className="text-sm text-muted-foreground">{t('signupPromptDesc')}</p>
					</div>

					{/* Benefits list */}
					<div className="space-y-3 rounded-lg bg-muted/50 p-4">
						<div className="flex items-start gap-3">
							<div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-sm">
								✓
							</div>
							<div className="flex-1">
								<p className="text-sm font-medium">{t('saveStreak')}</p>
								{streakCount > 1 && (
									<p className="text-xs text-muted-foreground">
										{t('keepStreak', { days: streakCount })}
									</p>
								)}
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
