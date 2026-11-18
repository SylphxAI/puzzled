import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import ts from 'typescript'
import { POST } from '../src/app/api/observability/errors/route'

// Assert the public relay wire format independently of the collector's encoder.
const RELAY_PATH = '/api/observability/errors'

const origin = 'http://127.0.0.1:3900'
const target = `${origin}/ja/games/private-slug?private-query#private-fragment`
const modulePaths = [
	'/instrumentation-client',
	'/lib/observability/browser',
	'/lib/observability/browser-report',
	'/lib/i18n/config',
]

// Exercise the actual instrumentation entry and its imports in Chromium, without a backend.
async function installFixture(
	page: Page,
	html: string,
	relay?: (request: Request) => Promise<Response>,
) {
	const posts: {
		body: {
			type: string
			message: string
			path: string
			tags: { selector: string }
			breadcrumbs: unknown[]
		}
		headers: Record<string, string>
		method: string
	}[] = []
	const consoleMessages: string[] = []
	page.on('console', (message) => consoleMessages.push(message.text()))
	await page.route('**/*', async (route) => {
		const request = route.request()
		const url = new URL(request.url())
		if (url.origin !== origin) {
			await route.abort()
			return
		}
		const path = url.pathname
		if (path === RELAY_PATH) {
			posts.push({
				body: request.postDataJSON(),
				headers: await request.allHeaders(),
				method: request.method(),
			})
			const buffer = request.postDataBuffer()
			const response = relay
				? await relay(
						new Request(request.url(), {
							method: request.method(),
							headers: await request.allHeaders(),
							body: buffer ? Uint8Array.from(buffer) : null,
						}),
					)
				: new Response(null, { status: 204 })
			await route.fulfill({ status: response.status })
		} else if (request.isNavigationRequest()) {
			await route.fulfill({
				contentType: 'text/html',
				body:
					'<link rel="icon" href="data:,">' +
					html +
					'<script type="module" src="/instrumentation-client"></script>',
			})
		} else if (modulePaths.includes(path)) {
			const source = readFileSync(resolve(__dirname, `../src${path}.ts`), 'utf-8')
			const { outputText } = ts.transpileModule(source, {
				compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
			})
			await route.fulfill({ contentType: 'text/javascript', body: outputText })
		} else if (path === '/status') {
			await route.fulfill({ status: 202 })
		} else {
			await route.fulfill({ status: 404 })
		}
	})
	await page.goto(target)
	return { posts, consoleMessages }
}

test('startup empty src and capture-phase media failures; absent src is not an issue', async ({
	page,
}) => {
	const { posts } = await installFixture(
		page,
		'<img src="" alt="private-alt"><img><audio></audio><video></video>',
	)
	await expect
		.poll(() => posts.map(({ body }) => body))
		.toEqual([
			{
				type: 'EmptyMediaSource',
				message: 'Media has an empty source',
				path: '/games/[slug]',
				tags: { selector: 'img' },
				breadcrumbs: [{ category: 'navigation', message: '/games/[slug]' }],
			},
		])
	await page.evaluate(() => {
		for (const tag of ['img', 'audio', 'video'] as const) {
			const node = document.createElement(tag)
			node.src = '/missing?private-media-url'
			if (node instanceof HTMLMediaElement) node.preload = 'auto'
			document.body.append(node)
		}
	})
	await expect
		.poll(() =>
			posts
				.map(({ body }) => [body.type, body.tags.selector])
				.slice(1)
				.sort(),
		)
		.toEqual([
			['MediaError', 'audio'],
			['MediaError', 'img'],
			['MediaError', 'video'],
		])
	expect(JSON.stringify(posts.map(({ body }) => body))).not.toContain('private-')
})

