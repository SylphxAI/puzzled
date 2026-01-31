/**
 * Signout Endpoint
 *
 * Signs out the current user by:
 * 1. Revoking the refresh token on the platform
 * 2. Clearing all auth cookies
 */

// Re-export the POST handler from SDK
export { POST } from '@sylphx/sdk/nextjs/api-routes'

// Force dynamic - no caching for auth operations
export const dynamic = 'force-dynamic'
