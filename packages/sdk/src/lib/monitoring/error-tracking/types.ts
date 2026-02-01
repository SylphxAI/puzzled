/**
 * Error Tracking Types
 *
 * Sentry-compatible types for error tracking.
 */

// ==========================================
// Core Types
// ==========================================

/**
 * Error severity levels (Sentry-compatible)
 */
export type ErrorLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug'

/**
 * Breadcrumb types (Sentry-compatible)
 */
export type BreadcrumbType =
	| 'default'
	| 'navigation'
	| 'http'
	| 'ui'
	| 'user'
	| 'error'
	| 'info'
	| 'debug'

/**
 * Breadcrumb for tracking user actions leading to an error
 */
export interface Breadcrumb {
	type?: BreadcrumbType
	category?: string
	message?: string
	data?: Record<string, unknown>
	level?: ErrorLevel
	timestamp?: number
}

/**
 * Stack frame (Sentry-compatible)
 */
export interface StackFrame {
	filename?: string
	function?: string
	module?: string
	lineno?: number
	colno?: number
	abs_path?: string
	context_line?: string
	pre_context?: string[]
	post_context?: string[]
	in_app?: boolean
	vars?: Record<string, unknown>
}

/**
 * Parsed exception (Sentry-compatible)
 */
export interface ExceptionValue {
	type: string
	value: string
	module?: string
	thread_id?: number
	stacktrace?: {
		frames: StackFrame[]
	}
	mechanism?: {
		type: string
		handled: boolean
		data?: Record<string, unknown>
	}
}

// ==========================================
// Event Types
// ==========================================

/**
 * Error event to send to server (Sentry-compatible)
 */
export interface ErrorEvent {
	event_id: string
	timestamp: number
	platform: string
	level: ErrorLevel
	logger?: string
	transaction?: string
	server_name?: string
	release?: string
	dist?: string
	environment?: string
	message?: {
		formatted?: string
		message?: string
		params?: unknown[]
	}
	exception?: {
		values: ExceptionValue[]
	}
	threads?: {
		values: Array<{
			id: number
			name?: string
			crashed?: boolean
			current?: boolean
			stacktrace?: { frames: StackFrame[] }
		}>
	}
	tags?: Record<string, string>
	extra?: Record<string, unknown>
	contexts?: {
		device?: {
			name?: string
			family?: string
			model?: string
			model_id?: string
			arch?: string
			battery_level?: number
			orientation?: string
			manufacturer?: string
			brand?: string
			screen_resolution?: string
			screen_density?: number
			screen_dpi?: number
			online?: boolean
			charging?: boolean
			low_memory?: boolean
			simulator?: boolean
			memory_size?: number
			free_memory?: number
			usable_memory?: number
			storage_size?: number
			free_storage?: number
			external_storage_size?: number
			external_free_storage?: number
		}
		os?: {
			name?: string
			version?: string
			build?: string
			kernel_version?: string
			rooted?: boolean
		}
		browser?: {
			name?: string
			version?: string
		}
		runtime?: {
			name?: string
			version?: string
		}
		app?: {
			app_name?: string
			app_version?: string
			app_identifier?: string
			app_build?: string
			app_start_time?: string
			device_app_hash?: string
		}
		trace?: {
			trace_id?: string
			span_id?: string
			parent_span_id?: string
			op?: string
			status?: string
		}
		// Session Replay integration
		replay?: {
			session_id?: string
			error_timestamp?: number
		}
	}
	user?: {
		id?: string
		email?: string
		username?: string
		ip_address?: string
		geo?: {
			country_code?: string
			city?: string
			region?: string
		}
	}
	request?: {
		url?: string
		method?: string
		query_string?: string
		headers?: Record<string, string>
		data?: unknown
		cookies?: string
		env?: Record<string, string>
	}
	breadcrumbs?: {
		values: Breadcrumb[]
	}
	fingerprint?: string[]
	sdk?: {
		name: string
		version: string
		packages?: Array<{ name: string; version: string }>
		integrations?: string[]
	}
}

