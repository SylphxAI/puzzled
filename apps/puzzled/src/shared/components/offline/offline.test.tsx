import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { renderToStaticMarkup } from 'react-dom/server'
import { OfflineDocument } from './offline-document'

const source = readFileSync(new URL('../../../../public/sw.js', import.meta.url), 'utf8')

type WorkerEvent = {
	request?: { mode: string; url: string; method?: string }
	waitUntil?: (promise: Promise<void>) => void
	respondWith?: (promise: Promise<Response>) => void
}

function worker(network: () => Promise<Response>) {
	const handlers: Record<string, (event: WorkerEvent) => void> = {}
	const entries = new Map<string, Response>()
	const cache = {
		add: async (request: Request) => {
			expect(request.credentials).toBe('omit')
			entries.set('/offline.html', new Response('offline'))
		},
		match: async (url: string) => entries.get(url),
	}
	runInNewContext(source, {
		self: {
			location: { origin: 'https://puzzled.gg' },
			addEventListener: (name: string, handler: (event: WorkerEvent) => void) => {
				handlers[name] = handler
			},
			skipWaiting: async () => {},
			clients: { claim: async () => {} },
		},
		caches: { open: async () => cache, keys: async () => [] },
		fetch: network,
		URL,
		Request: class {
			credentials: string | undefined
			constructor(_url: string, init: RequestInit) {
				this.credentials = init.credentials
			}
		},
		Response,
	})
	return { handlers, entries }
}

test('generated document stays in sync with existing components and tokens', () => {
	const html = readFileSync(new URL('../../../../public/offline.html', import.meta.url), 'utf8')
	expect(html).toBe(`<!doctype html>${renderToStaticMarkup(<OfflineDocument />)}\n`)
	expect(html).toContain('Puzzled needs an internet connection')
	expect(html).toContain('href=""')
	expect(html).not.toContain('<script')
	expect(html).not.toContain('<link')
})

test('failed navigation uses only the cached fallback; successful and HTTP errors stay authoritative', async () => {
	for (const status of [200, 401, 500, 0]) {
		const { handlers, entries } = worker(async () => {
			if (!status) throw new Error('offline')
			return new Response('network', { status })
		})
		let installed!: Promise<void>
		handlers.install({
			waitUntil: (p: Promise<void>) => {
				installed = p
			},
		})
		await installed
		let response!: Promise<Response>
		handlers.fetch({
			request: { mode: 'navigate', method: 'GET', url: 'https://puzzled.gg/games/sudoku' },
			respondWith: (p: Promise<Response>) => {
				response = p
			},
		})
		expect(await (await response).text()).toBe(status ? 'network' : 'offline')
		expect([...entries.keys()]).toEqual(['/offline.html'])
	}
})

test('RPCs, POSTs, assets, and cross-origin requests are not intercepted', () => {
	const { handlers } = worker(async () => {
		throw new Error('must not fetch')
	})
	for (const request of [
		{ mode: 'cors', url: 'https://puzzled.gg/api/rpc', method: 'POST' },
		{ mode: 'same-origin', url: 'https://puzzled.gg/account' },
		{ mode: 'no-cors', url: 'https://puzzled.gg/image.png' },
		{ mode: 'navigate', url: 'https://example.com/' },
	]) {
		handlers.fetch({
			request,
			respondWith: () => {
				throw new Error('must not intercept')
			},
		})
	}
})
