/**
 * Real-time Streaming Hooks
 *
 * SSE-based real-time subscriptions for Redis Streams.
 * Automatic reconnection, message history, and optimistic updates.
 *
 * @example
 * ```tsx
 * function Chat({ roomId }) {
 *   const { messages, emit, status } = useRealtime<ChatMessage>(`chat:${roomId}`, {
 *     events: ['message', 'typing'],
 *     history: 50,
 *     onMessage: (msg) => console.log('New:', msg),
 *   })
 *
 *   return (
 *     <div>
 *       <div>Status: {status}</div>
 *       {messages.map(msg => <Message key={msg.id} {...msg} />)}
 *       <button onClick={() => emit('message', { text: 'Hello!' })}>
 *         Send
 *       </button>
 *     </div>
 *   )
 * }
 * ```
 */

'use client'

import { useState, useEffect, useCallback, useRef, useContext } from 'react'
import { DEFAULT_PLATFORM_URL, SDK_API_PATH } from '../../constants'
import type { StreamMessage } from '../../realtime-types'
import { PlatformContext } from '../platform-context'

// Re-export shared type for consumers who import from react
export type { StreamMessage }

/** Connection status */
export type RealtimeStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

/** Options for useRealtime hook */
export interface UseRealtimeOptions<T> {
	/** Events to listen for (if empty, listens to all events) */
	events?: string[]
	/** Number of historical messages to load on connect, or options object */
	history?: number | { start?: string; limit?: number }
	/** Callback when connected */
	onConnect?: (channel: string) => void
	/** Callback on new message */
	onMessage?: (message: StreamMessage<T>) => void
	/** Callback on reconnect signal */
	onReconnect?: () => void
	/** Callback on error */
	onError?: (error: Error) => void
	/** Whether to auto-connect (default: true) */
	enabled?: boolean
	/** Platform URL (uses provider config if not specified) */
	platformUrl?: string
}

/** Return type for useRealtime hook */
export interface UseRealtimeReturn<T> {
	/** Messages in chronological order */
	messages: StreamMessage<T>[]
	/** Connection state */
	status: RealtimeStatus
	/** Emit to this channel */
	emit: (event: string, data: T) => Promise<string>
	/** Clear local messages */
	clear: () => void
	/** Manually connect */
	connect: () => void
	/** Manually disconnect */
	disconnect: () => void
}

/** Options for useRealtimeChannels hook */
export interface UseRealtimeChannelsOptions<T> extends Omit<UseRealtimeOptions<T>, 'history'> {
	/** History options per channel, or single value for all */
	history?: number | Record<string, number | { start?: string; limit?: number }>
}

// ============================================
// useRealtime Hook
// ============================================

