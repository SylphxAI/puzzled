import type { Page } from '@playwright/test'

/**
 * Shared measurement helpers for the accessibility suite.
 *
 * Kept out of the spec files so `responsive*.e2e.ts` can assert the same
 * geometry the a11y suite asserts, without a second implementation drifting.
 */

export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa']

export const DESKTOP = { width: 1440, height: 900 }
export const MOBILE = { width: 390, height: 844 }

export async function settle(page: Page) {
	await page.waitForLoadState('networkidle')
}

export type Stop = {
	tag: string
	name: string
	width: number
	height: number
	inHeader: boolean
}

export async function readActiveElement(page: Page): Promise<Stop> {
	return page.evaluate(() => {
		const element = document.activeElement
		if (!element) return { tag: 'none', name: '', width: 0, height: 0, inHeader: false }
		const rect = element.getBoundingClientRect()
		return {
			tag: element.tagName.toLowerCase(),
			name: (element.getAttribute('aria-label') || element.textContent || '')
				.replace(/\s+/g, ' ')
				.trim()
				.slice(0, 40),
			width: Math.round(rect.width),
			height: Math.round(rect.height),
			inHeader: !!element.closest('header'),
		}
	})
}

export type TargetOffender = {
	target: string
	name: string
	width: number
	height: number
}

/**
 * Controls whose *effective* hit area (not just their layout box) is smaller
 * than the 44px company target.
 *
 * The hit area is measured by walking outwards from the centre of the control
 * until `elementFromPoint` stops returning it, so hit-area expansion
 * (`before:absolute before:-inset-*`) and stretched links count correctly.
 * Visually hidden controls (the skip link) are not touch targets and are
 * skipped; text links inside a sentence carry the WCAG 2.5.8 inline exception.
 */
export async function targetOffenders(page: Page, selector: string): Promise<TargetOffender[]> {
	return page.evaluate((selector) => {
		const receivesPoint = (element: Element, x: number, y: number) => {
			const hit = document.elementFromPoint(x, y)
			return !!hit && (hit === element || element.contains(hit))
		}
		const extent = (element: Element) => {
			const rect = element.getBoundingClientRect()
			const cx = rect.left + rect.width / 2
			const cy = rect.top + rect.height / 2
			const reach = (dx: number, dy: number) => {
				for (let step = 1; step <= 61; step += 1) {
					if (!receivesPoint(element, cx + dx * step, cy + dy * step)) return step - 1
				}
				return 60
			}
			return { width: reach(-1, 0) + reach(1, 0), height: reach(0, -1) + reach(0, 1) }
		}
		const offenders: Array<{ target: string; name: string; width: number; height: number }> = []
		for (const element of Array.from(document.querySelectorAll(selector))) {
			const rect = element.getBoundingClientRect()
			const style = getComputedStyle(element)
			if (rect.width <= 2 || rect.height <= 2) continue
			if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')
				continue
			if (element.getAttribute('aria-hidden') === 'true') continue
			const label = (element.textContent ?? '').trim()
			if (label.length > 40) continue
			const measured = extent(element)
			if (measured.width >= 44 && measured.height >= 44) continue
			offenders.push({
				target: element.tagName.toLowerCase(),
				name: (element.getAttribute('aria-label') || label).slice(0, 40),
				width: measured.width,
				height: measured.height,
			})
		}
		return offenders
	}, selector)
}

/** Shell controls the 44px company target applies to on every route. */
export const SHELL_TARGET_SELECTOR =
	'header a[href], header button, nav[aria-label] a[href], nav[aria-label] button, footer a[href]'

/**
 * Sample an element's computed transform on consecutive frames, so a CSS or
 * WAAPI animation shows up as more than one distinct value. Used to prove that
 * `prefers-reduced-motion` stops transform animation.
 */
export async function sampleTransform(page: Page, selector: string, frames = 14, delayMs = 12) {
	return page.evaluate(
		async ({ selector, frames, delayMs }) => {
			const samples: string[] = []
			const element = document.querySelector(selector)
			if (!element) return samples
			for (let frame = 0; frame < frames; frame += 1) {
				await new Promise((resolve) => {
					requestAnimationFrame(() => resolve(null))
				})
				samples.push(getComputedStyle(element).transform)
				await new Promise((resolve) => setTimeout(resolve, delayMs))
			}
			return samples
		},
		{ selector, frames, delayMs },
	)
}
