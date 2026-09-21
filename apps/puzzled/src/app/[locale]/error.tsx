'use client'

/**
 * Error boundary for locale routes.
 *
 * Must not call Sylphx Monitoring hooks — that context is not guaranteed and
 * masks the original throw (live crossword hydrate, 2026-08-12).
 */

import { Button } from '@sylphx/ui'
import { Home } from 'lucide-react'
import { BoundaryErrorView } from '@/shared/components/boundary-error-view'

interface ErrorProps {
	error: Error & { digest?: string }
	reset: () => void
}

export default function LocaleError({ error, reset }: ErrorProps) {
	return (
		<BoundaryErrorView
			boundary="locale"
			error={error}
			reset={reset}
			title="Something went wrong"
			description="We encountered an unexpected error. Please try again or return to the home page."
			retryLabel="Try again"
			detail={error.message}
			className="flex min-h-screen items-center justify-center p-4 text-center"
			actions={
				<Button asChild>
					<a href="/">
						<Home className="h-4 w-4" aria-hidden="true" />
						Home
					</a>
				</Button>
			}
		/>
	)
}
