/**
 * Puzzled Hono App
 *
 * Main entry point for all Puzzled API routes.
 * Uses Hono with zod-openapi for type-safe, self-documenting APIs.
 *
 * Authentication uses Sylphx Platform SDK (100% dogfooding).
 */

import { OpenAPIHono } from '@hono/zod-openapi'
import { headers } from 'next/headers'
import { errorHandler, loggerMiddleware } from './middleware'
import {
	adminRoutes,
	gamificationRoutes,
	gamesRoutes,
	notificationsRoutes,
	statsRoutes,
	userRoutes,
} from './routes'
import type { PuzzledEnv } from './types'

// API version
export const API_VERSION = '1'
export const API_BASE_PATH = `/api/v${API_VERSION}`

// Create main Puzzled app with basePath
const app = new OpenAPIHono<PuzzledEnv>().basePath(API_BASE_PATH)

// ==========================================
// Global Middleware
// ==========================================

// Set headers context for all requests
app.use('*', async (c, next) => {
	const headersList = await headers()
	c.set('headers', headersList)
	await next()
})

// Logging (dev only)
app.use('*', loggerMiddleware)

// Error handling
app.use('*', errorHandler)

// ==========================================
// Health Check (no auth required)
// ==========================================

app.get('/health', (c) => {
	return c.json({
		status: 'ok',
		timestamp: new Date().toISOString(),
		version: API_VERSION,
	})
})

// ==========================================
// Route Modules
// ==========================================

app.route('/games', gamesRoutes)
app.route('/stats', statsRoutes)
app.route('/gamification', gamificationRoutes)
app.route('/user', userRoutes)
app.route('/notifications', notificationsRoutes)
app.route('/admin', adminRoutes)

// ==========================================
// OpenAPI Documentation
// ==========================================

app.doc('/openapi.json', {
	openapi: '3.0.0',
	info: {
		title: 'Puzzled API',
		version: API_VERSION,
		description: `REST API for Puzzled daily puzzle games (v${API_VERSION}). Authentication via Sylphx Platform SDK cookies.`,
	},
	servers: [
		{ url: `https://puzzled.sylphx.com${API_BASE_PATH}`, description: 'Production' },
		{ url: `http://localhost:3001${API_BASE_PATH}`, description: 'Local Development' },
	],
	security: [{ cookieAuth: [] }],
	// @ts-expect-error - openapi-types doesn't include components in DocumentBuilder
	components: {
		securitySchemes: {
			cookieAuth: {
				type: 'apiKey',
				in: 'cookie',
				name: '__sylphx_{env}_session',
				description: 'Platform authentication via SDK session cookie.',
			},
		},
	},
})

// Export for type inference with Hono Client
export type AppType = typeof app

export { app }
