/**
 * Platform Type Declarations
 *
 * Declares the @sylphx/platform/trpc module for TypeScript without
 * requiring an actual import. This allows the SDK to reference the
 * AppRouter type while avoiding circular dependencies during build.
 *
 * The actual types flow at runtime through the workspace protocol
 * when consumers use the SDK.
 */

// Declare the module so TypeScript knows about it
declare module '@sylphx/platform/trpc' {
	import type { AnyRouter } from '@trpc/server'

	/**
	 * The platform's tRPC router type.
	 * This is a placeholder - the actual type is inferred at the consumer level.
	 */
	export type AppRouter = AnyRouter
}
