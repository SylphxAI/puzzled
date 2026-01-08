'use client'

import { useCallback, useEffect, useState } from 'react'

type PushState = 'loading' | 'unsupported' | 'denied' | 'disabled' | 'subscribed' | 'unsubscribed'

export function usePushNotifications() {
	const [state, setState] = useState<PushState>('loading')
	const [isLoading, setIsLoading] = useState(false)

	// Check initial state
	useEffect(() => {
		async function checkState() {
			// Check if browser supports push
			if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
				setState('unsupported')
				return
			}

			// Check if permission is denied
			if (Notification.permission === 'denied') {
				setState('denied')
				return
			}

			// Check if push is configured on server
			try {
				const res = await fetch('/api/push/subscribe')
				const data = await res.json()

				if (!data.enabled) {
					setState('disabled')
					return
				}

				// Check if already subscribed
				const registration = await navigator.serviceWorker.ready
				const subscription = await registration.pushManager.getSubscription()

				setState(subscription ? 'subscribed' : 'unsubscribed')
			} catch {
				setState('disabled')
			}
		}

		checkState()
	}, [])

	const subscribe = useCallback(async () => {
		if (state !== 'unsubscribed') return false

		setIsLoading(true)

		try {
			// Request notification permission
			const permission = await Notification.requestPermission()

			if (permission !== 'granted') {
				setState('denied')
				return false
			}

			// Get VAPID key from server
			const configRes = await fetch('/api/push/subscribe')
			const config = await configRes.json()

			if (!config.enabled || !config.vapidPublicKey) {
				setState('disabled')
				return false
			}

			// Subscribe to push
			const registration = await navigator.serviceWorker.ready
			const applicationServerKey = urlBase64ToUint8Array(config.vapidPublicKey)
			const subscription = await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
			})

			// Send subscription to server
			const res = await fetch('/api/push/subscribe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					subscription: {
						endpoint: subscription.endpoint,
						keys: {
							p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
							auth: arrayBufferToBase64(subscription.getKey('auth')),
						},
					},
				}),
			})

			if (!res.ok) {
				throw new Error('Failed to save subscription')
			}

			setState('subscribed')
			return true
		} catch {
			// Subscription failed - returns false
			return false
		} finally {
			setIsLoading(false)
		}
	}, [state])

	const unsubscribe = useCallback(async () => {
		if (state !== 'subscribed') return false

		setIsLoading(true)

		try {
			const registration = await navigator.serviceWorker.ready
			const subscription = await registration.pushManager.getSubscription()

			if (subscription) {
				// Unsubscribe from browser
				await subscription.unsubscribe()

				// Remove from server
				await fetch('/api/push/subscribe', {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ endpoint: subscription.endpoint }),
				})
			}

			setState('unsubscribed')
			return true
		} catch {
			// Unsubscribe failed - returns false
			return false
		} finally {
			setIsLoading(false)
		}
	}, [state])

	return {
		state,
		isLoading,
		isSupported: state !== 'unsupported',
		isEnabled: state !== 'disabled' && state !== 'unsupported',
		isSubscribed: state === 'subscribed',
		subscribe,
		unsubscribe,
	}
}

// Helper functions
function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
	const rawData = window.atob(base64)
	const outputArray = new Uint8Array(rawData.length)
	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i)
	}
	return outputArray
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
	if (!buffer) return ''
	const bytes = new Uint8Array(buffer)
	let binary = ''
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i])
	}
	return window.btoa(binary)
}
