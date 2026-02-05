/**
 * Puzzled API v1 Catch-All Route Handler
 *
 * Routes all /api/v1/* requests to the Hono app.
 * Exports HTTP method handlers for Next.js App Router.
 */

import { handle } from 'hono/vercel'
import { app } from '@/server/api/app'

// Export handlers for all HTTP methods
export const GET = handle(app)
export const POST = handle(app)
export const PUT = handle(app)
export const PATCH = handle(app)
export const DELETE = handle(app)
export const OPTIONS = handle(app)
