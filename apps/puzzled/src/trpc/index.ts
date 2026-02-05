/**
 * API Client Exports
 *
 * Re-exports from the React Query based API module.
 * This file provides backwards compatibility for existing imports from '@/trpc'.
 *
 * For server-side usage (RSC, Server Actions), import from '@/lib/api/server' directly.
 */

// Provider for wrapping the app (React Query based provider)
export { ApiProvider as TRPCProvider } from '@/lib/api/provider'

// Re-export all hooks for client-side usage
export * from '@/lib/api/hooks'

// Re-export the API client
export { api } from '@/lib/api/client'

// Re-export server-side API creator
export { createServerApi } from '@/lib/api/server'
