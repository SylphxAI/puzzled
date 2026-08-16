/**
 * Puzzled API module — sole Connect authority (ADR-170).
 *
 * Exports Connect-backed hooks, the error type, and the provider.
 */

export type { ApiErrorType } from './errors'
export * from './hooks'
export { ApiError } from './hooks'

// Provider
export { ApiProvider } from './provider'
