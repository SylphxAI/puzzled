import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { CacheFirst, ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist } from 'serwist'

// This declares the value of `injectionPoint` to TypeScript.
// `injectionPoint` is the string that will be replaced by the
// actual precache manifest. By default, this string is set to
// `self.__SW_MANIFEST`.
declare global {
	interface WorkerGlobalScope extends SerwistGlobalConfig {
		__SW_MANIFEST: (PrecacheEntry | string)[] | undefined
	}
}

declare const self: ServiceWorkerGlobalScope

// Custom caching strategies for game assets with expiration
const gameAssetCache = new CacheFirst({
	cacheName: 'game-assets-v1',
	plugins: [
		new ExpirationPlugin({
			maxEntries: 100, // Max 100 cached assets
			maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
			purgeOnQuotaError: true, // Clear cache if quota exceeded
		}),
	],
})

// SECURITY: APIs that MUST NEVER be cached (personalized, authenticated, tokens)
const NEVER_CACHE_PATHS = [
	'/api/auth', // Authentication endpoints
	'/api/trpc', // tRPC endpoints (user-specific data)
	'/api/webhooks', // Webhook handlers
	'/api/admin', // Admin endpoints
	'/api/push', // Push subscription endpoints (user-specific)
	'/api/cron', // Cron job endpoints (server-to-server)
	'/api/workflow', // Workflow endpoints (server-to-server)
]

/**
 * Check if a URL path should NEVER be cached
 * Per spec: "Never cache personalized content, tokens"
 */
function isNeverCachePath(pathname: string): boolean {
	return NEVER_CACHE_PATHS.some((path) => pathname.startsWith(path))
}

// Public API cache (only for truly public, non-personalized data)
const publicApiCache = new NetworkFirst({
	cacheName: 'public-api-cache-v1',
	networkTimeoutSeconds: 10,
	plugins: [
		new ExpirationPlugin({
			maxEntries: 50, // Max 50 cached API responses
			maxAgeSeconds: 60 * 60, // 1 hour
			purgeOnQuotaError: true,
		}),
	],
})

const serwist = new Serwist({
	precacheEntries: self.__SW_MANIFEST,
	skipWaiting: true,
	clientsClaim: true,
	navigationPreload: true,
	runtimeCaching: [
		// SECURITY: Never cache auth, tRPC, webhooks, or admin APIs
		{
			matcher: ({ url }) => isNeverCachePath(url.pathname),
			handler: new NetworkOnly(),
		},
		// Cache game page shells with network-first strategy
		{
			matcher: ({ request, url }) =>
				request.destination === 'document' && url.pathname.includes('/games/'),
			handler: new NetworkFirst({
				cacheName: 'game-pages-v1',
				networkTimeoutSeconds: 5,
				plugins: [
					new ExpirationPlugin({
						maxEntries: 20, // Max 20 game pages
						maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
						purgeOnQuotaError: true,
					}),
				],
			}),
		},
		// Cache static game assets (icons, images) with cache-first
		{
			matcher: ({ request }) => request.destination === 'image' || request.destination === 'font',
			handler: gameAssetCache,
		},
		// Cache ONLY public API responses (non-personalized)
		// This excludes auth, tRPC, webhooks, admin (handled above)
		{
			matcher: ({ url }) => url.pathname.startsWith('/api/') && !isNeverCachePath(url.pathname),
			handler: publicApiCache,
		},
		// Default caching for everything else
		...defaultCache,
	],
	// Offline fallback
	fallbacks: {
		entries: [
			{
				url: '/offline',
				matcher: ({ request }) => request.destination === 'document',
			},
		],
	},
})

serwist.addEventListeners()

// ==================
// Push Notifications
// ==================

self.addEventListener('push', (event) => {
	if (!event.data) return

	const data = event.data.json() as {
		title: string
		body: string
		icon?: string
		badge?: string
		url?: string
		tag?: string
	}

	const options: NotificationOptions = {
		body: data.body,
		icon: data.icon || '/icons/icon-192.png',
		badge: data.badge || '/icons/icon-96.png',
		tag: data.tag || 'puzzled',
		data: { url: data.url || '/' },
		requireInteraction: false,
	}

	event.waitUntil(self.registration.showNotification(data.title, options))
})

self.addEventListener('notificationclick', (event) => {
	event.notification.close()

	const url = (event.notification.data?.url as string) || '/'

	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
			// Try to focus an existing window
			for (const client of clients) {
				if (client.url === url && 'focus' in client) {
					return client.focus()
				}
			}
			// Open new window if no existing one
			if (self.clients.openWindow) {
				return self.clients.openWindow(url)
			}
		}),
	)
})
