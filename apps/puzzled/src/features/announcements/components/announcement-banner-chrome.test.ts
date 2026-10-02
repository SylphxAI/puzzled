import { describe, expect, mock, test } from 'bun:test'

let read: () => Promise<unknown[]> = async () => []
mock.module('@/lib/api/server', () => ({ getServerActiveAnnouncements: () => read() }))
mock.module('next/headers', () => ({
	cookies: async () => ({ get: () => undefined }),
}))
// Keep the presentation deadline short so the timeout case is quick.
mock.module('@/lib/presentation-document', () => ({
	withPresentationDeadline: async <T>(p: Promise<T>, fallback: T) => {
		let timer: ReturnType<typeof setTimeout> | undefined
		try {
			return await Promise.race([
				p.catch(() => fallback),
				new Promise<T>((r) => {
					timer = setTimeout(() => r(fallback), 50)
				}),
			])
		} finally {
			if (timer) clearTimeout(timer)
		}
	},
}))

const { AnnouncementBannerChrome } = await import('./announcement-banner-chrome')

describe('AnnouncementBannerChrome', () => {
	test('renders nothing when there are no rows', async () => {
		read = async () => []
		expect(await AnnouncementBannerChrome()).toBeNull()
	})

	test('renders nothing when the read rejects', async () => {
		read = async () => {
			throw new Error('api down')
		}
		expect(await AnnouncementBannerChrome()).toBeNull()
	})

	test('renders nothing when the read times out', async () => {
		read = () => new Promise(() => {})
		expect(await AnnouncementBannerChrome()).toBeNull()
	})

	test('renders the banner when a row is active', async () => {
		read = async () => [
			{
				id: '0197a000-0000-7000-8000-000000000001',
				title: 'T',
				body: 'B',
				type: 'info',
				dismissible: true,
			},
		]
		expect(await AnnouncementBannerChrome()).not.toBeNull()
	})
})
