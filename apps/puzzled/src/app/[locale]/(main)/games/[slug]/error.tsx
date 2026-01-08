'use client'

import * as Sentry from '@sentry/nextjs'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { Button } from '@sylphx/ui'

type ErrorProps = {
	error: Error & { digest?: string }
	reset: () => void
}

export default function GameError({ error, reset }: ErrorProps) {
	const t = useTranslations('common')

	useEffect(() => {
		// Report error to Sentry with game context
		Sentry.captureException(error, {
			tags: { location: 'game-page' },
		})
	}, [error])

	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-8 text-center">
			<div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
				<AlertTriangle className="h-8 w-8 text-destructive" />
			</div>

			<div>
				<h2 className="text-xl font-bold">{t('error')}</h2>
				<p className="mt-2 max-w-sm text-sm text-muted-foreground">
					Something went wrong while loading the game. Please try again.
				</p>
			</div>

			<Button onClick={reset} className="gap-2">
				<RefreshCw className="h-4 w-4" />
				{t('retry')}
			</Button>
		</div>
	)
}
