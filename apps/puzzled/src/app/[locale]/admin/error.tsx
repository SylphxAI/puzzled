'use client'

/**
 * Error boundary for admin routes.
 *
 * Catches throws in the operator console. Must not call useErrorTracking (the
 * monitoring context is not guaranteed).
 */

import { Button } from '@sylphx/ui'
import { LayoutDashboard } from 'lucide-react'
import { BoundaryErrorView } from '@/shared/components/boundary-error-view'

interface ErrorProps {
	error: Error & { digest?: string }
	reset: () => void
}

export default function AdminError({ error, reset }: ErrorProps) {
	return (
		<BoundaryErrorView
			boundary="admin"
			error={error}
			reset={reset}
			title="Admin Error"
			description="Something went wrong in the admin panel. Try refreshing or return to the dashboard."
			retryLabel="Retry"
			className="flex min-h-[60vh] items-center justify-center p-4 text-center"
			actions={
				<Button asChild>
					<a href="/admin">
						<LayoutDashboard className="h-4 w-4" aria-hidden="true" />
						Dashboard
					</a>
				</Button>
			}
		>
			{process.env.NODE_ENV === 'development' ? (
				<details className="mb-5 rounded-lg bg-muted/50 p-3 text-left">
					<summary className="cursor-pointer text-xs font-medium">Error details</summary>
					<pre className="mt-2 overflow-auto text-xs whitespace-pre-wrap text-destructive">
						{error.message}
						{error.stack ? `\n\n${error.stack}` : ''}
					</pre>
				</details>
			) : null}
		</BoundaryErrorView>
	)
}
