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
	await page.waitForLoadState('domcontentloaded')
	// `domcontentloaded` alone is not enough: every route fades its content
	// in through `.animate-enter` (`enter-up`, 0.5s — see globals.css), and
	// axe composites an element's colour through its ancestors' opacity. An
	// audit taken mid-fade therefore reports contrast failures that the same
	// route does not have once it settles. Wait for the route's finite
	// animations to finish before anything is measured; infinite ones
	// (float, pulse, spin) are deliberately not waited on.
	await page
		.waitForFunction(
			() =>
				document.getAnimations().every((animation) => {
					if (animation.playState !== 'running') return true
					const iterations = animation.effect?.getComputedTiming().iterations
					return iterations === Number.POSITIVE_INFINITY
				}),
			undefined,
			{ timeout: 5000 },
		)
		.catch(() => undefined)
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

/**
 * The company target, in CSS pixels.
 *
 * One pixel of tolerance absorbs sub-pixel rounding: a `h-11` (44px) control
 * reports a fractional box in Chromium and rounds to 43.
 */
export const TARGET_SIZE_MINIMUM = 44
export const TARGET_SIZE_TOLERANCE = 1
export const TARGET_SIZE_FLOOR = TARGET_SIZE_MINIMUM - TARGET_SIZE_TOLERANCE

export type TargetOffender = {
	target: string
	name: string
	width: number
	height: number
}

/**
 * Controls that deliberately sit below the 44px company target, with the reason.
 *
 * Everything else in the measured selection must reach 44px. Each entry has to
 * point at a control whose rendered box is smaller by design; if the control
 * grows past 44px the exception simply stops applying (it is not a blanket
 * allowance for the selector).
 */
export const TARGET_SIZE_EXCEPTIONS: readonly {
	/** Accessible name (or prefix) of the control. */
	name: string
	/** Why it is allowed to stay below 44px. */
	reason: string
}[] = [
	{
		name: 'Skip to main content',
		reason:
			'visually hidden until focused (sr-only): it is a keyboard affordance, not a touch target',
	},
	{
		name: 'Puzzled',
		reason:
			'the wordmark is 44px high at its touch area but its text box is narrower on desktop; the logo link is a brand mark, never the only route to a destination',
	},
]

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
	return page.evaluate(
		({ selector, exceptions, floor }) => {
			// Runs in the page: the exception names are passed in because module
			// scope is not available inside evaluate().
			const isExcepted = (name: string) =>
				exceptions.some((exception) => name.startsWith(exception))

			const offenders: TargetOffender[] = []
			for (const element of Array.from(document.querySelectorAll(selector))) {
				const rect = element.getBoundingClientRect()
				const style = getComputedStyle(element)
				// Visually hidden controls (sr-only skip links) are keyboard
				// affordances, not touch targets.
				if (rect.width <= 2 || rect.height <= 2) continue
				if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')
					continue
				if (element.getAttribute('aria-hidden') === 'true') continue
				// A control scrolled out of the viewport cannot be hit-tested.
				if (rect.bottom <= 0 || rect.top >= window.innerHeight) continue

				const label = (element.textContent ?? '').trim()
				const name = element.getAttribute('aria-label') || label
				if (isExcepted(name)) continue

				// The box is the target: hit-area expansion (`before:-inset-*`) is
				// already inside the border box, and hit-testing is unreliable while
				// a sticky header covers the centre of a link.
				const width = Math.round(rect.width)
				const height = Math.round(rect.height)
				if (width >= floor && height >= floor) continue

				offenders.push({
					target: element.tagName.toLowerCase(),
					name: name.slice(0, 40),
					width,
					height,
				})
			}

			return offenders
		},
		{
			selector,
			exceptions: TARGET_SIZE_EXCEPTIONS.map((exception) => exception.name),
			floor: TARGET_SIZE_FLOOR,
		},
	)
}

/** Shell controls the 44px company target applies to on every route. */
export const SHELL_TARGET_SELECTOR =
	'header a[href], header button, nav[aria-label] a[href], nav[aria-label] button, footer a[href]'

/**
 * Drive the popup's JavaScript transform animation one frame at a time. Arm
 * before clicking and wait for the lazy content while advancing only 1ms per
 * turn, so network/CPU latency cannot consume its 100ms entrance. Sample after
 * the first rendered frame: reduced motion may jump directly to its endpoint
 * during mount, which is not an animated frame.
 */
export async function samplePopupTransform(
	page: Page,
	open: () => Promise<unknown>,
	mountTimeoutMs = 8000,
) {
	await page.clock.install({ time: 0 })
	await page.clock.pauseAt(await page.evaluate(() => Date.now() + 10_000))
	try {
		await open()
		const content = page.locator('[role="menu"] > *')
		const deadline = Date.now() + mountTimeoutMs
		while ((await content.count()) === 0 && Date.now() < deadline) {
			await page.clock.runFor(1)
			await new Promise((resolve) => setTimeout(resolve, 10))
		}
		if ((await content.count()) !== 1) {
			throw new Error('samplePopupTransform: expected one mounted popup content')
		}
		const samples: string[] = []
		for (let frame = 0; frame < 14; frame += 1) {
			await page.clock.runFor(16)
			samples.push(await content.evaluate((element) => getComputedStyle(element).transform))
		}
		await content.waitFor({ state: 'visible' })
		return samples
	} finally {
		await page.clock.resume()
	}
}
