/**
 * SSE Streaming for Feature Flags
 *
 * Real-time flag updates via Server-Sent Events.
 * Supports automatic reconnection with exponential backoff.
 */

import type {
	FeatureFlagsConfig,
	FlagDefinition,
	StreamMessage,
	FlagUpdateMessage,
	FlagDeleteMessage,
	FlagsMessage,
	ErrorMessage,
	FlagClientEvent,
} from './types'
import { LocalEvaluator } from './evaluator'

// ==========================================
// Types
// ==========================================

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

interface StreamingOptions {
	/** SSE endpoint */
	endpoint: string
	/** Environment key for authentication */
	environmentKey?: string
	/** Initial reconnection delay in ms */
	initialReconnectDelay?: number
	/** Maximum reconnection delay in ms */
	maxReconnectDelay?: number
	/** Maximum reconnection attempts (0 = infinite) */
	maxReconnectAttempts?: number
	/** Heartbeat timeout in ms (consider connection dead if no ping) */
	heartbeatTimeout?: number
	/** Debug mode */
	debug?: boolean
}

const DEFAULT_STREAMING_OPTIONS: Required<Omit<StreamingOptions, 'endpoint' | 'environmentKey'>> = {
	initialReconnectDelay: 1000,
	maxReconnectDelay: 30000,
	maxReconnectAttempts: 0, // Infinite
	heartbeatTimeout: 45000, // 45 seconds
	debug: false,
}

// ==========================================
// Flag Stream
// ==========================================

/**
 * SSE Stream Manager
 *
 * Manages real-time flag updates via Server-Sent Events.
 * Automatically reconnects on disconnection.
 */
export class FlagStream {
	private options: Required<Omit<StreamingOptions, 'environmentKey'>> & Pick<StreamingOptions, 'environmentKey'>
	private evaluator: LocalEvaluator
	private eventSource: EventSource | null = null
	private state: ConnectionState = 'disconnected'
	private reconnectAttempts = 0
	private reconnectTimeout: ReturnType<typeof setTimeout> | null = null
	private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null
	private listeners: Set<(event: FlagClientEvent) => void> = new Set()

	constructor(evaluator: LocalEvaluator, options: StreamingOptions) {
		this.evaluator = evaluator
		this.options = {
			...DEFAULT_STREAMING_OPTIONS,
			...options,
		}
	}

	// ==========================================
	// Connection Management
	// ==========================================

	/**
	 * Connect to the SSE stream
	 */
	connect(): void {
		if (typeof window === 'undefined') return
		if (this.state === 'connected' || this.state === 'connecting') return

		this.state = 'connecting'
		this.debug('Connecting to stream', { endpoint: this.options.endpoint })

		// Build URL with auth
		const url = new URL(this.options.endpoint, window.location.origin)
		if (this.options.environmentKey) {
			url.searchParams.set('key', this.options.environmentKey)
		}

		try {
			this.eventSource = new EventSource(url.toString())

			this.eventSource.onopen = () => {
				this.state = 'connected'
				this.reconnectAttempts = 0
				this.debug('Connected to stream')
				this.startHeartbeatMonitor()
			}

			this.eventSource.onmessage = (event) => {
				this.handleMessage(event)
			}

			this.eventSource.onerror = (error) => {
				this.debug('Stream error', { error })
				this.handleDisconnect()
			}

			// Listen for specific event types
			this.eventSource.addEventListener('flags', (event) => {
				this.handleFlagsMessage(event)
			})

			this.eventSource.addEventListener('flag_update', (event) => {
				this.handleFlagUpdate(event)
			})

			this.eventSource.addEventListener('flag_delete', (event) => {
				this.handleFlagDelete(event)
			})

			this.eventSource.addEventListener('ping', () => {
				this.resetHeartbeatMonitor()
			})
		} catch (error) {
			this.debug('Failed to create EventSource', { error })
			this.handleDisconnect()
		}
	}

