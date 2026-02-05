'use client'

/**
 * API Provider
 *
 * Wraps the app with React Query provider.
 * React Query provider for the Hono API client.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { MINUTE_MS } from '@/lib/constants/time'

/**
 * Create React Query client with optimized defaults
 */
function makeQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				// With SSR, we usually want to set some default staleTime
				// above 0 to avoid refetching immediately on the client
				staleTime: MINUTE_MS,
				// Retry failed requests up to 3 times
				retry: 3,
				// Refetch on window focus for fresh data
				refetchOnWindowFocus: true,
			},
			mutations: {
				// Retry mutations once on failure
				retry: 1,
			},
		},
	})
}

// Singleton pattern for browser
let browserQueryClient: QueryClient | undefined

function getQueryClient() {
	if (typeof window === 'undefined') {
		// Server: always make a new query client
		return makeQueryClient()
	}
	// Browser: make a new query client if we don't already have one
	// This is very important so we don't re-make a new client
	if (!browserQueryClient) {
		browserQueryClient = makeQueryClient()
	}
	return browserQueryClient
}

type Props = {
	children: React.ReactNode
}

/**
 * API Provider Component
 *
 * Provides React Query to the app.
 * Wrap your app with this provider in the root layout.
 *
 * @example
 * <ApiProvider>
 *   <App />
 * </ApiProvider>
 */
export function ApiProvider({ children }: Props) {
	const [queryClient] = useState(() => getQueryClient())

	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

