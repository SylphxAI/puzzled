'use client'

import { Dialog, DialogContent } from '@sylphx/ui'
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
 * rather than inline in the layout. Users can close by clicking
 * outside or pressing Escape.
 */
export function GameResultModal({ open, onClose, ...cardProps }: GameResultModalProps) {
	return (
		<Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
			<DialogContent className="max-w-sm" hideCloseButton>
				<GameResultCard {...cardProps} />
			</DialogContent>
		</Dialog>
	)
}
