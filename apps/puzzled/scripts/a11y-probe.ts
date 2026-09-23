import { chromium } from 'playwright'

const BASE = process.env.SHOT_BASE ?? 'http://localhost:3100'
const browser = await chromium.launch()
const ctx = await browser.newContext({
	viewport: { width: 1440, height: 900 },
	colorScheme: 'light',
})
const page = await ctx.newPage()
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
await page.waitForTimeout(2500)
const report = await page.evaluate(() => {
	const out: {
		truncates: unknown[]
		gap3: unknown[]
		amber: unknown[]
		pill: unknown
		nearWhite: unknown[]
	} = { truncates: [], gap3: [], amber: [], pill: null, nearWhite: [] }
	document.querySelectorAll('.truncate').forEach((el) => {
		const cs = getComputedStyle(el)
		out.truncates.push({
			t: (el.textContent || '').slice(0, 24),
			color: cs.color,
			cls: String(el.className).slice(0, 90),
		})
	})
	document.querySelectorAll('.gap-3 > .truncate').forEach((el) => {
		out.gap3.push({
			t: (el.textContent || '').slice(0, 24),
			color: getComputedStyle(el).color,
			parent: el.parentElement ? String(el.parentElement.className).slice(0, 90) : '',
		})
	})
	document.querySelectorAll('.text-amber-700').forEach((el) => {
		out.amber.push({
			t: (el.textContent || '').slice(0, 24),
			cls: String(el.className).slice(0, 90),
		})
	})
	const pill = document.querySelector('a[aria-current="page"]')
	if (pill) {
		const cs = getComputedStyle(pill)
		out.pill = {
			color: cs.color,
			bg: cs.backgroundColor,
			cls: String(pill.className).slice(0, 120),
		}
	}
	document.querySelectorAll('span,p,a,div,button').forEach((el) => {
		const c = getComputedStyle(el).color
		const m = c.match(/rgba?\((\d+), (\d+), (\d+)/)
		if (!m) return
		const r = Number(m[1])
		const g = Number(m[2])
		const bl = Number(m[3])
		if (r > 250 && g > 248 && bl > 245) {
			out.nearWhite.push({
				c,
				cls: String(el.className).slice(0, 90),
				t: (el.textContent || '').slice(0, 30),
			})
		}
	})
	return out
})
console.log(JSON.stringify(report).slice(0, 5200))
await browser.close()
