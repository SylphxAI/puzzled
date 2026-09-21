/**
 * Error-boundary reporting that must not touch Sylphx hooks.
 *
 * `useErrorTracking` requires a Monitoring context that SylphxProvider
 * does not always provide. Calling it from `error.tsx` replaces the
 * original throw with "Monitoring hooks must be used within a
 * SylphxProvider" and hides the real crossword/play failure.
 */

import { logger } from '@/lib/logger'

export function reportBoundaryError(boundary: string, error: Error & { digest?: string }): void {
	logger.error('error-boundary.report', {
		boundary,
		message: error.message,
		digest: error.digest,
		error,
	})
}
