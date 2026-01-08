import * as Sentry from '@sentry/nextjs'

Sentry.init({
	dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

	// Performance Monitoring
	tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

	// Session Replay (optional - captures user sessions for debugging)
	replaysSessionSampleRate: 0.1,
	replaysOnErrorSampleRate: 1.0,

	// Only enable in production
	enabled: process.env.NODE_ENV === 'production',

	// Set environment
	environment: process.env.NODE_ENV,

	// Filter out noisy errors
	ignoreErrors: [
		// Browser extensions
		/^chrome-extension:\/\//,
		/^moz-extension:\/\//,
		// Network errors that users can't control
		'Network request failed',
		'Failed to fetch',
		'Load failed',
		// User cancelled actions
		'AbortError',
		'ResizeObserver loop',
	],

	// Add integrations
	integrations: [
		Sentry.replayIntegration({
			maskAllText: true,
			blockAllMedia: true,
		}),
	],

	// Before sending, add extra context
	beforeSend(event) {
		// Don't send events in development
		if (process.env.NODE_ENV !== 'production') {
			return null
		}
		return event
	},
})