/**
 * Subscribe to real-time events via SSE
 *
 * @param channel - Channel name to subscribe to
 * @param options - Configuration options
 * @returns Messages, status, and control functions
 *
 * @example
 * ```tsx
 * function Chat({ roomId }) {
 *   const { messages, emit, status } = useRealtime<ChatMessage>(`chat:${roomId}`, {
 *     events: ['message', 'typing'],
 *     history: 50,
 *     onMessage: (msg) => console.log('New:', msg),
 *   })
 *
 *   return (
 *     <div>
 *       <div>Status: {status}</div>
 *       {messages.map(msg => <Message key={msg.id} {...msg} />)}
 *       <button onClick={() => emit('message', { text: 'Hello!' })}>
 *         Send
 *       </button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useRealtime<T = unknown>(
	channel: string,
	options: UseRealtimeOptions<T> = {}
): UseRealtimeReturn<T> {
	const {
		events,
		history,
		onConnect,
		onMessage,
		onReconnect,
		onError,
		enabled = true,
		platformUrl: customPlatformUrl,
	} = options

	const [messages, setMessages] = useState<StreamMessage<T>[]>([])
	const [status, setStatus] = useState<RealtimeStatus>('disconnected')

	// Get platform context for API key and URL
	const platformContext = useContext(PlatformContext)
	const appId = platformContext?.appId || ''

	// Refs to avoid stale closures
	const lastAckRef = useRef<string>('0')
	const eventSourceRef = useRef<EventSource | null>(null)
	const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const reconnectAttemptRef = useRef(0)
	const mountedRef = useRef(true)

	// Determine platform URL
	const platformUrl = customPlatformUrl || platformContext?.platformUrl || DEFAULT_PLATFORM_URL

	// Build subscription URL
	const buildUrl = useCallback(() => {
		const url = new URL(`${platformUrl}${SDK_API_PATH}/realtime/subscribe`)
		url.searchParams.set('channel', channel)

		// Add last acknowledged ID for resumption
		if (lastAckRef.current !== '0') {
			url.searchParams.set(`last_ack_${channel}`, lastAckRef.current)
		}

		return url.toString()
	}, [platformUrl, channel])

	// Fetch history
	const fetchHistory = useCallback(async () => {
		if (!history) return

		const historyLimit = typeof history === 'number' ? history : history.limit ?? 100
		const historyStart = typeof history === 'object' ? history.start : undefined

		try {
			const response = await fetch(`${platformUrl}${SDK_API_PATH}/realtime/history`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-app-secret': appId,
				},
				body: JSON.stringify({
					channel,
					start: historyStart,
					limit: historyLimit,
				}),
			})

			if (!response.ok) return

			const result = (await response.json()) as { messages: StreamMessage<T>[] }
			if (!mountedRef.current) return

			if (result.messages.length > 0) {
				setMessages(result.messages)
				// Update last ack to latest message
				lastAckRef.current = result.messages[result.messages.length - 1].id
			}
		} catch {
			// History fetch is best-effort, don't fail the connection
		}
	}, [platformUrl, appId, channel, history])

	// Connect to SSE stream
	const connect = useCallback(() => {
		if (!enabled || !appId) return

		// Clean up existing connection
		if (eventSourceRef.current) {
			eventSourceRef.current.close()
		}

		setStatus('connecting')

		// EventSource doesn't support custom headers, so we use query params
		const url = new URL(buildUrl())
		url.searchParams.set('app_id', appId)

		const es = new EventSource(url.toString())
		eventSourceRef.current = es

		es.onopen = () => {
			if (!mountedRef.current) return
			reconnectAttemptRef.current = 0 // Reset backoff on successful connect
			setStatus('connected')
			fetchHistory()
			onConnect?.(channel)
		}

		es.onmessage = (event) => {
			if (!mountedRef.current) return

			try {
				const data = JSON.parse(event.data) as StreamMessage<T> & { type?: string }

				// Handle special message types
				if (data.type === 'connected') {
					setStatus('connected')
					onConnect?.(channel)
					return
				}

				if (data.type === 'reconnect') {
					setStatus('reconnecting')
					onReconnect?.()
					es.close()
					// Reconnect after small delay
					reconnectTimeoutRef.current = setTimeout(() => {
						if (mountedRef.current) connect()
					}, 100)
					return
				}

				if (data.type === 'heartbeat') {
					// Heartbeat - just keep connection alive
					return
				}

				// Regular message - check event filter
				if (events && events.length > 0 && !events.includes(data.event)) {
					return
				}

				// Add message to state
				setMessages((prev) => [...prev, data as StreamMessage<T>])
				lastAckRef.current = data.id
				onMessage?.(data as StreamMessage<T>)
			} catch {
				// Invalid JSON - ignore
			}
		}

		es.onerror = () => {
			if (!mountedRef.current) return

			setStatus('reconnecting')
			es.close()

			// Reconnect with exponential backoff: 1s, 2s, 4s, 8s, ... up to 30s
			const attempt = reconnectAttemptRef.current
			reconnectAttemptRef.current = attempt + 1
			const delay = Math.min(1000 * Math.pow(2, attempt), 30000)
			reconnectTimeoutRef.current = setTimeout(() => {
				if (mountedRef.current && enabled) connect()
			}, delay)

			onError?.(new Error('SSE connection error'))
		}
	}, [enabled, appId, buildUrl, fetchHistory, channel, events, onConnect, onMessage, onReconnect, onError])

	// Disconnect
	const disconnect = useCallback(() => {
		if (eventSourceRef.current) {
			eventSourceRef.current.close()
			eventSourceRef.current = null
		}
		if (reconnectTimeoutRef.current) {
			clearTimeout(reconnectTimeoutRef.current)
			reconnectTimeoutRef.current = null
		}
		setStatus('disconnected')
	}, [])

	// Emit message
	const emit = useCallback(
		async (event: string, data: T): Promise<string> => {
			const response = await fetch(`${platformUrl}${SDK_API_PATH}/realtime/emit`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-app-secret': appId,
				},
				body: JSON.stringify({ channel, event, data }),
			})

			if (!response.ok) {
				const error = await response.json().catch(() => ({ error: 'Emit failed' }))
				throw new Error(typeof error.error === 'string' ? error.error : 'Emit failed')
			}

			const result = (await response.json()) as { id: string }
			return result.id
		},
		[platformUrl, appId, channel]
	)

	// Clear messages
	const clear = useCallback(() => {
		setMessages([])
		lastAckRef.current = '0'
	}, [])

	// Effect: Connect on mount, disconnect on unmount
	useEffect(() => {
		mountedRef.current = true

		if (enabled && appId) {
			connect()
		}

		return () => {
			mountedRef.current = false
			disconnect()
		}
	}, [enabled, appId, channel, connect, disconnect]) // Reconnect when channel changes

	return {
		messages,
		status,
		emit,
		clear,
		connect,
		disconnect,
	}
}

// ============================================
// useRealtimeChannels Hook
// ============================================

/**
 * Subscribe to multiple channels at once
 *
 * @param channels - Array of channel names to subscribe to
 * @param options - Configuration options
 * @returns Combined messages, status, and control functions
 *
 * @example
 * ```tsx
 * function MultiChat({ roomIds }) {
 *   const { messages, emit, status } = useRealtimeChannels(
 *     roomIds.map(id => `chat:${id}`),
 *     {
 *       events: ['message'],
 *       history: 20,
 *     }
 *   )
 *
 *   // Messages from all channels combined
 *   return messages.map(msg => (
 *     <Message key={msg.id} channel={msg.channel} {...msg} />
 *   ))
 * }
 * ```
 */
