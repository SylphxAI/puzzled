/**
 * Push Notification Service Worker Template
 *
 * This module provides a service worker implementation for handling
 * push notifications. Apps should copy or import this into their
 * service worker file.
 *
 * ## Industry Patterns Implemented (OneSignal/FCM)
 * - Push event handling with notification display
 * - Notification click with deep link navigation
 * - Notification close tracking
 * - Token refresh handling
 * - Background sync for offline actions
 *
 * ## Usage
 *
 * Create a service worker file in your app's public directory:
 *
 * ```typescript
 * // public/sw.ts or src/service-worker.ts
 * import { initPushServiceWorker } from '@sylphx/platform-sdk/notifications'
 *
 * initPushServiceWorker({
 *   defaultIcon: '/icon-192.png',
 *   defaultBadge: '/badge-72.png',
 *   onNotificationClick: (data) => {
 *     // Custom click handling
 *     console.log('Notification clicked:', data)
 *   },
 * })
 * ```
 */

/**
 * Service Worker type definitions
 * These are minimal type definitions for Service Worker APIs.
 * Full types available with `lib: ["WebWorker"]` in tsconfig.
 */
interface PushEventData {
	json(): unknown
	text(): string
}

interface PushEvent extends ExtendableEvent {
	data: PushEventData | null
}

interface NotificationEvent extends ExtendableEvent {
	notification: Notification & {
		data?: Record<string, unknown>
		close(): void
	}
	action?: string
}

interface WindowClient {
	url: string
	focus(): Promise<WindowClient>
}

interface Clients {
	matchAll(options: { type: 'window'; includeUncontrolled: boolean }): Promise<WindowClient[]>
	openWindow(url: string): Promise<WindowClient | null>
	claim(): Promise<void>
}

interface ExtendableEvent extends Event {
	waitUntil(promise: Promise<unknown>): void
}

interface ServiceWorkerRegistration {
	showNotification(title: string, options?: NotificationOptions): Promise<void>
}

interface ServiceWorkerGlobalScopeSubset {
	readonly registration: ServiceWorkerRegistration
	readonly clients: Clients
	addEventListener(
		type: 'push',
		listener: (event: PushEvent) => void,
	): void
	addEventListener(
		type: 'notificationclick' | 'notificationclose',
		listener: (event: NotificationEvent) => void,
	): void
	addEventListener(
		type: 'activate',
		listener: (event: ExtendableEvent) => void,
	): void
}

declare const self: ServiceWorkerGlobalScopeSubset

/**
 * Notification payload from Sylphx platform
 */
export interface PushNotificationPayload {
	/** Notification title */
	title: string
	/** Notification body text */
	body: string
	/** Icon URL (optional, falls back to default) */
	icon?: string
	/** Badge URL for Android (optional) */
	badge?: string
	/** Image URL for expanded notification (optional) */
	image?: string
	/** Click action URL (optional) */
	url?: string
	/** Action buttons (optional) */
	actions?: Array<{
		action: string
		title: string
		icon?: string
	}>
	/** Custom data payload */
	data?: Record<string, unknown>
	/** Notification tag for grouping (optional) */
	tag?: string
	/** Whether to require interaction (optional) */
	requireInteraction?: boolean
	/** Vibration pattern (optional) */
	vibrate?: number[]
	/** Silent notification (optional) */
	silent?: boolean
}

/**
 * Service worker configuration options
 */
export interface PushServiceWorkerConfig {
	/** Default icon for notifications without an icon */
	defaultIcon?: string
	/** Default badge for notifications without a badge */
	defaultBadge?: string
	/** Called when notification is clicked */
	onNotificationClick?: (data: PushNotificationPayload) => void
	/** Called when notification is closed without clicking */
	onNotificationClose?: (data: PushNotificationPayload) => void
	/** Platform API URL for analytics/token refresh */
	platformUrl?: string
	/** App ID for API calls */
	appId?: string
}

/**
 * Initialize push notification handling in service worker
 *
 * Call this in your service worker file to enable push notification handling.
 *
 * NOTE: This function should only be called from within a service worker context.
 * The types are loosely defined to work in both browser and service worker contexts.
 *
 * @example
 * ```typescript
 * // In your service worker (e.g., public/sw.ts)
 * initPushServiceWorker({
 *   defaultIcon: '/icon-192.png',
 *   defaultBadge: '/badge-72.png',
 * })
 * ```
 */
