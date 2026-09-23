import { chromium } from 'playwright'

const BASE = process.env.SHOT_BASE ?? 'http://localhost:3100'
const browser = await chromium.launch()
const ctx = await browser.newContext({
	viewport: { width: 1440, height: 900 },
	colorScheme: 'light',
})
const page = await ctx.newPage()

const routes = ['/', '/games', '/stats', '/support', '/pricing', '/leaderboard', '/privacy']
for (const route of routes) {
	await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
	await page.waitForTimeout(1200)
	const r = await page.evaluate(() => {
		const chainOf = (el: Element) => {
			const chain: unknown[] = []
			let n: Element | null = el
			let i = 0
			while (n && n !== document.documentElement && i < 8) {
				const cs = getComputedStyle(n)
				chain.push({
					tag: n.tagName.toLowerCase(),
					cls: String(n.className).slice(0, 70),
					bg: cs.backgroundColor,
					color: cs.color,
				})
				n = n.parentElement
				i++
			}
			return chain
		}
		const out: Record<string, unknown> = {}
		const lt = document.querySelector('.gap-3 > .truncate')
		if (lt) out.langChain = chainOf(lt)
		const underlines = [...document.querySelectorAll('.underline')]
			.filter((el) => (el as HTMLElement).offsetParent !== null)
			.slice(0, 6)
			.map((el) => ({
				t: (el.textContent || '').slice(0, 30),
				cls: String(el.className).slice(0, 80),
				color: getComputedStyle(el).color,
			}))
		if (underlines.length) out.underline = underlines
		const ambers = [...document.querySelectorAll('.text-amber-700')].slice(0, 4).map((el) => ({
			t: (el.textContent || '').slice(0, 24),
			cls: String(el.className).slice(0, 80),
			bg: el.parentElement ? getComputedStyle(el.parentElement).backgroundColor : '',
		}))
		if (ambers.length) out.amber = ambers
		const pill = document.querySelector('a[aria-current="page"]')
		if (pill)
			out.pill = { color: getComputedStyle(pill).color, bg: getComputedStyle(pill).backgroundColor }
		const sub = [
			...document.querySelectorAll('nav a[aria-current="page"], [aria-current="page"] .truncate'),
		]
			.slice(0, 4)
			.map((el) => ({
				tag: el.tagName.toLowerCase(),
				cls: String(el.className).slice(0, 70),
				color: getComputedStyle(el).color,
			}))
		if (sub.length) out.navExtra = sub
		return out
	})
	console.log(`ROUTE ${route} ${JSON.stringify(r).slice(0, 1800)}`)
}
await browser.close()
