/**
 * Monitoring Context Value Factory
 *
 * Creates the Monitoring context value for the SylphxProvider.
 * Provides error tracking and message capture.
 */

import type { MonitoringContextValue } from '../services-context'
import type { RestApiClient } from '../rest-client'

// =============================================================================
// Types
// =============================================================================

export interface CreateMonitoringValueConfig {
	/** REST API client */
	api: RestApiClient
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create Monitoring context value.
 */
export function createMonitoringValue(config: CreateMonitoringValueConfig): MonitoringContextValue {
	const { api } = config

	return {
		captureException: async (error, options = {}) => {
			// Transform Error object into structured format for API
			const frames: Array<{
				filename?: string
				function?: string
				lineno?: number
				colno?: number
				in_app?: boolean
			}> = []

			if (error.stack) {
				const lines = error.stack.split('\n').slice(1)
				for (const line of lines) {
					const match = line.match(/^\s*at\s+(?:(.+?)\s+)?(?:\()?(.+?):(\d+):(\d+)\)?$/)
					if (match) {
						frames.push({
							function: match[1] || '<anonymous>',
							filename: match[2],
							lineno: parseInt(match[3] ?? '0', 10),
							colno: parseInt(match[4] ?? '0', 10),
							in_app: !match[2]?.includes('node_modules'),
						})
					}
				}
			}

			return await api.post('/monitoring/exception', {
				exception: {
					values: [
						{
							type: error.name || 'Error',
							value: error.message,
							stacktrace: frames.length > 0 ? { frames } : undefined,
						},
					],
				},
				level: options.level,
				tags: options.tags,
				extra: options.extra,
				fingerprint: options.fingerprint,
				route: options.route,
				userAgent: options.userAgent,
			})
		},

		captureMessage: async (message, options = {}) => {
			return await api.post('/monitoring/message', {
				message,
				level: options.level,
				tags: options.tags,
				extra: options.extra,
				route: options.route,
			})
		},
	}
}
