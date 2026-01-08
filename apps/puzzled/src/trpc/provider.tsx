'use client'

/**
 * tRPC Provider
 *
 * Wraps the app with React Query and tRPC providers.
 * Must be used in a client component that wraps the app.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink, loggerLink } from '@trpc/client'
import { useState } from 'react'
import superjson from 'superjson'
import { getBaseUrl } from '@/lib/utils'
import { trpc } from './client'

/**
 * Create React Query client with optimized defaults
 */
function makeQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				// With SSR, we usually want to set some default staleTime
				// above 0 to avoid refetching immediately on the client
				staleTime: 60 * 1000, // 1 minute
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
 * tRPC Provider Component
 *
 * Provides tRPC client and React Query to the app.
 * Wrap your app with this provider in the root layout.
 *
 * @example
 * <TRPCProvider>
 *   <App />
 * </TRPCProvider>
 */
export function TRPCProvider({ children }: Props) {
	const queryClient = getQueryClient()

	const [trpcClient] = useState(() =>
		trpc.createClient({
			links: [
				// Log requests in development
				loggerLink({
					enabled: (op) =>
						process.env.NODE_ENV === 'development' ||
						(op.direction === 'down' && op.result instanceof Error),
				}),
				// Batch HTTP requests for better performance
				httpBatchLink({
					url: `${getBaseUrl()}/api/trpc`,
					transformer: superjson,
					// Add headers for auth
					headers() {
						return {
							// Cookies are automatically included
						}
					},
				}),
			],
		}),
	)

	return (
		<trpc.Provider client={trpcClient} queryClient={queryClient}>
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		</trpc.Provider>
	)
}
