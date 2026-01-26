'use client'

/**
 * Error Boundary for Locale Routes
 *
 * Catches errors in all pages under [locale] and provides recovery UI.
 * This is a Client Component as required by Next.js error boundaries.
 */

import { Button } from '@sylphx/ui'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'
import { useEffect } from 'react'
import { captureError } from '@/lib/monitoring'

interface ErrorProps {
	error: Error & { digest?: string }
	reset: () => void
}

export default function LocaleError({ error, reset }: ErrorProps) {
	useEffect(() => {
		// Log error to monitoring service
		captureError(error, {
			tags: { boundary: 'locale' },
			extra: { digest: error.digest },
		})
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

				{process.env.NODE_ENV === 'development' && (
					<details className="mb-6 text-left bg-muted/50 rounded-lg p-4">
						<summary className="cursor-pointer text-sm font-medium">Error details</summary>
						<pre className="mt-2 text-xs overflow-auto whitespace-pre-wrap text-destructive">
							{error.message}
							{error.stack && `\n\n${error.stack}`}
						</pre>
					</details>
				)}

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
