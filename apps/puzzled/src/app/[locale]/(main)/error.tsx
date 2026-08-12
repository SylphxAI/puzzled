'use client'

import { Button } from '@sylphx/ui'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import { reportBoundaryError } from '@/lib/report-boundary-error'

type Props = {
	error: Error & { digest?: string }
	reset: () => void
}

export default function ErrorPage({ error, reset }: Props) {
	const t = useTranslations('common')
	const reported = useRef(false)

	useEffect(() => {
		if (reported.current) return
		reported.current = true
		reportBoundaryError('main-layout', error)
	}, [error])

	return (
		<div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
			<AlertTriangle className="h-12 w-12 text-wrong" />
			<h1 className="text-xl font-bold">{t('error')}</h1>
			<p className="text-muted-foreground">{t('errorDescription')}</p>
			<p className="max-w-md text-sm text-destructive break-words">{error.message}</p>
			<Button onClick={reset} variant="outline">
				<RefreshCw className="mr-2 h-4 w-4" />
				{t('retry')}
			</Button>
		</div>
	)
}
