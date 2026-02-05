/**
 * Puzzled API Module
 *
 * Exports API client, hooks, and provider for use throughout the app.
 */

// Client
export { api, ApiError } from './client'
export type { ApiError as ApiErrorType } from './client'

// Hooks
export * from './hooks'
export { queryKeys } from './hooks'

// Provider
export { ApiProvider } from './provider'
