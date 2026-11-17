import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import ts from 'typescript'
import { isBrowserReport, RELAY_PATH } from '../src/lib/observability/browser-report'

const origin = 'https://observability.test'
const target = `${origin}/ja/games/private-slug?private-query#private-fragment`
const modulePaths = [
	'/instrumentation-client',
	'/lib/observability/browser',
	'/lib/observability/browser-report',
	'/lib/i18n/config',
]

// Exercise the actual instrumentation entry and its imports in Chromium, without a backend.
async function installFixture(page: Page, html: string, relayStatus = 204) {
	const posts: { body: unknown; headers: Record<string, string>; method: string }[] = []
	const consoleMessages: string[] = []
	page.on('console', (message) => consoleMessages.push(message.text()))
	await page.route(`${origin}/**`, async (route) => {
		const request = route.request()
		const path = new URL(request.url()).pathname
		if (path === RELAY_PATH) {
			posts.push({
				body: request.postDataJSON(),
				headers: await request.allHeaders(),
				method: request.method(),
			})
			await route.fulfill({ status: relayStatus })
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
				selector: 'img',
				route: '/games/[slug]',
				breadcrumbs: [{ kind: 'navigation', route: '/games/[slug]' }],
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
				.map(({ body }) => isBrowserReport(body) && [body.type, body.selector])
				.slice(1)
				.sort(),
		)
		.toEqual([
			['MediaError', 'audio'],
			['MediaError', 'img'],
			['MediaError', 'video'],
		])
	expect(posts.every(({ body }) => isBrowserReport(body))).toBe(true)
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
	const reports = posts.map(({ body }) => body).filter(isBrowserReport)
	expect(reports).toHaveLength(5)
	expect(reports.map(({ type, selector }) => [type, selector]).sort()).toEqual([
		['BoundaryError', 'global'],
		['BoundaryError', 'main-layout'],
		['CSPViolation', 'script-src-elem'],
		['UncaughtError', 'window'],
		['UnhandledRejection', 'window'],
	])
	const initial = reports.find(({ type }) => type === 'UncaughtError')
	expect(initial?.route).toBe('/r/[shareId]')
	expect(initial?.breadcrumbs).toEqual([
		{ kind: 'http', status: 202, route: '/games/[slug]' },
		{ kind: 'navigation', route: '/r/[shareId]' },
		...Array.from({ length: 13 }, () => ({
			kind: 'click',
			route: '/r/[shareId]',
			selector: 'button',
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
		route: '/daily',
		selector: 'button',
	})
	await page.clock.fastForward(60_001)
	await burst('none')
	expect(posts).toHaveLength(1)
})

test('relay 204 adds no collector console output', async ({ page }) => {
	const { posts, consoleMessages } = await installFixture(page, '<main>fixture</main>')
	const response = page.waitForResponse(origin + RELAY_PATH)
	await page.evaluate(() =>
		window.dispatchEvent(new ErrorEvent('error', { message: 'private-error' })),
	)
	expect((await response).status()).toBe(204)
	expect(posts).toHaveLength(1)
	expect(consoleMessages).toEqual([])
})
