'use client'

/**
 * Error Boundary for Locale Routes
 *
 * Must not call Sylphx Monitoring hooks — that context is not guaranteed
 * and masks the original throw (live crossword hydrate, 2026-08-12).
 */

import { Button } from '@sylphx/ui'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { reportBoundaryError } from '@/lib/report-boundary-error'

interface ErrorProps {
	error: Error & { digest?: string }
	reset: () => void
}

export default function LocaleError({ error, reset }: ErrorProps) {
	const reported = useRef(false)

	useEffect(() => {
		if (reported.current) return
		reported.current = true
		reportBoundaryError('locale', error)
	}, [error])

	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<div className="text-center max-w-md">
				<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-6">
					<AlertTriangle className="h-8 w-8 text-destructive" />
				</div>

				<h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
				<p className="text-muted-foreground mb-6">
					We encountered an unexpected error. Please try again or return to the home page.
				</p>

				<p className="mb-6 text-sm text-destructive break-words">{error.message}</p>

				<div className="flex gap-3 justify-center">
					<Button variant="outline" onClick={reset}>
						<RefreshCw className="h-4 w-4 mr-2" />
						Try again
					</Button>
					<Button asChild>
						<a href="/">
							<Home className="h-4 w-4 mr-2" />
							Home
						</a>
					</Button>
				</div>
			</div>
		</div>
	)
}
