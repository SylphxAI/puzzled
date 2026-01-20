/**
 * Error Tracker
 *
 * Core error tracking engine with:
 * - Sentry-compatible event format
 * - Session Replay integration
 * - Automatic breadcrumb collection
 * - Stack trace parsing
 */

import {
	addBreadcrumb,
	getBreadcrumbs,
	clearBreadcrumbs,
	enableAutoCapture,
	setMaxBreadcrumbs,
} from './breadcrumbs'
import type {
	ErrorEvent,
	ErrorTrackingConfig,
	CaptureExceptionOptions,
	CaptureMessageOptions,
	CaptureResult,
	ExceptionValue,
	StackFrame,
	UploadCallback,
	Breadcrumb,
} from './types'
import { DEFAULT_ERROR_CONFIG } from './types'

// ==========================================
// Error Tracker Class
// ==========================================

/**
 * Error Tracker
 *
 * Captures errors with full context including:
 * - Stack traces with source mapping support
 * - Breadcrumbs (automatic + manual)
 * - Session replay correlation
 * - Device/browser context
 */
export class ErrorTracker {
	private config: ErrorTrackingConfig
	private uploadCallback: UploadCallback | null = null
	private sessionReplayId: string | null = null
	private userId: string | null = null
	private userEmail: string | null = null
	private userName: string | null = null

	constructor(config: Partial<ErrorTrackingConfig> = {}) {
		this.config = { ...DEFAULT_ERROR_CONFIG, ...config }
	}

	// ==========================================
	// Initialization
	// ==========================================

	/**
	 * Initialize error tracking
	 */
	init(): void {
		if (!this.config.enabled) return
		if (typeof window === 'undefined') return

		// Setup max breadcrumbs
		setMaxBreadcrumbs(this.config.maxBreadcrumbs)

		// Setup auto capture
		enableAutoCapture({
			clicks: this.config.autoCaptureClicks,
			inputs: this.config.autoCaptureClicks, // Same as clicks for now
			network: this.config.autoCaptureNetwork,
			console: this.config.autoCaptureConsole,
			navigation: this.config.autoCaptureNavigation,
		})

		// Setup global error handlers
		if (this.config.captureUnhandledErrors) {
			window.addEventListener('error', (event) => {
				if (event.error instanceof Error) {
					void this.captureException(event.error, {
						tags: { source: 'window.onerror' },
						extra: {
							filename: event.filename,
							lineno: event.lineno,
							colno: event.colno,
						},
					})
				}
			})
		}

		if (this.config.captureUnhandledRejections) {
			window.addEventListener('unhandledrejection', (event) => {
				const error =
					event.reason instanceof Error ? event.reason : new Error(String(event.reason))

				void this.captureException(error, {
					tags: { source: 'unhandledrejection' },
				})
			})
		}
	}

	/**
	 * Set upload callback
	 */
	onUpload(callback: UploadCallback): void {
		this.uploadCallback = callback
	}

	// ==========================================
	// User & Session Context
	// ==========================================

	/**
	 * Set session replay ID for correlation
	 */
	setSessionReplayId(sessionId: string): void {
		this.sessionReplayId = sessionId
	}

	/**
	 * Set user information
	 */
	setUser(user: { id?: string; email?: string; username?: string }): void {
		this.userId = user.id ?? null
		this.userEmail = user.email ?? null
		this.userName = user.username ?? null
	}

	/**
	 * Clear user information
	 */
	clearUser(): void {
		this.userId = null
		this.userEmail = null
		this.userName = null
	}

	// ==========================================
	// Breadcrumbs
	// ==========================================

	/**
	 * Add a breadcrumb
	 */
	addBreadcrumb(breadcrumb: Breadcrumb): void {
		addBreadcrumb(breadcrumb)
	}

	// ==========================================
	// Capture Methods
	// ==========================================

	/**
	 * Capture an exception
	 */
	async captureException(
		error: Error,
		options: CaptureExceptionOptions = {}
	): Promise<CaptureResult> {
		if (!this.config.enabled) {
			return { eventId: '' }
		}

		// Sample rate check
		if (Math.random() > this.config.sampleRate) {
			return { eventId: '' }
		}

		const eventId = this.generateEventId()
		const timestamp = Date.now()

		// Build event
		const event: ErrorEvent = {
			event_id: eventId,
			timestamp: timestamp / 1000, // Sentry uses seconds
			platform: 'javascript',
			level: options.level ?? 'error',
			environment: this.config.environment,
			release: this.config.release,
			exception: {
				values: [this.parseException(error)],
			},
			tags: {
				...this.config.tags,
				...options.tags,
			},
			extra: options.extra,
			fingerprint: options.fingerprint,
			contexts: {
				...this.getDeviceContext(),
				...options.contexts,
				...(this.config.attachReplay && this.sessionReplayId
					? {
							replay: {
								session_id: options.replaySessionId ?? this.sessionReplayId,
								error_timestamp: timestamp,
							},
						}
					: {}),
			},
			user: options.user ?? this.getUserContext(),
			request: this.getRequestContext(),
			breadcrumbs: {
				values: getBreadcrumbs(),
			},
			sdk: {
				name: 'sylphx-sdk',
				version: '1.0.0',
				integrations: this.getIntegrations(),
			},
		}

		// Before send hook
		const processedEvent = this.config.beforeSend?.(event) ?? event

		if (!processedEvent) {
			return { eventId: '' }
		}

		// Upload
		try {
			if (this.uploadCallback) {
				await this.uploadCallback(processedEvent)
			}

			// Clear breadcrumbs after successful send
			clearBreadcrumbs()

			return {
				eventId,
				replaySessionId: this.sessionReplayId ?? undefined,
			}
		} catch (uploadError) {
			console.error('[Sylphx] Failed to upload error event:', uploadError)
			return { eventId }
		}
	}

