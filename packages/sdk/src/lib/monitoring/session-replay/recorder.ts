/**
 * Session Replay Recorder
 *
 * Core recording engine built on rrweb with SOTA enhancements.
 * Handles recording lifecycle, event batching, and uploads.
 */

import { record, type eventWithTime } from 'rrweb'
import { DeadClickDetector, RageClickDetector, ScrollThrashingDetector } from './detectors'
import { getPrivacyOptions, sanitizeForLogging, sanitizeUrl } from './privacy'
import type {
	ConsoleLog,
	DeadClick,
	NetworkRequest,
	RageClick,
	RecorderState,
	RecorderStatus,
	SessionData,
	SessionMarker,
	SessionMetadata,
	SessionReplayConfig,
	UploadCallback,
} from './types'
import { SESSION_REPLAY_MAX_DURATION_MS, SESSION_REPLAY_UPLOAD_INTERVAL_MS, LOG_MESSAGE_MAX_LENGTH, STACK_TRACE_MAX_LENGTH } from '../../../constants'
import { onFetchEnd, onXHREnd, type UnsubscribeFn } from '../network-interceptor'

// ==========================================
// Types
// ==========================================

type StopFn = () => void

// ==========================================
// Session Recorder
// ==========================================

/**
 * Session Replay Recorder
 *
 * Manages the full lifecycle of session recording with:
 * - Privacy-aware DOM recording
 * - Network/console capture
 * - Frustration detection (rage clicks, dead clicks)
 * - Efficient batching and compression
 */
export class SessionRecorder {
	private config: SessionReplayConfig
	private state: RecorderState = 'idle'
	private sessionId: string | null = null
	private startTime: number | null = null

	// Event storage
	private events: eventWithTime[] = []
	private markers: SessionMarker[] = []
	private rageClicks: RageClick[] = []
	private deadClicks: DeadClick[] = []
	private networkRequests: NetworkRequest[] = []
	private consoleLogs: ConsoleLog[] = []

	// rrweb handles
	private stopFn: StopFn | null = null

	// Detectors
	private rageClickDetector: RageClickDetector | null = null
	private deadClickDetector: DeadClickDetector | null = null
	private scrollThrashingDetector: ScrollThrashingDetector | null = null

	// Callbacks
	private uploadCallback: UploadCallback | null = null
	private eventCallback: ((event: eventWithTime) => void) | null = null
	private errorCallback: ((error: Error) => void) | null = null

	// Timers
	private uploadTimer: ReturnType<typeof setInterval> | null = null
	private durationTimer: ReturnType<typeof setTimeout> | null = null

	// Network interceptor cleanup
	private networkUnsubscribers: UnsubscribeFn[] = []

	// Stats
	private bytesRecorded = 0

	constructor(config: Partial<SessionReplayConfig> = {}) {
		this.config = { ...this.getDefaultConfig(), ...config }
	}

	private getDefaultConfig(): SessionReplayConfig {
		return {
			enabled: true,
			sampling: { rate: 100, alwaysRecordErrors: true },
			maxDuration: SESSION_REPLAY_MAX_DURATION_MS,
			privacyMode: 'balanced',
			maskSelectors: [],
			blockSelectors: [],
			ignoreSelectors: [],
			errorCorrelation: true,
			rageClickDetection: true,
			deadClickDetection: true,
			aiSummary: false,
			heatmaps: true,
			networkCapture: true,
			consoleCapture: true,
			compress: true,
			batchSize: 50,
			uploadInterval: SESSION_REPLAY_UPLOAD_INTERVAL_MS,
		}
	}

	// ==========================================
	// Lifecycle
	// ==========================================

	/**
	 * Start recording a new session
	 */
	start(): string {
		if (this.state === 'recording') {
			return this.sessionId!
		}

		if (!this.config.enabled) {
			throw new Error('Session replay is disabled')
		}

		// Check sampling
		if (!this.shouldSample()) {
			throw new Error('Session not sampled for recording')
		}

		// Generate session ID
		this.sessionId = this.generateSessionId()
		this.startTime = Date.now()
		this.state = 'recording'

		// Reset storage
		this.events = []
		this.markers = []
		this.rageClicks = []
		this.deadClicks = []
		this.networkRequests = []
		this.consoleLogs = []
		this.bytesRecorded = 0

		// Start rrweb recording
		this.startRrwebRecording()

		// Setup detectors
		this.setupDetectors()

		// Setup network/console capture
		if (this.config.networkCapture) {
			this.setupNetworkCapture()
		}
		if (this.config.consoleCapture) {
			this.setupConsoleCapture()
		}

		// Start upload timer
		this.startUploadTimer()

		// Set max duration timeout
		this.durationTimer = setTimeout(() => {
			this.stop()
		}, this.config.maxDuration)

		return this.sessionId
	}

