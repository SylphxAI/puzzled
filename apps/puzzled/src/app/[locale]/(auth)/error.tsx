'use client'

/**
 * Error boundary for the account surfaces.
 *
 * It must not assume the monitoring provider mounted, so it reports through the
 * shared view's plain reporter and offers the two things a stuck visitor needs:
 * another try, and a way back to playing.
 */

import { Button } from '@sylphx/ui'
import { useTranslations } from 'next-intl'
import { Link } from '@/lib/i18n/routing'
import { BoundaryErrorView } from '@/shared/components/boundary-error-view'

interface ErrorProps {
	error: Error & { digest?: string }
	reset: () => void
}

export default function AuthError({ error, reset }: ErrorProps) {
	const t = useTranslations('auth')

	return (
		<BoundaryErrorView
			boundary="auth"
			error={error}
			reset={reset}
			title={t('errorTitle')}
			description={t('errorBody')}
			retryLabel={t('errorRetry')}
			className="surface-card p-6 text-center sm:p-8"
			actions={
				<Button asChild className="min-h-11">
					<Link href="/">{t('backToPlay')}</Link>
				</Button>
			}
		/>
	)
}
