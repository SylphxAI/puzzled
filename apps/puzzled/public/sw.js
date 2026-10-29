// Never cache puzzle RPCs, account pages or credentials. The network remains
// authoritative for the product day and accepted finishes.
// Only this public, self-contained document is cached — never visited pages.
const OFFLINE_CACHE = 'puzzled-offline-v1'
const OFFLINE_URL = '/offline.html'
self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(OFFLINE_CACHE).then(async (cache) => {
			await cache.add(new Request(OFFLINE_URL, { cache: 'reload', credentials: 'omit' }))
			await self.skipWaiting()
		}),
	)
})
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then(async (keys) => {
			await Promise.all(
				keys
					.filter((key) => key.startsWith('puzzled-offline-') && key !== OFFLINE_CACHE)
					.map((key) => caches.delete(key)),
			)
			await self.clients.claim()
		}),
	)
})
self.addEventListener('fetch', (event) => {
	if (event.request.mode !== 'navigate' || event.request.method !== 'GET') return
	if (new URL(event.request.url).origin !== self.location.origin) return

	event.respondWith(
		fetch(event.request).catch(async () => {
			const cache = await caches.open(OFFLINE_CACHE)
			return (await cache.match(OFFLINE_URL)) || Response.error()
		}),
	)
})
self.addEventListener('push', (event) => {
	if (!event.data) return
	let payload
	try {
		payload = event.data.json()
	} catch {
		return
	}
	event.waitUntil(
		self.registration.showNotification(payload.title || 'Puzzled', {
			body: payload.body || '',
			icon: '/icons/icon-192.png',
			badge: '/icons/icon-96.png',
			tag: 'daily-puzzle',
			data: { url: payload.url || '/' },
		}),
	)
})
self.addEventListener('notificationclick', (event) => {
	event.notification.close()
	const target = new URL(event.notification.data?.url || '/', self.location.origin)
	if (target.origin !== self.location.origin) return
	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
			for (const client of windows) {
				if (new URL(client.url).origin === target.origin) {
					await client.navigate(target.href)
					return client.focus()
				}
			}
			return self.clients.openWindow(target.href)
		}),
	)
})