	/**
	 * Pause recording
	 */
	pause(): void {
		if (this.state !== 'recording') return

		this.state = 'paused'

		if (this.stopFn) {
			this.stopFn()
			this.stopFn = null
		}
	}

	/**
	 * Resume recording
	 */
	resume(): void {
		if (this.state !== 'paused') return

		this.state = 'recording'
		this.startRrwebRecording()
	}

	/**
	 * Stop recording and upload final batch
	 */
	async stop(): Promise<void> {
		if (this.state === 'stopped' || this.state === 'idle') return

		this.state = 'stopped'

		// Stop rrweb
		if (this.stopFn) {
			this.stopFn()
			this.stopFn = null
		}

		// Clear timers
		if (this.uploadTimer) {
			clearInterval(this.uploadTimer)
			this.uploadTimer = null
		}
		if (this.durationTimer) {
			clearTimeout(this.durationTimer)
			this.durationTimer = null
		}

		// Cleanup detectors
		this.deadClickDetector?.destroy()
		this.rageClickDetector?.reset()
		this.scrollThrashingDetector?.reset()

		// Cleanup network interceptor listeners
		for (const unsub of this.networkUnsubscribers) {
			unsub()
		}
		this.networkUnsubscribers = []

		// Final upload
		await this.upload()
	}

	/**
	 * Get current status
	 */
	getStatus(): RecorderStatus {
		return {
			state: this.state,
			sessionId: this.sessionId,
			eventCount: this.events.length,
			startTime: this.startTime,
			duration: this.startTime ? Date.now() - this.startTime : 0,
			bytesRecorded: this.bytesRecorded,
		}
	}

	// ==========================================
	// Event Marking
	// ==========================================

	/**
	 * Add a custom marker to the session timeline
	 */
	addMarker(type: SessionMarker['type'], payload: Record<string, unknown> = {}): void {
		if (this.state !== 'recording') return

		this.markers.push({
			type,
			timestamp: Date.now(),
			payload,
		})
	}

	/**
	 * Mark an error in the session
	 * Used for error correlation feature
	 */
	markError(errorId: string, error: Error, metadata: Record<string, unknown> = {}): void {
		if (!this.config.errorCorrelation) return

		this.addMarker('error', {
			errorId,
			message: sanitizeForLogging(error.message),
			stack: error.stack?.slice(0, STACK_TRACE_MAX_LENGTH),
			...metadata,
		})
	}

	/**
	 * Mark a navigation event
	 */
	markNavigation(from: string, to: string): void {
		this.addMarker('navigation', {
			from: sanitizeUrl(from),
			to: sanitizeUrl(to),
		})
	}

	/**
	 * Mark a conversion event
	 */
	markConversion(name: string, value?: number): void {
		this.addMarker('conversion', { name, value })
	}

	// ==========================================
	// Callbacks
	// ==========================================

	/**
	 * Set upload callback for sending data to server
	 */
	onUpload(callback: UploadCallback): void {
		this.uploadCallback = callback
	}

	/**
	 * Set event callback for custom processing
	 */
	onEvent(callback: (event: eventWithTime) => void): void {
		this.eventCallback = callback
	}

	/**
	 * Set error callback
	 */
	onError(callback: (error: Error) => void): void {
		this.errorCallback = callback
	}

	// ==========================================
	// Private Methods
	// ==========================================

	private shouldSample(): boolean {
		const { sampling } = this.config
		return Math.random() * 100 < sampling.rate
	}