// ==========================================
// Configuration
// ==========================================

/**
 * Source map configuration for server-side processing
 * Follows Sentry's source map artifact pattern
 */
export interface SourceMapConfig {
	/**
	 * URL prefix for matching stack trace URLs to source maps
	 * @example '~/' for relative paths, 'https://example.com/static/' for absolute
	 */
	urlPrefix?: string
	/**
	 * Include source map references in error events
	 * Server will use these to resolve original source locations
	 */
	includeSourceMapReferences?: boolean
	/**
	 * Artifact bundle ID (set automatically when source maps are uploaded)
	 * Links error events to the correct source map version
	 */
	artifactBundleId?: string
	/**
	 * Debug IDs mapping for specific files
	 * Used for more precise source map matching
	 */
	debugIds?: Record<string, string>
}

/**
 * Error tracking configuration
 */
export interface ErrorTrackingConfig {
	/** Enable/disable error tracking */
	enabled: boolean
	/** Environment (production, staging, development) */
	environment?: string
	/** App release version */
	release?: string
	/**
	 * Distribution identifier (e.g., build number)
	 * Used with release for precise source map matching
	 */
	dist?: string
	/** DSN for uploading (if using external Sentry) */
	dsn?: string
	/** Sample rate (0-1) */
	sampleRate: number
	/** Capture unhandled errors */
	captureUnhandledErrors: boolean
	/** Capture unhandled promise rejections */
	captureUnhandledRejections: boolean
	/** Max breadcrumbs to keep */
	maxBreadcrumbs: number
	/** Attach session replay ID to errors */
	attachReplay: boolean
	/** Automatically capture clicks */
	autoCaptureClicks: boolean
	/** Automatically capture network requests */
	autoCaptureNetwork: boolean
	/** Automatically capture console logs */
	autoCaptureConsole: boolean
	/** Automatically capture navigation */
	autoCaptureNavigation: boolean
	/** Before send hook for filtering/modifying events */
	beforeSend?: (event: ErrorEvent) => ErrorEvent | null
	/** Tags to add to all events */
	tags?: Record<string, string>
	/**
	 * Source map configuration for server-side stack trace processing
	 * Server uses source maps to show original file names, line numbers, and code context
	 */
	sourceMap?: SourceMapConfig
}

/**
 * Default configuration
 */
export const DEFAULT_ERROR_CONFIG: ErrorTrackingConfig = {
	enabled: true,
	sampleRate: 1.0,
	captureUnhandledErrors: true,
	captureUnhandledRejections: true,
	maxBreadcrumbs: 100,
	attachReplay: true,
	autoCaptureClicks: true,
	autoCaptureNetwork: true,
	autoCaptureConsole: true,
	autoCaptureNavigation: true,
	sourceMap: {
		includeSourceMapReferences: true,
	},
}

// ==========================================
// Capture Options
// ==========================================

/**
 * Options for capturing an exception
 */
export interface CaptureExceptionOptions {
	level?: ErrorLevel
	tags?: Record<string, string>
	extra?: Record<string, unknown>
	fingerprint?: string[]
	user?: ErrorEvent['user']
	contexts?: ErrorEvent['contexts']
	/** Attach specific replay session */
	replaySessionId?: string
}

/**
 * Options for capturing a message
 */
export interface CaptureMessageOptions {
	level?: ErrorLevel
	tags?: Record<string, string>
	extra?: Record<string, unknown>
}

// ==========================================
// Callback Types
// ==========================================

/**
 * Upload callback
 */
export type UploadCallback = (event: ErrorEvent) => Promise<UploadResult>

/**
 * Upload result from server
 */
export interface UploadResult {
	eventId: string
	/** Whether this is a new unique error (vs duplicate) */
	isNewError?: boolean
	/** Server-recommended sample rate based on quota usage (0-1) */
	recommendedSampleRate?: number
	/** Current quota usage percentage (0-100+) */
	quotaUsage?: number
}

/**
 * Capture result
 */
export interface CaptureResult {
	eventId: string
	replaySessionId?: string
}
