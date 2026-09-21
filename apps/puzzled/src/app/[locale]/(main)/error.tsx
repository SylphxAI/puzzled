'use client'

import { useTranslations } from 'next-intl'
import { BoundaryErrorView } from '@/shared/components/boundary-error-view'

type Props = {
	error: Error & { digest?: string }
	reset: () => void
}

export default function ErrorPage({ error, reset }: Props) {
	const t = useTranslations('common')

	return (
		<BoundaryErrorView
			boundary="main-layout"
			error={error}
			reset={reset}
			title={t('error')}
			description={t('errorDescription')}
			retryLabel={t('retry')}
			detail={error.message}
			className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center"
		/>
	)
}