	private generateSessionId(): string {
		return `sr_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
	}

	private startRrwebRecording(): void {
		const privacyOptions = getPrivacyOptions(this.config.privacyMode, this.config.maskSelectors)

		const stopFn = record({
			emit: (event) => {
				this.handleEvent(event)
			},
			...privacyOptions,
			blockSelector: this.config.blockSelectors.join(', ') || undefined,
			ignoreSelector: this.config.ignoreSelectors.join(', ') || undefined,
			sampling: {
				mousemove: true,
				mouseInteraction: true,
				scroll: 150, // Throttle scroll events
				media: 800, // Throttle media time updates
				input: 'last', // Only capture last input value
			},
			recordCanvas: false, // Can be heavy
			collectFonts: false,
			inlineStylesheet: true,
			plugins: [],
		})

		if (!stopFn) {
			throw new Error('Failed to start rrweb recording')
		}

		this.stopFn = stopFn
	}

	private handleEvent(event: eventWithTime): void {
		this.events.push(event)
		this.bytesRecorded += JSON.stringify(event).length

		if (this.eventCallback) {
			this.eventCallback(event)
		}

		// Check batch size for early upload
		if (this.events.length >= this.config.batchSize) {
			void this.upload()
		}
	}

	private setupDetectors(): void {
		// Rage click detector
		if (this.config.rageClickDetection) {
			this.rageClickDetector = new RageClickDetector()
			this.rageClickDetector.onRageClick((rageClick) => {
				this.rageClicks.push(rageClick)
				this.addMarker('rage-click', { ...rageClick })
			})

			document.addEventListener('click', (e) => {
				this.rageClickDetector?.recordClick(e)
			})
		}

		// Dead click detector
		if (this.config.deadClickDetection) {
			this.deadClickDetector = new DeadClickDetector()
			this.deadClickDetector.onDeadClick((deadClick) => {
				this.deadClicks.push(deadClick)
				this.addMarker('dead-click', { ...deadClick })
			})

			document.addEventListener('click', (e) => {
				this.deadClickDetector?.recordClick(e)
			})
		}

		// Scroll thrashing detector
		this.scrollThrashingDetector = new ScrollThrashingDetector()
		this.scrollThrashingDetector.onThrashing((event) => {
			this.addMarker('custom', { type: 'scroll-thrashing', ...event })
		})

		window.addEventListener('scroll', () => {
			this.scrollThrashingDetector?.recordScroll(window.scrollY)
		})
	}

	/**
	 * Capture network requests via shared interceptor.
	 *
	 * Uses the centralized network interceptor instead of independently
	 * monkey-patching fetch/XHR. Records request metadata for session replay.
	 */
	private setupNetworkCapture(): void {
		this.networkUnsubscribers.push(
			onFetchEnd((event) => {
				this.networkRequests.push({
					timestamp: event.startTime,
					method: event.method,
					url: sanitizeUrl(event.url),
					status: event.status,
					duration: event.duration,
				})
			}),
		)

		this.networkUnsubscribers.push(
			onXHREnd((event) => {
				this.networkRequests.push({
					timestamp: event.startTime,
					method: event.method,
					url: sanitizeUrl(event.url),
					status: event.status,
					duration: event.duration,
				})
			}),
		)
	}

	private setupConsoleCapture(): void {
		const recorder = this
		const levels = ['log', 'info', 'warn', 'error'] as const
		const originalConsole: Partial<Record<(typeof levels)[number], (...args: unknown[]) => void>> =
			{}

		levels.forEach((level) => {
			originalConsole[level] = console[level]

			console[level] = (...args: unknown[]) => {
				const message = args.map((arg) => String(arg)).join(' ')

				recorder.consoleLogs.push({
					timestamp: Date.now(),
					level,
					message: sanitizeForLogging(message).slice(0, LOG_MESSAGE_MAX_LENGTH),
					stack: level === 'error' ? new Error().stack?.slice(0, STACK_TRACE_MAX_LENGTH) : undefined,
				})

				originalConsole[level]?.apply(console, args)
			}
		})
	}

	private startUploadTimer(): void {
		this.uploadTimer = setInterval(() => {
			void this.upload()
		}, this.config.uploadInterval)
	}

	private async upload(): Promise<void> {
		if (this.events.length === 0 || !this.uploadCallback) return

		const data: SessionData = {
			metadata: this.getMetadata(),
			events: this.events,
			markers: this.markers,
			rageClicks: this.rageClicks,
			deadClicks: this.deadClicks,
			networkRequests: this.networkRequests,
			consoleLogs: this.consoleLogs,
		}

		// Clear uploaded data
		this.events = []
		this.markers = []
		this.rageClicks = []
		this.deadClicks = []
		this.networkRequests = []
		this.consoleLogs = []

		try {
			await this.uploadCallback(data)
		} catch (error) {
			// Restore events on failure
			this.events = [...data.events, ...this.events]

			if (this.errorCallback) {
				this.errorCallback(error instanceof Error ? error : new Error(String(error)))
			}
		}
	}

	private getMetadata(): SessionMetadata {
		return {
			sessionId: this.sessionId!,
			startTime: this.startTime!,
			url: sanitizeUrl(window.location.href),
			userAgent: navigator.userAgent,
			screenWidth: window.screen.width,
			screenHeight: window.screen.height,
			devicePixelRatio: window.devicePixelRatio,
			timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
			language: navigator.language,
		}
	}
}

// ==========================================
// Singleton Instance
// ==========================================

let recorderInstance: SessionRecorder | null = null

/**
 * Get or create the session recorder instance
 */
export function getRecorder(config?: Partial<SessionReplayConfig>): SessionRecorder {
	if (!recorderInstance) {
		recorderInstance = new SessionRecorder(config)
	}
	return recorderInstance
}

/**
 * Reset the singleton instance
 */
export function resetRecorder(): void {
	if (recorderInstance) {
		void recorderInstance.stop()
		recorderInstance = null
	}
}
