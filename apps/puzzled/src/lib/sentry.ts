import * as Sentry from '@sentry/nextjs'

/**
 * Capture an error with additional context
 */
export function captureError(
	error: Error | string,
	context?: {
		tags?: Record<string, string>
		extra?: Record<string, unknown>
		level?: 'fatal' | 'error' | 'warning' | 'info'
	},
) {
	const err = typeof error === 'string' ? new Error(error) : error

	Sentry.withScope((scope) => {
		if (context?.tags) {
			for (const [key, value] of Object.entries(context.tags)) {
				scope.setTag(key, value)
			}
		}

		if (context?.extra) {
			for (const [key, value] of Object.entries(context.extra)) {
				scope.setExtra(key, value)
			}
		}

		if (context?.level) {
			scope.setLevel(context.level)
		}

		Sentry.captureException(err)
	})
}

/**
 * Capture a message with additional context
 */
export function captureMessage(
	message: string,
	level: 'fatal' | 'error' | 'warning' | 'info' = 'info',
	extra?: Record<string, unknown>,
) {
	Sentry.withScope((scope) => {
		scope.setLevel(level)

		if (extra) {
			for (const [key, value] of Object.entries(extra)) {
				scope.setExtra(key, value)
			}
		}

		Sentry.captureMessage(message)
	})
}
