import { mkdirSync, writeFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import {
	budgetFailures,
	markdownTable,
	type RouteReport,
	summarise,
	type VitalSample,
} from './web-vitals-support'

/**
 * Seeded-play web vitals gate.
 *
 * Five routes are loaded RUNS times each on a mobile viewport with a 4x CPU
 * slowdown. The puzzle API is answered from a fixed seed (no backend, same
 * board every run), the page is then played (taps and key presses), and the
 * browser's own LCP and Event Timing entries give one LCP and one INP per
 * load. The p75 of those loads per route is written to
 * test-results/web-vitals/report.{json,md} and checked against the budgets in
 * web-vitals-support.ts; any route over budget, or without a sample, fails.
 *
 * Field (real visitor) INP/LCP are a separate, consent-gated path; this is
 * the CI regression gate for the same numbers.
 */

const RUNS = Number(process.env.WEB_VITALS_RUNS || 5)
const OUT = 'test-results/web-vitals'

const ROUTES = ['/', '/games', '/games/sudoku', '/games/word-search', '/games/nonogram']

const solution = Array.from({ length: 9 }, (_, r) =>
	Array.from({ length: 9 }, (_, c) => ((r * 3 + Math.floor(r / 3) + c) % 9) + 1),
)

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('seeded play stays inside the LCP and INP p75 budgets on five routes', async ({ browser }) => {
	test.setTimeout(10 * 60 * 1000)
	const reports: RouteReport[] = []

	for (const route of ROUTES) {
		const samples: VitalSample[] = []
		for (let run = 0; run < RUNS; run++) {
			const context = await browser.newContext({
				viewport: { width: 390, height: 844 },
				hasTouch: true,
				isMobile: true,
				baseURL: process.env.BASE_URL || 'http://localhost:3000',
			})
			const page = await context.newPage()
			try {
				await page.route('**/puzzled.v1.PuzzleService/GetDaily', (r) =>
					r.fulfill({
						json: {
							gameSlug: 'sudoku',
							difficulty: 'easy',
							canPlay: true,
							mode: 'daily',
							puzzleDataJson: JSON.stringify({
								grid: solution.map((row, ri) =>
									row.map((v, ci) => (ri % 3 === 0 && ci % 3 === 0 ? null : v)),
								),
								difficulty: 'easy',
							}),
						},
					}),
				)
				await page.route('**/puzzled.v1.PuzzleService/SubmitGuess', (r) => r.fulfill({ json: {} }))
				const cdp = await context.newCDPSession(page)
				await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
				await page.addInitScript(() => {
					const w = window as unknown as { __vitals: { lcp: number | null; inp: number } }
					w.__vitals = { lcp: null, inp: 0 }
					new PerformanceObserver((list) => {
						for (const entry of list.getEntries()) w.__vitals.lcp = entry.startTime
					}).observe({ type: 'largest-contentful-paint', buffered: true })
					new PerformanceObserver((list) => {
						for (const entry of list.getEntries()) {
							const e = entry as PerformanceEntry & { interactionId?: number }
							if (e.interactionId) w.__vitals.inp = Math.max(w.__vitals.inp, entry.duration)
						}
					}).observe({
						type: 'event',
						durationThreshold: 16,
						buffered: true,
					} as PerformanceObserverInit)
				})

				await page.goto(route, { waitUntil: 'load' })
				await page.waitForTimeout(1000)

				// Play: tap the first few controls on the page that stay on the
				// page (buttons, grid cells), then type digits. Links are skipped so a
				// tap never navigates away from the measured route.
				const targets = page.locator(
					'button:visible, [role="gridcell"]:visible, [role="button"]:visible, main [tabindex]:visible',
				)
				const count = Math.min(await targets.count(), 8)
				let taps = 0
				for (let i = 0; i < count; i++) {
					const tapped = await targets
						.nth(i)
						.click({ timeout: 2000, force: true, noWaitAfter: true })
						.then(() => true)
						.catch(() => false)
					if (tapped) taps++
					await page.keyboard.press(String((i % 9) + 1)).catch(() => undefined)
					await page.waitForTimeout(150)
				}
				// Event Timing entries are delivered after the next paint.
				await page.waitForTimeout(500)
				const vitals = await page.evaluate(
					() => (window as unknown as { __vitals: { lcp: number | null; inp: number } }).__vitals,
				)
				// Event Timing only reports interactions slower than 16 ms, so a load
				// whose taps all landed without a report was faster than that (0).
				// A load where no tap landed has no INP at all (null) and fails.
				samples.push({ lcp: vitals.lcp, inp: taps > 0 ? vitals.inp : null })
			} finally {
				await context.close()
			}
		}
		reports.push(summarise(route, samples))
	}

	mkdirSync(OUT, { recursive: true })
	writeFileSync(`${OUT}/report.json`, `${JSON.stringify(reports, null, 2)}\n`)
	const table = markdownTable(reports)
	writeFileSync(`${OUT}/report.md`, `${table}\n`)
	console.log(`\n${table}\n`)
	if (process.env.GITHUB_STEP_SUMMARY) {
		writeFileSync(process.env.GITHUB_STEP_SUMMARY, `### Web vitals (seeded play)\n\n${table}\n`, {
			flag: 'a',
		})
	}

	const failures = reports.flatMap((r) => budgetFailures(r))
	expect(failures, failures.join('\n')).toEqual([])
})