	/**
	 * Capture a message
	 */
	async captureMessage(
		message: string,
		options: CaptureMessageOptions = {}
	): Promise<CaptureResult> {
		if (!this.config.enabled) {
			return { eventId: '' }
		}

		const eventId = this.generateEventId()

		const event: ErrorEvent = {
			event_id: eventId,
			timestamp: Date.now() / 1000,
			platform: 'javascript',
			level: options.level ?? 'info',
			environment: this.config.environment,
			release: this.config.release,
			message: {
				formatted: message,
				message,
			},
			tags: {
				...this.config.tags,
				...options.tags,
			},
			extra: options.extra,
			contexts: this.getDeviceContext(),
			user: this.getUserContext(),
			request: this.getRequestContext(),
			breadcrumbs: {
				values: getBreadcrumbs(),
			},
			sdk: {
				name: 'sylphx-sdk',
				version: '1.0.0',
			},
		}

		const processedEvent = this.config.beforeSend?.(event) ?? event

		if (!processedEvent) {
			return { eventId: '' }
		}

		try {
			if (this.uploadCallback) {
				await this.uploadCallback(processedEvent)
			}

			return { eventId }
		} catch (uploadError) {
			console.error('[Sylphx] Failed to upload message event:', uploadError)
			return { eventId }
		}
	}

	// ==========================================
	// Private Methods
	// ==========================================

	private generateEventId(): string {
		// Sentry uses 32-char hex IDs
		const chars = '0123456789abcdef'
		let id = ''
		for (let i = 0; i < 32; i++) {
			id += chars[Math.floor(Math.random() * 16)]
		}
		return id
	}

	private parseException(error: Error): ExceptionValue {
		const frames: StackFrame[] = []

		if (error.stack) {
			const lines = error.stack.split('\n').slice(1) // Skip first line (error message)

			for (const line of lines) {
				// Chrome/Edge format: "    at functionName (file:line:col)"
				// Firefox format: "functionName@file:line:col"
				const chromeMatch = line.match(/^\s*at\s+(?:(.+?)\s+)?(?:\()?(.+?):(\d+):(\d+)\)?$/)
				const firefoxMatch = line.match(/^(.*)@(.+?):(\d+):(\d+)$/)

				const match = chromeMatch || firefoxMatch
				if (match) {
					const [, fn, filename, lineno, colno] = match
					frames.push({
						function: fn || '<anonymous>',
						filename,
						lineno: parseInt(lineno ?? '0', 10),
						colno: parseInt(colno ?? '0', 10),
						in_app: !filename?.includes('node_modules') && !filename?.includes('vendor'),
					})
				}
			}
		}

		return {
			type: error.name || 'Error',
			value: error.message,
			stacktrace: frames.length > 0 ? { frames: frames.reverse() } : undefined, // Sentry wants frames bottom-to-top
			mechanism: {
				type: 'generic',
				handled: true,
			},
		}
	}

	private getDeviceContext(): ErrorEvent['contexts'] {
		if (typeof window === 'undefined') return {}

		const ua = navigator.userAgent
		const browserMatch = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/(\d+)/)
		const osMatch = ua.match(/(Windows|Mac OS X|Linux|Android|iOS)[^\d]*(\d+[\d._]*)?/)

		return {
			device: {
				screen_resolution: `${window.screen.width}x${window.screen.height}`,
				screen_density: window.devicePixelRatio,
				orientation:
					window.screen.orientation?.type.includes('landscape') ? 'landscape' : 'portrait',
				online: navigator.onLine,
			},
			browser: {
				name: browserMatch?.[1],
				version: browserMatch?.[2],
			},
			os: {
				name: osMatch?.[1]?.replace('Mac OS X', 'macOS'),
				version: osMatch?.[2]?.replace(/_/g, '.'),
			},
			runtime: {
				name: 'browser',
			},
		}
	}

	private getUserContext(): ErrorEvent['user'] | undefined {
		if (!this.userId && !this.userEmail && !this.userName) {
			return undefined
		}

		return {
			id: this.userId ?? undefined,
			email: this.userEmail ?? undefined,
			username: this.userName ?? undefined,
		}
	}

	private getRequestContext(): ErrorEvent['request'] | undefined {
		if (typeof window === 'undefined') return undefined

		return {
			url: window.location.href,
			query_string: window.location.search.slice(1),
			headers: {
				'User-Agent': navigator.userAgent,
			},
		}
	}

	private getIntegrations(): string[] {
		const integrations: string[] = []

		if (this.config.captureUnhandledErrors) integrations.push('GlobalErrorHandler')
		if (this.config.captureUnhandledRejections) integrations.push('UnhandledRejectionHandler')
		if (this.config.autoCaptureClicks) integrations.push('ClickCapture')
		if (this.config.autoCaptureNetwork) integrations.push('NetworkCapture')
		if (this.config.autoCaptureConsole) integrations.push('ConsoleCapture')
		if (this.config.autoCaptureNavigation) integrations.push('NavigationCapture')
		if (this.config.attachReplay) integrations.push('SessionReplay')

		return integrations
	}
}

// ==========================================
// Singleton Instance
// ==========================================

let trackerInstance: ErrorTracker | null = null

/**
 * Get or create the error tracker instance
 */
export function getTracker(config?: Partial<ErrorTrackingConfig>): ErrorTracker {
	if (!trackerInstance) {
		trackerInstance = new ErrorTracker(config)
	}
	return trackerInstance
}

/**
 * Initialize error tracking
 */
export function initErrorTracking(config?: Partial<ErrorTrackingConfig>): ErrorTracker {
	const tracker = getTracker(config)
	tracker.init()
	return tracker
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetTracker(): void {
	trackerInstance = null
}
