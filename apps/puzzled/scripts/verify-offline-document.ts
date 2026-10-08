/** Browser check of the standalone document and its precache integration contract.
 * The small worker below is a test fixture, not Puzzled's production worker.
 * Run on a Build lease: bun run scripts/verify-offline-document.ts
 */

import { mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { chromium } from 'playwright'
import { buildCsp } from '../src/lib/csp'
import { defaultLocale, locales } from '../src/lib/i18n/config'

const app = resolve(import.meta.dir, '..')
const shots = resolve(app, '../../docs/design/offline')
await mkdir(shots, { recursive: true })
const offlinePaths = locales.map((locale) =>
	locale === defaultLocale ? '/offline.html' : `/offline/${locale}.html`,
)
const fixtureWorker = `
self.addEventListener('install', event => event.waitUntil(caches.open('offline-document-test').then(cache => cache.addAll(${JSON.stringify(offlinePaths)}))));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
 if (event.request.mode !== 'navigate') return;
 event.respondWith(fetch(event.request).catch(() => {
  const prefix = new URL(event.request.url).pathname.split('/')[1];
  const locale = ${JSON.stringify(locales)}.find(locale => locale.toLowerCase() === prefix.toLowerCase());
  const path = !locale || locale === '${defaultLocale}' ? '/offline.html' : '/offline/' + locale + '.html';
  return caches.match(path);
 }));
});`
const server = Bun.serve({
	port: 0,
	fetch(request) {
		const path = new URL(request.url).pathname
		if (path === '/sw-fixture.js')
			return new Response(fixtureWorker, { headers: { 'Content-Type': 'text/javascript' } })
		if (offlinePaths.includes(path))
			return new Response(Bun.file(resolve(app, `public${path}`)), {
				headers: {
					'Content-Type': 'text/html; charset=utf-8',
					'Content-Security-Policy': buildCsp('offline-document'),
				},
			})
		return new Response(
			'<!doctype html><html lang="en"><title>Online fixture</title><h1>Online fixture</h1></html>',
			{ headers: { 'Content-Type': 'text/html' } },
		)
	},
})
const origin = server.url.origin
const browser = await chromium.launch({ headless: true })
const cleanup = async () => {
	await browser.close()
	server.stop(true)
}
process.once('SIGTERM', () => {
	void cleanup().finally(() => process.exit(124))
})
try {
	// Existing public recovery surface, inspected before designing its offline counterpart.
	const before = await browser.newContext({ viewport: { width: 390, height: 844 } })
	const beforePage = await before.newPage()
	await beforePage.goto('https://puzzled.gg/offline', {
		waitUntil: 'domcontentloaded',
		timeout: 30000,
	})
	await beforePage.screenshot({ path: resolve(shots, 'before-phone.png'), fullPage: true })
	await beforePage.setViewportSize({ width: 1440, height: 1000 })
	await beforePage.screenshot({ path: resolve(shots, 'before-desktop.png'), fullPage: true })
	await before.close()

	for (const [name, viewport, colorScheme] of [
		['phone', { width: 390, height: 844 }, 'light'],
		['desktop', { width: 1440, height: 1000 }, 'light'],
		['phone-dark', { width: 390, height: 844 }, 'dark'],
	] as const) {
		const context = await browser.newContext({ viewport, colorScheme, reducedMotion: 'reduce' })
		const page = await context.newPage()
		await page.goto(origin)
		await page.evaluate(async () => {
			await navigator.serviceWorker.register('/sw-fixture.js')
			await navigator.serviceWorker.ready
			if (!navigator.serviceWorker.controller)
				await new Promise<void>((done) =>
					navigator.serviceWorker.addEventListener('controllerchange', () => done(), {
						once: true,
					}),
				)
		})
		await context.setOffline(true)
		await page.goto(`${origin}/games/five`, { waitUntil: 'load' })
		await page.getByRole('heading', { name: 'You’re offline' }).waitFor()
		await page.evaluate(() => document.fonts.ready)
		const retry = page.getByRole('link', { name: 'Try again' })
		const box = await retry.boundingBox()
		if (!box || box.height < 44 || box.width < 44)
			throw new Error(`${name}: retry target below 44px`)
		const horizontalOverflow = await page.evaluate(
			() => document.documentElement.scrollWidth > innerWidth,
		)
		if (horizontalOverflow) throw new Error(`${name}: horizontal overflow`)
		const violations = (
			await new AxeBuilder({ page })
				.withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
				.analyze()
		).violations
		if (violations.length) throw new Error(JSON.stringify(violations))
		await page.screenshot({ path: resolve(shots, `after-${name}.png`), fullPage: true })
		await page.keyboard.press('Tab')
		if (!(await retry.evaluate((element) => element === document.activeElement)))
			throw new Error(`${name}: retry not keyboard reachable`)
		await page.screenshot({ path: resolve(shots, `focus-${name}.png`), fullPage: true })
		// A retry while still offline remains recoverable; reconnecting reaches Today.
		await retry.click()
		await page.getByRole('heading', { name: 'You’re offline' }).waitFor()
		await context.setOffline(false)
		await retry.click()
		await page.getByRole('heading', { name: 'Online fixture' }).waitFor()
		console.log(
			`${name}: offline document, AA, 44px target, keyboard focus and retry/reconnect passed`,
		)
		await context.close()
	}
	// Each supported locale retains its recovery language and home target; narrow phone checks wrapping.
	const context = await browser.newContext({ viewport: { width: 320, height: 700 } })
	const page = await context.newPage()
	for (const locale of locales) {
		const labels = JSON.parse(
			await readFile(resolve(app, `src/messages/${locale}/offline.json`), 'utf8'),
		)
		const path = locale === defaultLocale ? '/offline.html' : `/offline/${locale}.html`
		await page.goto(`${origin}${path}`)
		await page.getByRole('heading', { name: labels.title }).waitFor()
		if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
			throw new Error(`${locale}: overflow at 320px`)
		const target = await page.getByRole('link', { name: labels.retry }).getAttribute('href')
		if (target !== (locale === defaultLocale ? '/' : `/${locale}`))
			throw new Error(`${locale}: wrong home target`)
		if (locale === 'zh-HK' || locale === 'es')
			await page.screenshot({ path: resolve(shots, `after-${locale}.png`), fullPage: true })
	}
	await context.close()
	console.log(
		'Eight locale documents passed at 320px; production service-worker integration remains the parent item’s check.',
	)
} finally {
	await cleanup()
}
