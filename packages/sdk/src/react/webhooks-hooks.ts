/**
 * Webhooks Hooks
 *
 * React hooks for Sylphx Platform webhooks service.
 * Configure webhooks, view deliveries, and replay failed attempts.
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import {
	useWebhooksContext,
	type WebhookEnvironment,
	type WebhookDelivery,
	type WebhookDeliveryStatus,
	type StatsPeriod,
} from './services-context'

// Re-export types for convenience
export type { WebhookEnvironment, WebhookDelivery, WebhookDeliveryStatus, StatsPeriod, WebhookStats }

// ============================================
// useWebhooks
// ============================================

export interface UseWebhooksReturn {
	/** Webhook configuration by environment */
	environments: WebhookEnvironment[]
	/** Supported event types */
	supportedEvents: string[]
	/** Whether config is loading */
	isLoading: boolean
	/** Last error */
	error: Error | null
	/** Update webhook config for an environment */
	updateConfig: (options: {
		environmentId: string
		webhookUrl: string | null
		regenerateSecret?: boolean
	}) => Promise<{
		success: boolean
		webhookUrl: string | null
		secretGenerated: boolean
		webhookSecret?: string
	}>
	/** Refresh the configuration */
	refresh: () => Promise<void>
}

/**
 * Hook for managing webhook configuration
 *
 * @example
 * ```tsx
 * function WebhookConfig() {
 *   const {
 *     environments,
 *     supportedEvents,
 *     updateConfig,
 *     isLoading,
 *   } = useWebhooks()
 *
 *   const handleUpdate = async (envId: string, url: string) => {
 *     const result = await updateConfig({
 *       environmentId: envId,
 *       webhookUrl: url,
 *       regenerateSecret: true,
 *     })
 *     if (result.webhookSecret) {
 *       alert(`New secret: ${result.webhookSecret}`)
 *     }
 *   }
 *
 *   return (
 *     <div>
 *       {environments.map(env => (
 *         <div key={env.id}>
 *           <h3>{env.name}</h3>
 *           <input
 *             defaultValue={env.webhookUrl ?? ''}
 *             onBlur={(e) => handleUpdate(env.id, e.target.value)}
 *           />
 *         </div>
 *       ))}
 *     </div>
 *   )
 * }
 * ```
 */
