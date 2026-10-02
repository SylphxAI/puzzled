import { describe, expect, test } from 'bun:test'
import { createActiveAnnouncementsCache } from './active-cache'
import type { BannerAnnouncement } from './visible'

const n = (id: string): BannerAnnouncement => ({
	id,
	title: id,
	body: 'b',
	type: 'info',
	dismissible: true,
})
const tick = () => new Promise((r) => setTimeout(r, 0))

function harness(over: Partial<Parameters<typeof createActiveAnnouncementsCache>[0]> = {}) {
	let clock = 0
	let calls = 0
	let impl: () => Promise<BannerAnnouncement[]> = async () => [n('a')]
	const cache = createActiveAnnouncementsCache({
		fetch: () => {
			calls++
			return impl()
		},
		now: () => clock,
		...over,
	})
	return {
		cache,
		calls: () => calls,
		advance: (ms: number) => {
			clock += ms
		},
		set: (f: () => Promise<BannerAnnouncement[]>) => {
			impl = f
		},
	}
}

describe('active announcements cache', () => {
	test('is fresh for 30s with one fetch, however many readers', async () => {
		const h = harness()
		const [a, b] = await Promise.all([h.cache.get(), h.cache.get()])
		expect(a).toEqual([n('a')])
		expect(b).toEqual([n('a')])
		expect(h.calls()).toBe(1)
		h.advance(29_000)
		await h.cache.get()
		expect(h.calls()).toBe(1)
	})

	test('once stale it serves the last list at once and refreshes once in the background', async () => {
		const h = harness()
		await h.cache.get()
		let release: () => void = () => {}
		const gate = new Promise<void>((r) => {
			release = r
		})
		h.set(async () => {
			await gate
			return [n('b')]
		})
		h.advance(31_000)
		expect(await h.cache.get()).toEqual([n('a')])
		expect(await h.cache.get()).toEqual([n('a')])
		release()
		await tick()
		expect(h.calls()).toBe(2)
		expect(await h.cache.get()).toEqual([n('b')])
	})

	test('a failed refresh keeps the last good list and retries soon', async () => {
		const h = harness()
		await h.cache.get()
		h.set(async () => {
			throw new Error('down')
		})
		h.advance(31_000)
		expect(await h.cache.get()).toEqual([n('a')])
		await tick()
		expect(await h.cache.get()).toEqual([n('a')])
		expect(h.calls()).toBe(2)
		h.advance(6_000)
		await h.cache.get()
		expect(h.calls()).toBe(3)
	})

	test('a cold read that fails or hangs shows nothing, within the cold wait', async () => {
		const failing = harness()
		failing.set(async () => {
			throw new Error('down')
		})
		expect(await failing.cache.get()).toEqual([])
		const hanging = harness({ coldWaitMs: 20 })
		hanging.set(() => new Promise(() => {}))
		const started = Date.now()
		expect(await hanging.cache.get()).toEqual([])
		expect(Date.now() - started).toBeLessThan(500)
	})

	test('invalidate makes the next read fetch again', async () => {
		const h = harness()
		await h.cache.get()
		h.cache.invalidate()
		await h.cache.get()
		await tick()
		expect(h.calls()).toBe(2)
	})

	test('the public read forwards no cookies or user agent', async () => {
		const source = await Bun.file(new URL('../../../lib/api/server.ts', import.meta.url)).text()
		const block = source.slice(
			source.indexOf('createActiveAnnouncementsCache({'),
			source.indexOf('export const getServerActiveAnnouncements'),
		)
		expect(block).toContain("mergeServerConnectInit(init, '', SERVER_CONNECT_TIMEOUT_MS)")
		expect(block).not.toContain('getServerTransport')
		expect(block).not.toContain('cookies()')
		expect(block).not.toContain('headers()')
	})
})
