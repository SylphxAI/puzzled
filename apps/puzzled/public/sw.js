// Never cache puzzle RPCs, account pages or credentials. The network remains
// authoritative for the product day and accepted finishes.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
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
