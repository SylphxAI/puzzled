import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

function worker() {
	const handlers = new Map<string, (event: unknown) => void>()
	const notifications: unknown[][] = []
	const opened: string[] = []
	const self = {
		addEventListener: (name: string, callback: (event: unknown) => void) =>
			handlers.set(name, callback),
		location: { origin: 'https://puzzled.gg' },
		registration: {
			showNotification: async (...args: unknown[]) => {
				notifications.push(args)
			},
		},
		clients: {
			matchAll: async () => [],
			openWindow: async (url: string) => {
				opened.push(url)
			},
		},
	}
	runInNewContext(readFileSync(new URL('../../../../public/sw.js', import.meta.url), 'utf8'), {
		self,
		URL,
	})
	return { handlers, notifications, opened }
}

describe('Puzzled service worker', () => {
	test('renders the localized push payload without caching any data', async () => {
		const { handlers, notifications } = worker()
		let pending: Promise<unknown> = Promise.resolve()
		handlers.get('push')?.({
			data: { json: () => ({ title: '每日謎題', body: '每日提醒', url: '/zh-HK' }) },
			waitUntil: (promise: Promise<unknown>) => {
				pending = promise
			},
		})
		await pending
		expect(notifications[0]?.[0]).toBe('每日謎題')
		expect(notifications[0]?.[1]).toMatchObject({
			body: '每日提醒',
			tag: 'daily-puzzle',
			data: { url: '/zh-HK' },
		})
		expect(handlers.has('fetch')).toBe(false)
	})
	test('notification clicks stay on the app origin', async () => {
		const { handlers, opened } = worker()
		let pending: Promise<unknown> = Promise.resolve()
		const click = (url: string) =>
			handlers.get('notificationclick')?.({
				notification: { close: () => undefined, data: { url } },
				waitUntil: (promise: Promise<unknown>) => {
					pending = promise
				},
			})
		click('https://evil.test/')
		await pending
		expect(opened).toHaveLength(0)
		click('/zh-TW')
		await pending
		expect(opened).toEqual(['https://puzzled.gg/zh-TW'])
	})
})