test('only closed reports with the last 15 RAM breadcrumbs; dedup and rolling limit', async ({
	page,
}) => {
	await page.clock.install()
	const { posts } = await installFixture(
		page,
		'<button aria-label="private-label">private-text</button>',
	)
	await page.evaluate(async () => {
		await fetch('/status?private-http')
		history.replaceState(null, '', '/ja/r/private-share?private-history')
		for (let n = 0; n < 13; n++) {
			document.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
		}
	})
	expect(posts).toHaveLength(0)
	await page.evaluate(async () => {
		const imports = '/lib/observability/browser'
		const client = await import(imports)
		const error = new ErrorEvent('error', {
			message: 'private-exception',
			filename: '/private-file',
		})
		window.dispatchEvent(error)
		window.dispatchEvent(error)
		window.dispatchEvent(
			new PromiseRejectionEvent('unhandledrejection', {
				promise: Promise.resolve(),
				reason: 'private-rejection',
			}),
		)
		client.reportBoundaryError('main-layout')
		client.reportBoundaryError('global')
		document.dispatchEvent(
			new SecurityPolicyViolationEvent('securitypolicyviolation', {
				effectiveDirective: 'script-src-elem',
				blockedURI: 'https://private-blocked.test/q',
			}),
		)
		client.reportBoundaryError('auth') // sixth distinct report is throttled
	})
	await expect.poll(() => posts.length).toBe(5)
	await page.clock.runFor(400)
	const reports = posts.map(({ body }) => body)
	expect(reports).toHaveLength(5)
	expect(reports.map(({ type, tags }) => [type, tags.selector]).sort()).toEqual([
		['BoundaryError', 'global'],
		['BoundaryError', 'main-layout'],
		['CSPViolation', 'script-src-elem'],
		['UncaughtError', 'window'],
		['UnhandledRejection', 'window'],
	])
	const initial = reports.find(({ type }) => type === 'UncaughtError')
	expect(initial?.path).toBe('/r/[shareId]')
	expect(initial?.breadcrumbs).toEqual([
		{ category: 'http', message: '/games/[slug] 202' },
		{ category: 'navigation', message: '/r/[shareId]' },
		...Array.from({ length: 13 }, () => ({
			category: 'click',
			message: '/r/[shareId] button',
		})),
	])
	for (const { method, headers } of posts) {
		expect(method).toBe('POST')
		expect(headers.origin).toBe(origin)
		for (const name of ['referer', 'cookie', 'authorization']) expect(headers[name]).toBeUndefined()
	}
	expect(JSON.stringify(reports)).not.toContain('private-')
	await page.clock.fastForward(60_001)
	await page.evaluate(async () => {
		const imports = '/lib/observability/browser'
		;(await import(imports)).reportBoundaryError('auth')
	})
	await expect.poll(() => posts.length).toBe(6)
})

test('three quick clicks on one control report once; observable effects suppress the candidate', async ({
	page,
}) => {
	await page.clock.install()
	const { posts } = await installFixture(page, '<button>First</button><button>Second</button>')
	const burst = async (
		effect: 'dom' | 'navigation' | 'fetch' | 'xhr' | 'mixed' | 'two' | 'none',
	) => {
		await page.evaluate((effectName) => {
			const [button, second] = document.querySelectorAll('button')
			for (let n = 0; n < (effectName === 'two' ? 2 : 3); n++) {
				const target = effectName === 'mixed' && n === 1 ? second : button
				target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
			}
			switch (effectName) {
				case 'dom':
					button.setAttribute('data-state', 'opened')
					break
				case 'navigation':
					history.pushState(null, '', '/daily')
					break
				case 'fetch':
					void fetch('/status')
					break
				case 'xhr': {
					const xhr = new XMLHttpRequest()
					xhr.open('GET', '/status')
					xhr.send()
					break
				}
			}
		}, effect)
		await page.clock.runFor(1300)
	}
	for (const effect of ['two', 'mixed', 'dom', 'navigation', 'fetch', 'xhr'] as const) {
		await burst(effect)
		expect(posts, effect).toHaveLength(0)
	}
	await burst('none')
	await expect.poll(() => posts.length).toBe(1)
	expect(posts[0].body).toMatchObject({
		type: 'IneffectiveClick',
		path: '/daily',
		tags: { selector: 'button' },
	})
	await page.clock.fastForward(60_001)
	await burst('none')
	expect(posts).toHaveLength(1)
})

