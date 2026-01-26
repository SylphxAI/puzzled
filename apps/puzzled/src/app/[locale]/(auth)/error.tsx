'use client'

/**
 * Error Boundary for Auth Routes
 *
 * Catches errors in login, signup, password reset pages.
 */

import { useEffect } from 'react'
import { Button } from '@sylphx/ui'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { captureError } from '@/lib/monitoring'

interface ErrorProps {
	error: Error & { digest?: string }
	reset: () => void
}

export default function AuthError({ error, reset }: ErrorProps) {
	useEffect(() => {
		captureError(error, {
			tags: { boundary: 'auth' },
			extra: { digest: error.digest },
		})
	}, [error])

	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<div className="text-center max-w-sm">
				<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-4">
					<AlertTriangle className="h-6 w-6 text-destructive" />
				</div>

				<h1 className="text-lg font-bold mb-2">Authentication Error</h1>
				<p className="text-muted-foreground text-sm mb-4">
					Something went wrong. Please try again.
				</p>

				<div className="flex gap-2 justify-center">
					<Button variant="outline" size="sm" onClick={reset}>
						<RefreshCw className="h-4 w-4 mr-1.5" />
						Retry
					</Button>
					<Button size="sm" asChild>
						<a href="/">
							<Home className="h-4 w-4 mr-1.5" />
							Home
						</a>
					</Button>
				</div>
			</div>
		</div>
	)
}
