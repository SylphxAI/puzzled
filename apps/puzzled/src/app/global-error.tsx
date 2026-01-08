'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

type Props = {
	error: Error & { digest?: string }
	reset: () => void
}

/**
 * Global error boundary for the entire application
 * This catches errors in the root layout and other critical failures
 */
export default function GlobalError({ error, reset }: Props) {
	useEffect(() => {
		// Report error to Sentry with high priority
		Sentry.captureException(error, {
			level: 'fatal',
			tags: { errorBoundary: 'global' },
		})
	}, [error])

	return (
		<html lang="en">
			<body>
				<div
					style={{
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						minHeight: '100vh',
						padding: '1rem',
						textAlign: 'center',
						fontFamily: 'system-ui, sans-serif',
					}}
				>
					<h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
						Something went wrong!
					</h1>
					<p style={{ color: '#666', marginBottom: '1.5rem' }}>
						We&apos;re sorry, but something unexpected happened.
					</p>
					<button
						type="button"
						onClick={reset}
						style={{
							padding: '0.75rem 1.5rem',
							backgroundColor: '#000',
							color: '#fff',
							border: 'none',
							borderRadius: '0.5rem',
							cursor: 'pointer',
							fontSize: '1rem',
						}}
					>
						Try again
					</button>
				</div>
			</body>
		</html>
	)
}