test('Chromium sends the legacy report through the app relay and SDK, without credentials or stack', async ({
	page,
}) => {
	const upstream: { url: string; method: string; body: unknown }[] = []
	const accept = async (request: Request) => {
		const env = process.env
		const fetch = globalThis.fetch
		// Exercise the real relay and SDK without reading release config or allowing egress.
		process.env = {
			NODE_ENV: 'test',
			SYLPHX_PUBLIC_URL: origin,
			SYLPHX_API_KEY: 'fixture-credential',
		}
		globalThis.fetch = async (input, init) => {
			const sdkRequest = new Request(input, init)
			upstream.push({
				url: sdkRequest.url,
				method: sdkRequest.method,
				body: await sdkRequest.json(),
			})
			return Response.json({ error_event: { name: 'fixture-occurrence' } })
		}
		try {
			return await POST(request)
		} finally {
			globalThis.fetch = fetch
			process.env = env
		}
	}
	await page.context().addCookies([{ name: 'fixture', value: 'private-cookie', url: origin }])
	const { posts, consoleMessages } = await installFixture(page, '<main>fixture</main>', accept)
	const response = page.waitForResponse(origin + RELAY_PATH)
	await page.evaluate(async () => {
		const imports = '/lib/observability/browser'
		const client = await import(imports)
		const installedFetch = window.fetch
		// The retained layout component calls the same installer on mount.
		client.installBrowserErrorCapture()
		if (installedFetch !== window.fetch) throw new Error('Collector installed twice')
		window.dispatchEvent(new ErrorEvent('error', { error: new Error('private-error') }))
	})
	expect((await response).status()).toBe(204)
	expect(posts).toHaveLength(1)
	const { body, headers } = posts[0]
	expect(body).toEqual({
		type: 'UncaughtError',
		message: 'Uncaught browser exception',
		path: '/games/[slug]',
		tags: { selector: 'window' },
		breadcrumbs: [{ category: 'navigation', message: '/games/[slug]' }],
	})
	expect(headers.origin).toBe(origin)
	// Fetch metadata may be absent on an intercepted request. Never synthesize it.
	if (headers['sec-fetch-site']) expect(headers['sec-fetch-site']).toBe('same-origin')
	for (const name of ['referer', 'cookie', 'authorization']) expect(headers[name]).toBeUndefined()
	expect(upstream).toEqual([
		{
			url: 'https://api.sylphx.com/v1/orgs/-/projects/-/envs/-/error_groups:capture',
			method: 'POST',
			body: {
				error_event: {
					event_time: expect.any(String),
					exception_type: 'UncaughtError',
					message: 'Uncaught browser exception',
					service_name: 'web-browser',
					tags: { source: 'browser', selector: 'window', route: '/games/[slug]' },
					breadcrumbs: [
						{
							event_time: expect.any(String),
							category: 'navigation',
							message: '/games/[slug]',
						},
					],
				},
			},
		},
	])
	const denied = await accept(
		new Request(origin + RELAY_PATH, {
			method: 'POST',
			headers: { ...headers, origin: 'https://unrelated.test', 'sec-fetch-site': 'cross-site' },
			body: JSON.stringify(body),
		}),
	)
	expect(denied.status).toBe(403)
	expect(upstream).toHaveLength(1)
	expect(consoleMessages).toEqual([])
})

test('the collector swallows an unavailable relay and leaves page fetch usable', async ({
	page,
}) => {
	const pageErrors: Error[] = []
	page.on('pageerror', (error) => pageErrors.push(error))
	await page.addInitScript((relayPath) => {
		const fetch = window.fetch.bind(window)
		window.fetch = (input, init) =>
			input === relayPath
				? Promise.reject(new Error('Fixture relay unavailable'))
				: fetch(input, init)
	}, RELAY_PATH)
	const { posts, consoleMessages } = await installFixture(page, '<main>fixture</main>')
	const status = await page.evaluate(async () => {
		window.dispatchEvent(new ErrorEvent('error', { error: new Error('private-error') }))
		return (await fetch('/status')).status
	})
	expect(status).toBe(202)
	expect(posts).toHaveLength(0)
	expect(pageErrors).toEqual([])
	expect(consoleMessages).toEqual([])
})
