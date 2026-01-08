'use client'

/**
 * tRPC React Client
 *
 * Creates the tRPC React hooks for client components.
 * Uses React Query for caching and state management.
 */

import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '@/server/routers'

/**
 * tRPC React hooks
 * Use these in client components to call tRPC procedures
 *
 * @example
 * const { data, isLoading } = trpc.games.getDailyStatus.useQuery({ gameSlug: 'wordle' })
 * const mutation = trpc.games.saveResult.useMutation()
 */
export const trpc = createTRPCReact<AppRouter>()
