import * as Sentry from '@sentry/nextjs'

Sentry.init({
	dsn: process.env.SENTRY_DSN,

	// Performance Monitoring
	tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

	// Only enable in production
	enabled: process.env.NODE_ENV === 'production',

	// Set environment
	environment: process.env.NODE_ENV,

	// Before sending, add extra context
	beforeSend(event) {
		// Don't send events in development
		if (process.env.NODE_ENV !== 'production') {
			return null
		}
		return event
	},
})
