/**
 * Webhooks Hooks
 *
 * React hooks for Sylphx Platform webhooks service.
 * Configure webhooks, view deliveries, and replay failed attempts.
 *
 * ## React Query Integration
 *
 * All hooks use React Query for:
 * - Automatic caching and deduplication
 * - Stale-while-revalidate updates
 * - Background refetching with refetchInterval
 * - Infinite query for paginated deliveries
 */

'use client'

import { useCallback } from 'react'
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useWebhooksContext } from './services-context'
import type {
	WebhookEnvironment,
	WebhookDelivery,
	WebhookDeliveryStatus,
	WebhookStats,
	WebhookStatsPeriod,
} from '../types'

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
	const queryClient = useQueryClient()

	// React Query for webhook config
	const configQuery = useQuery({
		queryKey: ['sylphx', 'webhooks', 'config'],
		queryFn: () => ctx.getConfig(),
		staleTime: 30 * 1000, // 30s - admin configures webhooks
	})

	const config = configQuery.data

	// Update config
	const updateConfig = useCallback(
		async (options: {
			environmentId: string
			webhookUrl: string | null
			regenerateSecret?: boolean
		}) => {
			const result = await ctx.updateConfig(options)
			// Invalidate to get updated state
			await queryClient.invalidateQueries({
				queryKey: ['sylphx', 'webhooks', 'config'],
			})
			return result
		},
		[ctx, queryClient]
	)

	// Refresh via React Query invalidation
	const refresh = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: ['sylphx', 'webhooks', 'config'],
		})
	}, [queryClient])

	return {
		environments: config?.environments ?? [],
		supportedEvents: config?.supportedEvents ?? [],
		isLoading: configQuery.isLoading,
		error: configQuery.error as Error | null,
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
	/** Number of deliveries to fetch per page */
	limit?: number
	/** Whether to skip initial fetch */
	skip?: boolean
	/** Refetch interval in ms (uses React Query's refetchInterval) */
	refetchInterval?: number
}

export interface UseWebhookDeliveriesReturn {
	/** Webhook deliveries (all loaded pages) */
	deliveries: WebhookDelivery[]
	/** Total count of matching deliveries */
	total: number
	/** Whether deliveries are loading */
	isLoading: boolean
	/** Whether fetching next page */
	isFetchingNextPage: boolean
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
 * Uses React Query's useInfiniteQuery for efficient pagination.
 *
 * @example
 * ```tsx
 * function WebhookDeliveries() {
 *   const { deliveries, isLoading, replay, refresh, loadMore, hasMore } = useWebhookDeliveries({
 *     status: 'failed',
 *     limit: 50,
 *     refetchInterval: 30000, // Auto-refresh every 30s
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
 *       {hasMore && (
 *         <button onClick={loadMore}>Load More</button>
 *       )}
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
	const queryClient = useQueryClient()

	// React Query infinite query for paginated deliveries
	const deliveriesQuery = useInfiniteQuery({
		queryKey: ['sylphx', 'webhooks', 'deliveries', { status, event, limit }],
		queryFn: async ({ pageParam = 0 }) => {
			return ctx.getDeliveries({ status, event, limit, offset: pageParam })
		},
		initialPageParam: 0,
		getNextPageParam: (lastPage, allPages) => {
			const loadedCount = allPages.reduce((sum, page) => sum + page.deliveries.length, 0)
			if (loadedCount >= lastPage.total) {
				return undefined // No more pages
			}
			return loadedCount // Next offset
		},
		enabled: !skip,
		staleTime: 30 * 1000, // 30 sec - deliveries change moderately
		refetchInterval: refetchInterval ?? false,
	})

	// Flatten all pages into single deliveries array
	const deliveries = deliveriesQuery.data?.pages.flatMap((page) => page.deliveries) ?? []
	const total = deliveriesQuery.data?.pages[0]?.total ?? 0

	// Replay delivery
	const replay = useCallback(
		async (deliveryId: string): Promise<{ success: boolean; newDeliveryId?: string }> => {
			const result = await ctx.replayDelivery(deliveryId)
			// Invalidate to get updated status
			await queryClient.invalidateQueries({
				queryKey: ['sylphx', 'webhooks', 'deliveries'],
			})
			return result
		},
		[ctx, queryClient]
	)

	// Refresh via React Query invalidation
	const refresh = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: ['sylphx', 'webhooks', 'deliveries'],
		})
	}, [queryClient])

	// Load more via fetchNextPage
	const loadMore = useCallback(async () => {
		if (deliveriesQuery.hasNextPage && !deliveriesQuery.isFetchingNextPage) {
			await deliveriesQuery.fetchNextPage()
		}
	}, [deliveriesQuery])

	return {
		deliveries,
		total,
		isLoading: deliveriesQuery.isLoading,
		isFetchingNextPage: deliveriesQuery.isFetchingNextPage,
		error: deliveriesQuery.error as Error | null,
		replay,
		refresh,
		loadMore,
		hasMore: deliveriesQuery.hasNextPage ?? false,
	}
}

// ============================================
// useWebhookStats
// ============================================

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
export function useWebhookStats(period: WebhookStatsPeriod = 'week'): UseWebhookStatsReturn {
	const ctx = useWebhooksContext()
	const queryClient = useQueryClient()

	// React Query for webhook stats
	const statsQuery = useQuery({
		queryKey: ['sylphx', 'webhooks', 'stats', period],
		queryFn: () => ctx.getStats(period),
		staleTime: 60 * 1000, // 1 min - stats aggregate data
	})

	// Refresh via React Query invalidation
	const refresh = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: ['sylphx', 'webhooks', 'stats', period],
		})
	}, [queryClient, period])

	return {
		stats: statsQuery.data ?? null,
		isLoading: statsQuery.isLoading,
		error: statsQuery.error as Error | null,
		refresh,
	}
}
