'use client'

import { Button } from '@sylphx/ui'
import { useTranslations } from 'next-intl'

/** The finished board offers the result again once its modal has been closed. */
export function shouldOfferResult(finished: boolean, modalOpen: boolean): boolean {
	return finished && !modalOpen
}

/**
 * Reopens the result modal of a finished game. Shared by every game that
 * shows its result in `GameResultModal`; renders nothing while the board is
 * unfinished or the modal is already open.
 */
export function SeeResultButton({
	finished,
	modalOpen,
	onOpen,
}: {
	finished: boolean
	modalOpen: boolean
	onOpen: () => void
}) {
	const t = useTranslations('gameResult')
	if (!shouldOfferResult(finished, modalOpen)) return null
	return (
		<Button type="button" onClick={onOpen} className="min-h-11 w-full">
			{t('seeResult')}
		</Button>
	)
}
