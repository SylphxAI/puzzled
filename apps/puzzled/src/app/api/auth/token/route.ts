/**
 * Token Endpoint (BFF Pattern)
 *
 * Returns the current session token for SDK cross-origin API calls.
 * The SDK client calls this endpoint to get a token for authenticated
 * requests to sylphx.com.
 *
 * Security:
 * - This endpoint reads from HttpOnly cookies (not accessible via JS)
 * - The token is returned ONLY to same-origin requests (CORS protection)
 * - Apps should NOT expose this token to third parties
 */

// Re-export the GET handler from SDK
export { GET } from '@sylphx/sdk/nextjs/api-routes'

// Force dynamic - no caching for auth tokens
export const dynamic = 'force-dynamic'
