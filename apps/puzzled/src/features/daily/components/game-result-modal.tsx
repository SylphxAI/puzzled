'use client'

import { Dialog, DialogClose, DialogContent } from '@sylphx/ui'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ComponentProps } from 'react'
import { GameResultCard } from './game-result'

type GameResultModalProps = ComponentProps<typeof GameResultCard> & {
	open: boolean
	onClose: () => void
}

/**
 * GameResultModal - Modal overlay wrapper for GameResultCard
 *
 * Displays the game result as a modal overlay on top of the game,
 * rather than inline in the layout. Keep dismissal visible on touch screens.
 */
export function GameResultModal({ open, onClose, ...cardProps }: GameResultModalProps) {
	const t = useTranslations('common')

	return (
		<Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
			<DialogContent className="sm:max-w-sm" hideCloseButton>
				<div className="sticky top-0 z-10 flex justify-end bg-card px-3 pt-1 sm:pt-3">
					<DialogClose
						aria-label={t('dismiss')}
						className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<X className="h-5 w-5" aria-hidden="true" />
					</DialogClose>
				</div>
				<GameResultCard {...cardProps} />
			</DialogContent>
		</Dialog>
	)
}
