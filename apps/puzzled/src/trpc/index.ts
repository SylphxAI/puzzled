/**
 * API Client Exports
 *
 * Re-exports from the new React Query based API module.
 * This file provides backwards compatibility for existing imports from '@/trpc'.
 *
 * For server-side usage (RSC, Server Actions), import from '@/trpc/server' directly.
 */

// Provider for wrapping the app (new React Query based provider)
export { ApiProvider as TRPCProvider } from '@/lib/api/provider'

// Re-export all hooks for client-side usage
export * from '@/lib/api/hooks'

// Re-export the API client
export { api } from '@/lib/api/client'
