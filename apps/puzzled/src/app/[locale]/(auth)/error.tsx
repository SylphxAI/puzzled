'use client'

/**
 * Error boundary for the account surfaces.
 *
 * It must not assume the monitoring provider mounted, so it reports through the
 * plain reporter and offers the two things a stuck visitor needs: another try,
 * and a way back to playing.
 */

import { Button } from '@sylphx/ui'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import { Link } from '@/lib/i18n/routing'
import { reportBoundaryError } from '@/lib/report-boundary-error'

interface ErrorProps {
	error: Error & { digest?: string }
	reset: () => void
}

export default function AuthError({ error, reset }: ErrorProps) {
	const t = useTranslations('auth')
	const reported = useRef(false)

	useEffect(() => {
		if (reported.current) return
		reported.current = true
		reportBoundaryError('auth', error)
	}, [error])

	return (
		<div className="surface-card p-6 text-center sm:p-8">
			<span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
				<TriangleAlert className="h-7 w-7 text-destructive" aria-hidden="true" />
			</span>
			<h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight">
				{t('errorTitle')}
			</h1>
			<p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t('errorBody')}</p>

			<div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
				<Button variant="outline" onClick={reset} className="min-h-11 gap-2">
					<RefreshCw className="h-4 w-4" aria-hidden="true" />
					{t('errorRetry')}
				</Button>
				<Button asChild className="min-h-11">
					<Link href="/">{t('backToPlay')}</Link>
				</Button>
			</div>
		</div>
	)
}
