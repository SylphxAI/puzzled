'use client'

/**
 * The one view behind every route error boundary (TD-07).
 *
 * The five `error.tsx` files had all grown the same three things: report the
 * throw once through the plain reporter (never the monitoring hooks — see
 * `lib/report-boundary-error` for why), render the alert badge + copy, and
 * offer the recovery actions. A behaviour fix meant five edits; this keeps it
 * in one place. A wrapper passes only what is genuinely its own: copy from its
 * own translation keys, extra actions, a container class.
 *
 * `app/global-error.tsx` deliberately does not use this: it renders when the
 * providers and the app stylesheet may not exist at all, so it stays
 * dependency-free.
 */

import { Button } from '@sylphx/ui'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { type ReactNode, useEffect, useRef } from 'react'
import { reportBoundaryError } from '@/lib/report-boundary-error'

export type BoundaryErrorViewProps = {
	/** Boundary name in the console report, e.g. `auth` or `game-page`. */
	boundary: string
	error: Error & { digest?: string }
	reset: () => void
	/** Already-resolved copy — wrappers keep their own translation keys. */
	title: string
	description: string
	/** Label of the standard retry button (calls `reset`). */
	retryLabel: string
	/** Icon inside the alert badge; defaults to the warning triangle. */
	icon?: ReactNode
	/** Raw error text shown under the description, when a surface wants it. */
	detail?: string
	/** Extra recovery actions, after the retry button. */
	actions?: ReactNode
	/** Anything between the copy and the actions (e.g. dev-only details). */
	children?: ReactNode
	/** Outer container; defaults to the in-page block most routes use. */
	className?: string
}

export function BoundaryErrorView({
	boundary,
	error,
	reset,
	title,
	description,
	retryLabel,
	icon,
	detail,
	actions,
	children,
	className = 'flex min-h-[60vh] items-center justify-center p-4 text-center',
}: BoundaryErrorViewProps) {
	const reported = useRef(false)

	useEffect(() => {
		if (reported.current) return
		reported.current = true
		reportBoundaryError(boundary, error)
	}, [boundary, error])

	return (
		<div className={className}>
			<div className="max-w-md">
				<span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
					{icon ?? <AlertTriangle className="h-7 w-7 text-destructive" aria-hidden="true" />}
				</span>

				<h1 className="font-display text-2xl font-extrabold tracking-tight">{title}</h1>
				<p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
				{detail ? <p className="mt-2 text-sm text-destructive break-words">{detail}</p> : null}
				{children}

				<div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
					<Button variant="outline" onClick={reset} className="min-h-11 gap-2">
						<RefreshCw className="h-4 w-4" aria-hidden="true" />
						{retryLabel}
					</Button>
					{actions}
				</div>
			</div>
		</div>
	)
}
