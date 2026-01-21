/**
 * @sylphx/api - Internal API Type Bridge
 *
 * This file provides the AppRouter type for SDK internal use.
 *
 * Architecture:
 * - The SDK uses AnyRouter as a base type for tRPC client creation
 * - Actual type inference happens at the consumer level when they
 *   use the SDK with their platform installation
 * - This avoids circular dependencies between SDK and Platform
 */

import type { AnyRouter } from '@trpc/server'

/**
 * AppRouter type placeholder.
 *
 * The SDK uses this as a base type. Consumers get full type inference
 * through the workspace protocol when they import from @sylphx/platform/trpc.
 */
export type AppRouter = AnyRouter
