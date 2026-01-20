/**
 * @sylphx/api - Internal API Type Bridge
 *
 * This file bridges the SDK to Platform's tRPC types using TypeScript path aliases.
 * The path aliases are defined in this package's tsconfig.json.
 *
 * Architecture:
 * - Platform defines AppRouter in src/server/routers/_app.ts
 * - This file re-exports that type for SDK internal use
 * - SDK consumers import from this package's public exports
 *
 * This is the correct TypeScript pattern for monorepo type sharing:
 * - No runtime dependency on Platform
 * - Full type inference preserved
 * - Clean public API for SDK consumers
 */

// Re-export Platform's AppRouter type
// Path alias resolved via tsconfig: @sylphx/platform/trpc -> ../../apps/sylphx/src/server/routers/_app.ts
export type { AppRouter } from '@sylphx/platform/trpc'
