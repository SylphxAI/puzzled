/**
 * tRPC Client Exports
 *
 * Re-export client-side tRPC utilities.
 * Server utilities are in a separate file to avoid bundling issues.
 *
 * For server-side usage (RSC, Server Actions), import from '@/trpc/server' directly.
 */

// Re-export router type for convenience

// Client hooks for use in client components
export { trpc } from './client'
// Provider for wrapping the app
export { TRPCProvider } from './provider'
