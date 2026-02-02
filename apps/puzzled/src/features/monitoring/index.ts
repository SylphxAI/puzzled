/**
 * Monitoring Feature
 *
 * Session replay and error tracking for debugging and UX analysis.
 *
 * Features:
 * - Session replay with automatic PII detection
 * - Error correlation for debugging
 * - Rage/dead click detection for UX insights
 * - Consent-aware recording (respects analytics consent)
 *
 * @example
 * ```tsx
 * // In your app layout
 * import { SessionReplayProvider } from '@/features/monitoring'
 *
 * function Layout({ children }) {
 *   return (
 *     <SessionReplayProvider>
 *       {children}
 *     </SessionReplayProvider>
 *   )
 * }
 *
 * // In error boundaries
 * import { useSessionReplayError } from '@/features/monitoring'
 *
 * function ErrorBoundary({ children }) {
 *   const { markError } = useSessionReplayError()
 *   // ...
 * }
 * ```
 */

// ============================================
// Components
// ============================================

export { SessionReplayProvider, GlobalErrorHandler } from './components'

// ============================================
// Hooks
// ============================================

// ============================================
// Configuration
// ============================================
