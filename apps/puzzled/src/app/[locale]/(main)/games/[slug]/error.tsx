'use client'

/**
 * Error boundary for game pages.
 *
 * Must not call useErrorTracking — the monitoring context is not guaranteed
 * and would replace the real play error with a provider message.
 */

import { useTranslations } from 'next-intl'
import { BoundaryErrorView } from '@/shared/components/boundary-error-view'

type ErrorProps = {
	error: Error & { digest?: string }
	reset: () => void
}

export default function GameError({ error, reset }: ErrorProps) {
	const t = useTranslations('common')

	return (
		<BoundaryErrorView
			boundary="game-page"
			error={error}
			reset={reset}
			title={t('error')}
			description="Something went wrong while loading the game. Please try again."
			retryLabel={t('retry')}
			detail={error.message}
			className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-8 text-center"
		/>
	)
}
