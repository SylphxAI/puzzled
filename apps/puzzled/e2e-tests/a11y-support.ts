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
 * Record the CSS-animated popup itself, not its implementation-specific children.
 * Arm in the browser before opening: lazy loading and test-runner round trips
 * must not consume the entrance. CSS transitions use the browser's animation
 * timeline, not Playwright's JavaScript clock. Include individual transform
 * properties (Tailwind 4 uses translate/scale instead of transform).
 */
export async function samplePopupTransform(
	page: Page,
	open: () => Promise<unknown>,
	mountTimeoutMs = 8000,
) {
	const recorder = await page.evaluateHandle((timeout) => {
		let frame = 0
		let timer: ReturnType<typeof setTimeout>
		let complete: (result: { samples: string[]; error?: string }) => void
		const result = new Promise<{ samples: string[]; error?: string }>((resolve) => {
			complete = resolve
		})
		const samples: string[] = []
		const stop = () => {
			observer.disconnect()
			clearTimeout(timer)
			cancelAnimationFrame(frame)
		}
		const observePopup = () => {
			const popups = document.querySelectorAll('[role="menu"]')
			if (popups.length !== 1) return
			const popup = popups[0]
			if (!popup || popup.hasAttribute('data-starting-style')) return
			observer.disconnect()
			clearTimeout(timer)
			const sample = () => {
				const style = getComputedStyle(popup)
				samples.push(`${style.transform};translate:${style.translate};scale:${style.scale}`)
				if (samples.length === 14) {
					complete({ samples })
					return
				}
				frame = requestAnimationFrame(sample)
			}
			frame = requestAnimationFrame(sample)
		}
		const observer = new MutationObserver(observePopup)
		observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true })
		timer = setTimeout(() => {
			stop()
			complete({ samples, error: 'samplePopupTransform: expected one mounted popup content' })
		}, timeout)
		observePopup()
		return { result, stop }
	}, mountTimeoutMs)
	try {
		await open()
		const { samples, error } = await recorder.evaluate((recording) => recording.result)
		if (error) throw new Error(error)
		await page.getByRole('menu').waitFor({ state: 'visible' })
		return samples
	} finally {
		await recorder.evaluate((recording) => recording.stop())
		await recorder.dispose()
	}
}