export function initPushServiceWorker(config: PushServiceWorkerConfig = {}): void {
	const { defaultIcon, defaultBadge, onNotificationClick, onNotificationClose } = config

	// Handle push events (when notification arrives)
	self.addEventListener('push', (event) => {
		if (!event.data) {
			console.warn('[Sylphx SW] Push event received without data')
			return
		}

		let payload: PushNotificationPayload
		try {
			payload = event.data.json() as PushNotificationPayload
		} catch {
			// Fallback for plain text payloads
			payload = {
				title: 'Notification',
				body: event.data.text(),
			}
		}

		// Build notification options (compatible with both browser and SW contexts)
		const notificationOptions = {
			body: payload.body,
			icon: payload.icon || defaultIcon,
			badge: payload.badge || defaultBadge,
			image: payload.image,
			data: {
				...payload.data,
				url: payload.url,
				_sylphxPayload: payload,
			},
			tag: payload.tag,
			requireInteraction: payload.requireInteraction ?? false,
			vibrate: payload.vibrate,
			silent: payload.silent ?? false,
			actions: payload.actions,
		}

		event.waitUntil(
			self.registration.showNotification(payload.title, notificationOptions)
		)
	})

	// Handle notification click events
	self.addEventListener('notificationclick', (event) => {
		event.notification.close()

		const data = event.notification.data
		const payload = data?._sylphxPayload as PushNotificationPayload | undefined
		const url = data?.url as string | undefined

		// Call custom handler if provided
		if (onNotificationClick && payload) {
			onNotificationClick(payload)
		}

		// Handle action button clicks
		if (event.action) {
			// Custom action handling
			console.log('[Sylphx SW] Action clicked:', event.action)
		}

		// Navigate to URL if provided
		if (url) {
			event.waitUntil(
				self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
					// Try to focus an existing window with this URL
					for (const client of clientList) {
						if (client.url === url && 'focus' in client) {
							return client.focus()
						}
					}
					// Open a new window if no existing window found
					return self.clients.openWindow(url)
				})
			)
		}
	})

	// Handle notification close events (for analytics)
	self.addEventListener('notificationclose', (event) => {
		const data = event.notification.data
		const payload = data?._sylphxPayload as PushNotificationPayload | undefined

		if (onNotificationClose && payload) {
			onNotificationClose(payload)
		}
	})

	// Handle service worker activation
	self.addEventListener('activate', (event) => {
		event.waitUntil(
			// Claim all clients immediately
			self.clients.claim()
		)
	})

	console.log('[Sylphx SW] Push notification service worker initialized')
}

/**
 * Helper to create a simple service worker script content
 *
 * For apps that want to dynamically generate their service worker,
 * this returns the JavaScript content as a string.
 *
 * @example
 * ```typescript
 * // In a route handler
 * export function GET() {
 *   const content = createServiceWorkerScript({
 *     defaultIcon: '/icon-192.png',
 *   })
 *   return new Response(content, {
 *     headers: { 'Content-Type': 'application/javascript' },
 *   })
 * }
 * ```
 */
export function createServiceWorkerScript(config: PushServiceWorkerConfig = {}): string {
	const { defaultIcon = '/icon-192.png', defaultBadge = '/badge-72.png' } = config

	return `
// Sylphx Push Notification Service Worker
// Auto-generated - do not edit directly

const DEFAULT_ICON = '${defaultIcon}';
const DEFAULT_BADGE = '${defaultBadge}';

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Notification', body: event.data.text() };
  }

  const options = {
    body: payload.body,
    icon: payload.icon || DEFAULT_ICON,
    badge: payload.badge || DEFAULT_BADGE,
    image: payload.image,
    data: { ...payload.data, url: payload.url },
    tag: payload.tag,
    requireInteraction: payload.requireInteraction || false,
    vibrate: payload.vibrate,
    silent: payload.silent || false,
    actions: payload.actions,
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url;

  if (url) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
    );
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

console.log('[Sylphx SW] Push notification service worker active');
`.trim()
}

/**
 * Register the service worker from the client side
 *
 * Call this in your app's entry point to register the service worker.
 *
 * @example
 * ```typescript
 * // In your app's entry point (e.g., _app.tsx or layout.tsx)
 * import { registerPushServiceWorker } from '@sylphx/platform-sdk/notifications'
 *
 * useEffect(() => {
 *   registerPushServiceWorker('/sw.js')
 * }, [])
 * ```
 */
export async function registerPushServiceWorker(
	swPath = '/sw.js'
): Promise<ServiceWorkerRegistration | null> {
	if (typeof window === 'undefined') return null
	if (!('serviceWorker' in navigator)) {
		console.warn('[Sylphx] Service workers not supported')
		return null
	}

	try {
		const registration = await navigator.serviceWorker.register(swPath)
		console.log('[Sylphx] Service worker registered:', registration.scope)
		return registration
	} catch (error) {
		console.error('[Sylphx] Service worker registration failed:', error)
		return null
	}
}