export function useRealtimeChannels<T = unknown>(
	channels: string[],
	options: UseRealtimeChannelsOptions<T> = {}
): UseRealtimeReturn<T> {
	const {
		events,
		history,
		onConnect,
		onMessage,
		onReconnect,
		onError,
		enabled = true,
		platformUrl: customPlatformUrl,
	} = options

	const [messages, setMessages] = useState<StreamMessage<T>[]>([])
	const [statuses, setStatuses] = useState<Record<string, RealtimeStatus>>({})

	// Get platform context for API key and URL
	const platformContext = useContext(PlatformContext)
	const appId = platformContext?.appId || ''
	const platformUrl = customPlatformUrl || platformContext?.platformUrl || DEFAULT_PLATFORM_URL

	// Refs
	const lastAcksRef = useRef<Record<string, string>>({})
	const eventSourcesRef = useRef<Record<string, EventSource>>({})
	const mountedRef = useRef(true)

	// Computed overall status
	const status: RealtimeStatus = (() => {
		const statusValues = Object.values(statuses)
		if (statusValues.length === 0) return 'disconnected'
		if (statusValues.some((s) => s === 'connecting')) return 'connecting'
		if (statusValues.some((s) => s === 'reconnecting')) return 'reconnecting'
		if (statusValues.every((s) => s === 'connected')) return 'connected'
		return 'disconnected'
	})()

	// Connect to a single channel
	const connectChannel = useCallback(
		(channel: string) => {
			if (!enabled || !appId) return

			// Clean up existing
			if (eventSourcesRef.current[channel]) {
				eventSourcesRef.current[channel].close()
			}

			setStatuses((prev) => ({ ...prev, [channel]: 'connecting' }))

			const url = new URL(`${platformUrl}${SDK_API_PATH}/realtime/subscribe`)
			url.searchParams.set('channel', channel)
			url.searchParams.set('app_id', appId)

			const lastAck = lastAcksRef.current[channel]
			if (lastAck && lastAck !== '0') {
				url.searchParams.set(`last_ack_${channel}`, lastAck)
			}

			const es = new EventSource(url.toString())
			eventSourcesRef.current[channel] = es

			es.onopen = () => {
				if (!mountedRef.current) return
				setStatuses((prev) => ({ ...prev, [channel]: 'connected' }))
				onConnect?.(channel)
			}

			es.onmessage = (event) => {
				if (!mountedRef.current) return

				try {
					const data = JSON.parse(event.data) as StreamMessage<T> & { type?: string }

					if (data.type === 'connected' || data.type === 'heartbeat') return
					if (data.type === 'reconnect') {
						setStatuses((prev) => ({ ...prev, [channel]: 'reconnecting' }))
						onReconnect?.()
						es.close()
						setTimeout(() => mountedRef.current && connectChannel(channel), 100)
						return
					}

					if (events && events.length > 0 && !events.includes(data.event)) return

					setMessages((prev) => [...prev, data as StreamMessage<T>])
					lastAcksRef.current[channel] = data.id
					onMessage?.(data as StreamMessage<T>)
				} catch {
					// Ignore invalid JSON
				}
			}

			es.onerror = () => {
				if (!mountedRef.current) return
				setStatuses((prev) => ({ ...prev, [channel]: 'reconnecting' }))
				es.close()
				setTimeout(() => mountedRef.current && enabled && connectChannel(channel), 1000)
				onError?.(new Error(`SSE connection error for channel: ${channel}`))
			}
		},
		[enabled, appId, platformUrl, events, onConnect, onMessage, onReconnect, onError]
	)

	// Connect all channels
	const connect = useCallback(() => {
		channels.forEach(connectChannel)
	}, [channels, connectChannel])

	// Disconnect all
	const disconnect = useCallback(() => {
		Object.values(eventSourcesRef.current).forEach((es) => es.close())
		eventSourcesRef.current = {}
		setStatuses({})
	}, [])

	// Emit to a specific channel
	const emit = useCallback(
		async (event: string, data: T, targetChannel?: string): Promise<string> => {
			const channel = targetChannel || channels[0]
			if (!channel) throw new Error('No channel specified')

			const response = await fetch(`${platformUrl}${SDK_API_PATH}/realtime/emit`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-app-secret': appId,
				},
				body: JSON.stringify({ channel, event, data }),
			})

			if (!response.ok) {
				const error = await response.json().catch(() => ({ error: 'Emit failed' }))
				throw new Error(typeof error.error === 'string' ? error.error : 'Emit failed')
			}

			const result = (await response.json()) as { id: string }
			return result.id
		},
		[channels, platformUrl, appId]
	)

	// Clear all messages
	const clear = useCallback(() => {
		setMessages([])
		lastAcksRef.current = {}
	}, [])

	// Effect: Connect on mount
	useEffect(() => {
		mountedRef.current = true

		if (enabled && appId && channels.length > 0) {
			connect()
		}

		return () => {
			mountedRef.current = false
			disconnect()
		}
	}, [enabled, appId, channels.join(',')]) // Reconnect when channels change

	return {
		messages,
		status,
		emit: (event: string, data: T) => emit(event, data),
		clear,
		connect,
		disconnect,
	}
}