export function useWebhooks(): UseWebhooksReturn {
	const ctx = useWebhooksContext()
	const [environments, setEnvironments] = useState<WebhookEnvironment[]>([])
	const [supportedEvents, setSupportedEvents] = useState<string[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<Error | null>(null)

	const refresh = useCallback(async () => {
		setIsLoading(true)
		setError(null)

		try {
			const config = await ctx.getConfig()
			setEnvironments(config.environments)
			setSupportedEvents(config.supportedEvents ?? [])
		} catch (err) {
			const error = err instanceof Error ? err : new Error('Failed to fetch webhook config')
			setError(error)
		} finally {
			setIsLoading(false)
		}
	}, [ctx])

	// Initial fetch
	useEffect(() => {
		refresh()
	}, [refresh])

	const updateConfig = useCallback(
		async (options: {
			environmentId: string
			webhookUrl: string | null
			regenerateSecret?: boolean
		}) => {
			setError(null)

			try {
				const result = await ctx.updateConfig(options)
				// Refresh to get updated state
				await refresh()
				return result
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Failed to update webhook config')
				setError(error)
				throw error
			}
		},
		[ctx, refresh]
	)

	return {
		environments,
		supportedEvents,
		isLoading,
		error,
		updateConfig,
		refresh,
	}
}

// ============================================
// useWebhookDeliveries
// ============================================

export interface UseWebhookDeliveriesOptions {
	/** Filter by status */
	status?: WebhookDeliveryStatus
	/** Filter by event type */
	event?: string
	/** Number of deliveries to fetch */
	limit?: number
	/** Whether to skip initial fetch */
	skip?: boolean
	/** Refetch interval in ms */
	refetchInterval?: number
}

export interface UseWebhookDeliveriesReturn {
	/** Webhook deliveries */
	deliveries: WebhookDelivery[]
	/** Total count of matching deliveries */
	total: number
	/** Whether deliveries are loading */
	isLoading: boolean
	/** Last error */
	error: Error | null
	/** Replay a delivery */
	replay: (deliveryId: string) => Promise<{ success: boolean; newDeliveryId?: string }>
	/** Refresh deliveries */
	refresh: () => Promise<void>
	/** Load more deliveries */
	loadMore: () => Promise<void>
	/** Whether there are more deliveries to load */
	hasMore: boolean
}

/**
 * Hook for viewing webhook delivery history
 *
 * @example
 * ```tsx
 * function WebhookDeliveries() {
 *   const { deliveries, isLoading, replay, refresh } = useWebhookDeliveries({
 *     status: 'failed',
 *     limit: 50,
 *   })
 *
 *   return (
 *     <div>
 *       <button onClick={refresh}>Refresh</button>
 *       <table>
 *         <thead>
 *           <tr>
 *             <th>Event</th>
 *             <th>Status</th>
 *             <th>Actions</th>
 *           </tr>
 *         </thead>
 *         <tbody>
 *           {deliveries.map(delivery => (
 *             <tr key={delivery.id}>
 *               <td>{delivery.event}</td>
 *               <td>{delivery.status}</td>
 *               <td>
 *                 {delivery.status === 'failed' && (
 *                   <button onClick={() => replay(delivery.id)}>Retry</button>
 *                 )}
 *               </td>
 *             </tr>
 *           ))}
 *         </tbody>
 *       </table>
 *     </div>
 *   )
 * }
 * ```
 */
export function useWebhookDeliveries(
	options: UseWebhookDeliveriesOptions = {}
): UseWebhookDeliveriesReturn {
	const { status, event, limit = 50, skip = false, refetchInterval } = options
	const ctx = useWebhooksContext()
	const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([])
	const [total, setTotal] = useState(0)
	const [isLoading, setIsLoading] = useState(!skip)
	const [error, setError] = useState<Error | null>(null)
	const [offset, setOffset] = useState(0)

	const refresh = useCallback(async () => {
		setIsLoading(true)
		setError(null)
		setOffset(0)

		try {
			const result = await ctx.getDeliveries({ status, event, limit, offset: 0 })
			setDeliveries(result.deliveries)
			setTotal(result.total)
		} catch (err) {
			const error = err instanceof Error ? err : new Error('Failed to fetch deliveries')
			setError(error)
		} finally {
			setIsLoading(false)
		}
	}, [ctx, status, event, limit])

	const loadMore = useCallback(async () => {
		if (isLoading || deliveries.length >= total) return

		setIsLoading(true)
		setError(null)

		try {
			const newOffset = offset + limit
			const result = await ctx.getDeliveries({ status, event, limit, offset: newOffset })
			setDeliveries((prev) => [...prev, ...result.deliveries])
			setOffset(newOffset)
		} catch (err) {
			const error = err instanceof Error ? err : new Error('Failed to load more deliveries')
			setError(error)
		} finally {
			setIsLoading(false)
		}
	}, [ctx, status, event, limit, offset, isLoading, deliveries.length, total])

	// Initial fetch
	useEffect(() => {
		if (!skip) {
			refresh()
		}
	}, [skip, refresh])

	// Refetch interval
	useEffect(() => {
		if (refetchInterval && refetchInterval > 0) {
			const interval = setInterval(refresh, refetchInterval)
			return () => clearInterval(interval)
		}
	}, [refetchInterval, refresh])

	const replay = useCallback(
		async (deliveryId: string): Promise<{ success: boolean; newDeliveryId?: string }> => {
			setError(null)

			try {
				const result = await ctx.replayDelivery(deliveryId)
				// Refresh to get updated status
				await refresh()
				return result
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Failed to replay delivery')
				setError(error)
				throw error
			}
		},
		[ctx, refresh]
	)

	return {
		deliveries,
		total,
		isLoading,
		error,
		replay,
		refresh,
		loadMore,
		hasMore: deliveries.length < total,
	}
}

// ============================================
// useWebhookStats
// ============================================

// WebhookStats is imported from services-context (SSOT: webhooks.ts)
import type { WebhookStats } from './services-context'

export interface UseWebhookStatsReturn {
	/** Webhook statistics */
	stats: WebhookStats | null
	/** Whether stats are loading */
	isLoading: boolean
	/** Last error */
	error: Error | null
	/** Refresh stats */
	refresh: () => Promise<void>
}

/**
 * Hook for webhook delivery statistics
 *
 * @example
 * ```tsx
 * function WebhookDashboard() {
 *   const { stats, isLoading, refresh } = useWebhookStats('week')
 *
 *   if (isLoading) return <Spinner />
 *
 *   return (
 *     <div>
 *       <p>Delivery Rate: {stats?.totals.deliveryRate}</p>
 *       <p>Total: {stats?.totals.total}</p>
 *       <button onClick={refresh}>Refresh</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useWebhookStats(
	period: StatsPeriod = 'week'
): UseWebhookStatsReturn {
	const ctx = useWebhooksContext()
	const [stats, setStats] = useState<WebhookStats | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<Error | null>(null)

	const refresh = useCallback(async () => {
		setIsLoading(true)
		setError(null)

		try {
			const result = await ctx.getStats(period)
			setStats(result)
		} catch (err) {
			const error = err instanceof Error ? err : new Error('Failed to fetch webhook stats')
			setError(error)
		} finally {
			setIsLoading(false)
		}
	}, [ctx, period])

	// Initial fetch
	useEffect(() => {
		refresh()
	}, [refresh])

	return {
		stats,
		isLoading,
		error,
		refresh,
	}
}
