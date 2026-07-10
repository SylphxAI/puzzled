/**
 * Puzzled Hono App
 *
 * Main entry point for all Puzzled API routes.
 * Uses Hono with zod-openapi for type-safe, self-documenting APIs.
 *
 * Authentication uses Sylphx Platform SDK (100% dogfooding).
 *
 * ARCHITECTURE:
 * - Each route module uses method chaining for proper hc type inference
 * - Routes are chained on a separate appWithRoutes for type inference
 * - OpenAPI documentation is added after routes are mounted
 */

import { OpenAPIHono } from '@hono/zod-openapi'
import { headers } from 'next/headers'
import { proxyToRustApi, shouldProxyHealthToRust } from '../rust-api-proxy'
import { errorHandler, loggerMiddleware } from './middleware'
import {
	type AdminRoutes,
	adminRoutes,
	type GamesRoutes,
	type GamificationRoutes,
	gamesRoutes,
	gamificationRoutes,
	type NotificationsRoutes,
	notificationsRoutes,
	type PuzzlesRoutes,
	puzzlesRoutes,
	type StatsRoutes,
	statsRoutes,
	type UserRoutes,
	userRoutes,
} from './routes'
import type { PuzzledEnv } from './types'

// API version
export const API_VERSION = '1'
export const API_BASE_PATH = `/api/v${API_VERSION}`

// Create base app with global middleware
const baseApp = new OpenAPIHono<PuzzledEnv>()
	.basePath(API_BASE_PATH)
	// Set headers context for all requests
	.use('*', async (c, next) => {
		const headersList = await headers()
		c.set('headers', headersList)
		await next()
	})
	// Logging (dev only)
	.use('*', loggerMiddleware)
	// Error handling
	.use('*', errorHandler)
	// Health Check (no auth required)
	// ADR-168 S2: prod routes /healthz to Rust api; local dev proxies when PUZZLED_USE_RUST_HEALTH=1.
	.get('/health', async (c) => {
		if (shouldProxyHealthToRust()) {
			return proxyToRustApi(c.req.raw, { rustPath: '/healthz' })
		}
		return c.json({
			status: 'ok',
			timestamp: new Date().toISOString(),
			version: API_VERSION,
		})
	})

// Mount route modules (chained for type inference)
const appWithRoutes = baseApp
	.route('/games', gamesRoutes)
	.route('/puzzles', puzzlesRoutes)
	.route('/stats', statsRoutes)
	.route('/gamification', gamificationRoutes)
	.route('/user', userRoutes)
	.route('/notifications', notificationsRoutes)
	.route('/admin', adminRoutes)

// Export type for hc client inference (must be from the chained app)
export type AppType = typeof appWithRoutes

// Export domain-specific route types for hc clients
export type {
	AdminRoutes,
	GamificationRoutes,
	GamesRoutes,
	NotificationsRoutes,
	PuzzlesRoutes,
	StatsRoutes,
	UserRoutes,
}

// Create the final app with OpenAPI documentation
// Note: We use a separate OpenAPIHono instance because .route() returns Hono, not OpenAPIHono
const app = new OpenAPIHono<PuzzledEnv>().basePath(API_BASE_PATH)

// Re-mount all middleware and routes on the OpenAPI app
app.use('*', async (c, next) => {
	const headersList = await headers()
	c.set('headers', headersList)
	await next()
})
app.use('*', loggerMiddleware)
app.use('*', errorHandler)
app.get('/health', async (c) => {
	if (shouldProxyHealthToRust()) {
		return proxyToRustApi(c.req.raw, { rustPath: '/healthz' })
	}
	return c.json({
		status: 'ok',
		timestamp: new Date().toISOString(),
		version: API_VERSION,
	})
})
app.route('/games', gamesRoutes)
app.route('/puzzles', puzzlesRoutes)
app.route('/stats', statsRoutes)
app.route('/gamification', gamificationRoutes)
app.route('/user', userRoutes)
app.route('/notifications', notificationsRoutes)
app.route('/admin', adminRoutes)

// OpenAPI Documentation
app.doc('/openapi.json', {
	openapi: '3.0.0',
	info: {
		title: 'Puzzled API',
		version: API_VERSION,
		description: `REST API for Puzzled daily puzzle games (v${API_VERSION}). Authentication via Sylphx Platform SDK cookies.`,
	},
	servers: [
		{
			url: `https://puzzled.sylphx.com${API_BASE_PATH}`,
			description: 'Production',
		},
		{
			url: `http://localhost:3001${API_BASE_PATH}`,
			description: 'Local Development',
		},
	],
	security: [{ cookieAuth: [] }],
})

export { app }
