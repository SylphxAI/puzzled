/**
 * @sylphx/api - Internal API Type Bridge
 *
 * This file provides the AppRouter type for SDK internal use.
 *
 * Architecture:
 * - SDK imports AppRouter type from Platform via project references
 * - This is a TYPE-ONLY import (erased at compile time)
 * - No runtime circular dependency exists
 * - TypeScript project references handle type resolution order
 */

// Type-only import from Platform - resolved via TypeScript project references
import type { AppRouter } from '@sylphx/platform/trpc'

export type { AppRouter }