	/**
	 * Disconnect from the stream
	 */
	disconnect(): void {
		this.debug('Disconnecting from stream')

		if (this.eventSource) {
			this.eventSource.close()
			this.eventSource = null
		}

		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout)
			this.reconnectTimeout = null
		}

		if (this.heartbeatTimeout) {
			clearTimeout(this.heartbeatTimeout)
			this.heartbeatTimeout = null
		}

		this.state = 'disconnected'
		this.reconnectAttempts = 0
	}

	/**
	 * Get current connection state
	 */
	getState(): ConnectionState {
		return this.state
	}

	/**
	 * Check if connected
	 */
	isConnected(): boolean {
		return this.state === 'connected'
	}

	// ==========================================
	// Event Listeners
	// ==========================================

	/**
	 * Subscribe to flag events
	 */
	subscribe(listener: (event: FlagClientEvent) => void): () => void {
		this.listeners.add(listener)
		return () => this.listeners.delete(listener)
	}

	private emit(event: FlagClientEvent): void {
		for (const listener of this.listeners) {
			try {
				listener(event)
			} catch (error) {
				this.debug('Listener error', { error })
			}
		}
	}

	// ==========================================
	// Message Handlers
	// ==========================================

	private handleMessage(event: MessageEvent): void {
		this.resetHeartbeatMonitor()

		try {
			const message = JSON.parse(event.data) as StreamMessage

			switch (message.type) {
				case 'flags':
					this.handleFlagsData((message as FlagsMessage).data)
					break
				case 'flag_update':
					this.handleFlagUpdateData((message as FlagUpdateMessage).data)
					break
				case 'flag_delete':
					this.handleFlagDeleteData((message as FlagDeleteMessage).data)
					break
				case 'ping':
					// Just reset heartbeat (already done above)
					break
				case 'error':
					this.emit({ type: 'error', error: (message as ErrorMessage).data })
					break
			}
		} catch (error) {
			this.debug('Failed to parse message', { error, data: event.data })
		}
	}

	private handleFlagsMessage(event: MessageEvent): void {
		this.resetHeartbeatMonitor()
		try {
			const flags = JSON.parse(event.data) as FlagDefinition[]
			this.handleFlagsData(flags)
		} catch (error) {
			this.debug('Failed to parse flags message', { error })
		}
	}

	private handleFlagsData(flags: FlagDefinition[]): void {
		this.evaluator.setFlags(flags)
		this.emit({ type: 'ready', flags })
		this.debug('Received initial flags', { count: flags.length })
	}

	private handleFlagUpdate(event: MessageEvent): void {
		this.resetHeartbeatMonitor()
		try {
			const flag = JSON.parse(event.data) as FlagDefinition
			this.handleFlagUpdateData(flag)
		} catch (error) {
			this.debug('Failed to parse flag update', { error })
		}
	}

	private handleFlagUpdateData(flag: FlagDefinition): void {
		this.evaluator.updateFlag(flag)
		this.emit({ type: 'updated', flags: this.evaluator.getFlags() })
		this.debug('Flag updated', { key: flag.key })
	}

	private handleFlagDelete(event: MessageEvent): void {
		this.resetHeartbeatMonitor()
		try {
			const data = JSON.parse(event.data) as { key: string }
			this.handleFlagDeleteData(data)
		} catch (error) {
			this.debug('Failed to parse flag delete', { error })
		}
	}

	private handleFlagDeleteData(data: { key: string }): void {
		this.evaluator.removeFlag(data.key)
		this.emit({ type: 'updated', flags: this.evaluator.getFlags() })
		this.debug('Flag deleted', { key: data.key })
	}

	// ==========================================
	// Reconnection
	// ==========================================

	private handleDisconnect(): void {
		if (this.eventSource) {
			this.eventSource.close()
			this.eventSource = null
		}

		this.stopHeartbeatMonitor()

		if (
			this.options.maxReconnectAttempts > 0 &&
			this.reconnectAttempts >= this.options.maxReconnectAttempts
		) {
			this.state = 'disconnected'
			this.emit({
				type: 'error',
				error: {
					code: 'NETWORK_ERROR',
					message: 'Max reconnection attempts reached',
				},
			})
			return
		}

		this.state = 'reconnecting'
		this.scheduleReconnect()
	}

	private scheduleReconnect(): void {
		// Calculate delay with exponential backoff + jitter
		const baseDelay = Math.min(
			this.options.initialReconnectDelay * Math.pow(2, this.reconnectAttempts),
			this.options.maxReconnectDelay
		)
		const jitter = Math.random() * baseDelay * 0.3
		const delay = Math.floor(baseDelay + jitter)

		this.debug('Scheduling reconnect', {
			attempt: this.reconnectAttempts + 1,
			delay,
		})

		this.reconnectTimeout = setTimeout(() => {
			this.reconnectAttempts++
			this.connect()
		}, delay)
	}

	// ==========================================
	// Heartbeat Monitoring
	// ==========================================

	private startHeartbeatMonitor(): void {
		this.resetHeartbeatMonitor()
	}

	private resetHeartbeatMonitor(): void {
		if (this.heartbeatTimeout) {
			clearTimeout(this.heartbeatTimeout)
		}

		this.heartbeatTimeout = setTimeout(() => {
			this.debug('Heartbeat timeout - reconnecting')
			this.emit({ type: 'stale' })
			this.handleDisconnect()
		}, this.options.heartbeatTimeout)
	}

	private stopHeartbeatMonitor(): void {
		if (this.heartbeatTimeout) {
			clearTimeout(this.heartbeatTimeout)
			this.heartbeatTimeout = null
		}
	}

	// ==========================================
	// Utilities
	// ==========================================

	private debug(message: string, data?: unknown): void {
		if (this.options.debug) {
			console.log(`[FlagStream] ${message}`, data ?? '')
		}
	}
}

// ==========================================
// Factory
// ==========================================

/**
 * Create a flag stream connected to an evaluator
 */
export function createFlagStream(
	evaluator: LocalEvaluator,
	options: StreamingOptions
): FlagStream {
	return new FlagStream(evaluator, options)
}

// ==========================================
// HTTP Fetching (Fallback)
// ==========================================

/**
 * Fetch flags via HTTP (fallback when SSE not available)
 */
export async function fetchFlags(
	endpoint: string,
	environmentKey?: string
): Promise<FlagDefinition[]> {
	const url = new URL(endpoint)
	if (environmentKey) {
		url.searchParams.set('key', environmentKey)
	}

	const response = await fetch(url.toString(), {
		headers: {
			Accept: 'application/json',
		},
	})

	if (!response.ok) {
		throw new Error(`Failed to fetch flags: ${response.status}`)
	}

	return response.json()
}

/**
 * Sync flags via HTTP polling
 */
export function pollFlags(
	evaluator: LocalEvaluator,
	endpoint: string,
	options: {
		environmentKey?: string
		interval?: number
		onError?: (error: Error) => void
	} = {}
): () => void {
	const { environmentKey, interval = 60000, onError } = options

	const poll = async () => {
		try {
			const flags = await fetchFlags(endpoint, environmentKey)
			evaluator.setFlags(flags)
		} catch (error) {
			onError?.(error as Error)
		}
	}

	// Initial fetch
	void poll()

	// Set up polling
	const intervalId = setInterval(poll, interval)

	// Return cleanup function
	return () => clearInterval(intervalId)
}
