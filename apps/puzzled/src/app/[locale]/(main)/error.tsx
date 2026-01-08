'use client'

import * as Sentry from '@sentry/nextjs'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { Button } from '@/shared/components/ui'

type Props = {
	error: Error & { digest?: string }
	reset: () => void
}

export default function ErrorPage({ error, reset }: Props) {
	const t = useTranslations('common')

	useEffect(() => {
		// Report error to Sentry
		Sentry.captureException(error)
	}, [error])

	return (
		<div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
			<AlertTriangle className="h-12 w-12 text-wrong" />
			<h1 className="text-xl font-bold">{t('error')}</h1>
			<p className="text-muted-foreground">{t('errorDescription')}</p>
			<Button onClick={reset} variant="outline">
				<RefreshCw className="mr-2 h-4 w-4" />
				{t('retry')}
			</Button>
		</div>
	)
}
