/** Read-only, real-site frames; no mocked puzzles or payment submission. */
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, type Page } from 'playwright'

const output = process.env.CAPTURE_DIR ?? 'artifacts/first-session'
function origin(value: string): string {
	const url = new URL(value)
	if (url.protocol !== 'https:' || url.username || url.password)
		throw new Error('Use a public HTTPS origin without credentials')
	return url.origin
}
const targets = [['served', origin(process.env.BASE_URL ?? 'https://puzzled.gg')]]
if (process.env.PREVIEW_URL) targets.push(['preview', origin(process.env.PREVIEW_URL)])
const browser = await chromium.launch()
try {
	for (const viewport of [
		{ width: 390, height: 844 },
		{ width: 1440, height: 900 },
	]) {
		for (const [label, base] of targets) {
			const context = await browser.newContext({ viewport })
			const page = await context.newPage()
			const errors: string[] = []
			page.on('pageerror', (e) => errors.push(e.message))
			const dir = `${output}/${label}-${viewport.width}x${viewport.height}`
			await mkdir(dir, { recursive: true })
			async function capture(name: string, url?: string) {
				let navigationError: string | undefined
				if (url)
					try {
						await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
					} catch (e) {
						navigationError = String(e)
					}
				await page.waitForTimeout(2500)
				await page.screenshot({ path: `${dir}/${name}.png` })
				await writeFile(
					`${dir}/${name}.json`,
					JSON.stringify(
						{
							at: new Date().toISOString(),
							url: page.url(),
							viewport,
							navigationError,
							errors: [...errors],
							text: await page.locator('body').innerText(),
						},
						null,
						2,
					),
				)
			}
			await capture('01-home', base)
			// Follow the server-selected featured game, which changes each product day.
			const play = page.getByRole('link', { name: /^Play today's / }).first()
			const href = await play.getAttribute('href')
			if (!href || new URL(href, base).origin !== base)
				throw new Error('Missing same-origin daily play CTA')
			await capture('02-today', new URL(href, base).href)
			await capture('03-stats', `${base}/stats`)
			await capture('04-plus', `${base}/pricing`)
			await context.close()
		}
		if (process.env.CAPTURE_NYT === 'true') {
			const context = await browser.newContext({ viewport })
			const page: Page = await context.newPage()
			const dir = `${output}/nyt-${viewport.width}x${viewport.height}`
			await mkdir(dir, { recursive: true })
			for (const [name, url] of [
				['home', 'https://www.nytimes.com/crosswords'],
				['wordle', 'https://www.nytimes.com/games/wordle/index.html'],
				['connections', 'https://www.nytimes.com/games/connections'],
			]) {
				let error: string | undefined
				try {
					await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
				} catch (e) {
					error = String(e)
				}
				await page.waitForTimeout(2500)
				await page.screenshot({ path: `${dir}/${name}.png` })
				await writeFile(
					`${dir}/${name}.json`,
					JSON.stringify(
						{
							at: new Date().toISOString(),
							url: page.url(),
							viewport,
							error,
							text: await page.locator('body').innerText(),
						},
						null,
						2,
					),
				)
			}
			await context.close()
		}
	}
} finally {
	await browser.close()
}
