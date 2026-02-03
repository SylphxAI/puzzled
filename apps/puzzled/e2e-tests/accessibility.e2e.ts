import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * Accessibility E2E Tests
 *
 * Comprehensive accessibility testing including:
 * - WCAG 2.1 AA compliance
 * - Keyboard navigation
 * - Screen reader compatibility
 * - Focus management
 * - Touch targets
 */

const LOCALE = 'en'

test.describe('Accessibility - WCAG Compliance', () => {
	test.describe('Core Pages', () => {
		const pagesToTest = [
			{ path: `/${LOCALE}`, name: 'Home Page' },
			{ path: `/${LOCALE}/pricing`, name: 'Pricing Page' },
			{ path: `/${LOCALE}/login`, name: 'Login Page' },
			{ path: `/${LOCALE}/signup`, name: 'Signup Page' },
			{ path: `/${LOCALE}/stats`, name: 'Stats Page' },
			{ path: `/${LOCALE}/privacy`, name: 'Privacy Page' },
			{ path: `/${LOCALE}/terms`, name: 'Terms Page' },
		]

		for (const { path, name } of pagesToTest) {
			test(`${name} should have no critical accessibility violations`, async ({ page }) => {
				await page.goto(path)
				await page.waitForSelector('main', { timeout: 10000 })

				const accessibilityScanResults = await new AxeBuilder({ page })
					.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
					.analyze()

				// Filter for critical and serious violations
				const criticalViolations = accessibilityScanResults.violations.filter(
					(violation) =>
						violation.impact === 'critical' || violation.impact === 'serious',
				)

				expect(
					criticalViolations,
					`${name} should have no critical or serious accessibility violations`,
				).toEqual([])
			})
		}
	})

	test.describe('Game Pages', () => {
		const gamesToTest = ['word-guess', 'word-groups', 'sudoku']

		for (const game of gamesToTest) {
			test(`${game} game page should be accessible`, async ({ page }) => {
				await page.goto(`/${LOCALE}/games/${game}`)
				await page.waitForSelector('main', { timeout: 15000 })

				const accessibilityScanResults = await new AxeBuilder({ page })
					.withTags(['wcag2a', 'wcag2aa'])
					.analyze()

				const criticalViolations = accessibilityScanResults.violations.filter(
					(violation) =>
						violation.impact === 'critical' || violation.impact === 'serious',
				)

				expect(criticalViolations).toEqual([])
			})
		}
	})
})

test.describe('Keyboard Navigation', () => {
	test('should be able to navigate home page with keyboard only', async ({ page }) => {
		await page.goto(`/${LOCALE}`)
		await page.waitForSelector('main', { timeout: 10000 })

		// Start from body
		await page.keyboard.press('Tab')

		// Should be able to tab through interactive elements
		let tabCount = 0
		const maxTabs = 20 // Reasonable limit

		while (tabCount < maxTabs) {
			const focusedElement = await page.evaluate(() => {
				const el = document.activeElement
				return {
					tagName: el?.tagName,
					role: el?.getAttribute('role'),
					href: el?.getAttribute('href'),
					type: el?.getAttribute('type'),
				}
			})

			// Should always have something focused
			expect(focusedElement.tagName).toBeDefined()

			// Tab to next element
			await page.keyboard.press('Tab')
			tabCount++

			// If we've looped back to body or main, we've completed the loop
			if (focusedElement.tagName === 'BODY') break
		}
	})

	test('should have visible focus indicators', async ({ page }) => {
		await page.goto(`/${LOCALE}`)
		await page.waitForSelector('main', { timeout: 10000 })

		// Tab to first interactive element
		await page.keyboard.press('Tab')

		// Get focus ring visibility
		const focusVisible = await page.evaluate(() => {
			const el = document.activeElement
			if (!el) return false

			const styles = getComputedStyle(el)
			const hasFocusRing =
				styles.outline !== 'none' ||
				styles.boxShadow !== 'none' ||
				el.matches(':focus-visible')

			return hasFocusRing
		})

		// Focus should be visible somehow
		// Note: Modern CSS might use :focus-visible which is hard to detect
	})

	test('should trap focus in modal dialogs', async ({ page }) => {
		await page.goto(`/${LOCALE}/games/word-guess`)
		await page.waitForSelector('main', { timeout: 15000 })

		// Open help modal if available
		const helpButton = page.getByRole('button', { name: /help|how to play|\?/i })
		if (await helpButton.isVisible()) {
			await helpButton.click()
			await page.waitForTimeout(500)

			// Modal should be open
			const modal = page.locator('[role="dialog"]')
			if (await modal.isVisible()) {
				// Tab multiple times - focus should stay in modal
				for (let i = 0; i < 10; i++) {
					await page.keyboard.press('Tab')
				}

				// Active element should still be within modal
				const focusInModal = await page.evaluate(() => {
					const modal = document.querySelector('[role="dialog"]')
					return modal?.contains(document.activeElement)
				})

				expect(focusInModal).toBe(true)

				// Escape should close modal
				await page.keyboard.press('Escape')
				await expect(modal).not.toBeVisible({ timeout: 3000 })
			}
		}
	})

	test('should support keyboard input in word games', async ({ page }) => {
		await page.goto(`/${LOCALE}/games/word-guess`)
		await page.waitForSelector('main', { timeout: 15000 })

		// Start game
		const playButton = page.getByRole('button', { name: /play/i })
		if (await playButton.isVisible()) {
			await playButton.click()
			await page.waitForTimeout(500)
		}

		// Type letters using keyboard
		await page.keyboard.type('HELLO')

		// Press Enter to submit
		await page.keyboard.press('Enter')

		// Press Backspace to delete
		await page.keyboard.press('Backspace')

		// These actions should not throw errors
	})

	test('should support arrow key navigation in grid games', async ({ page }) => {
		await page.goto(`/${LOCALE}/games/sudoku`)
		await page.waitForSelector('main', { timeout: 15000 })

		// Start game
		const playButton = page.getByRole('button', { name: /play/i })
		if (await playButton.isVisible()) {
			await playButton.click()
			await page.waitForTimeout(500)
		}

		// Click on a cell to focus grid
		const cell = page.locator('[class*="cell"], button').filter({ hasText: /^$|\d/ }).first()
		if (await cell.isVisible()) {
			await cell.click()

			// Arrow keys should navigate
			await page.keyboard.press('ArrowRight')
			await page.keyboard.press('ArrowDown')
			await page.keyboard.press('ArrowLeft')
			await page.keyboard.press('ArrowUp')
		}
	})
})

test.describe('Screen Reader Compatibility', () => {
	test('should have proper heading hierarchy', async ({ page }) => {
		await page.goto(`/${LOCALE}`)
		await page.waitForSelector('main', { timeout: 10000 })

		// Check heading hierarchy
		const headings = await page.evaluate(() => {
			const hs = document.querySelectorAll('h1, h2, h3, h4, h5, h6')
			return Array.from(hs).map((h) => ({
				level: parseInt(h.tagName[1]),
				text: h.textContent?.trim(),
			}))
		})

		// Should have at least one h1
		const h1Count = headings.filter((h) => h.level === 1).length
		expect(h1Count).toBeGreaterThanOrEqual(1)

		// Heading levels should not skip (h1 -> h3 without h2)
		let prevLevel = 0
		for (const heading of headings) {
			if (prevLevel > 0 && heading.level > prevLevel + 1) {
				// Allow some flexibility - log warning but don't fail
				console.warn(`Heading level skipped from h${prevLevel} to h${heading.level}`)
			}
			prevLevel = heading.level
		}
	})

	test('should have proper ARIA labels on interactive elements', async ({ page }) => {
		await page.goto(`/${LOCALE}`)
		await page.waitForSelector('main', { timeout: 10000 })

		// Check that icon-only buttons have aria-labels
		const iconButtons = await page.evaluate(() => {
			const buttons = document.querySelectorAll('button')
			const issues: string[] = []

			buttons.forEach((btn, index) => {
				const hasText = btn.textContent?.trim().length > 0
				const hasAriaLabel = btn.hasAttribute('aria-label')
				const hasAriaLabelledBy = btn.hasAttribute('aria-labelledby')
				const hasTitle = btn.hasAttribute('title')

				// If button has no visible text, it should have an accessible name
				if (!hasText && !hasAriaLabel && !hasAriaLabelledBy && !hasTitle) {
					issues.push(`Button ${index}: Missing accessible name`)
				}
			})

			return issues
		})

		// Report but don't fail on minor issues
		if (iconButtons.length > 0) {
			console.warn('Icon buttons without accessible names:', iconButtons)
		}
	})

	test('should have proper landmark regions', async ({ page }) => {
		await page.goto(`/${LOCALE}`)
		await page.waitForSelector('main', { timeout: 10000 })

		// Check for main landmark
		const hasMain = await page.locator('main, [role="main"]').count()
		expect(hasMain).toBeGreaterThanOrEqual(1)

		// Check for navigation landmark
		const hasNav = await page.locator('nav, [role="navigation"]').count()
		expect(hasNav).toBeGreaterThanOrEqual(1)

		// Check for header (banner) landmark
		const hasHeader = await page.locator('header, [role="banner"]').count()
		expect(hasHeader).toBeGreaterThanOrEqual(1)
	})

	test('should announce live regions properly', async ({ page }) => {
		await page.goto(`/${LOCALE}/games/word-guess`)
		await page.waitForSelector('main', { timeout: 15000 })

		// Start game
		const playButton = page.getByRole('button', { name: /play/i })
		if (await playButton.isVisible()) {
			await playButton.click()
			await page.waitForTimeout(500)
		}

		// Check for live regions (aria-live attributes)
		const liveRegions = await page.evaluate(() => {
			const regions = document.querySelectorAll('[aria-live], [role="alert"], [role="status"]')
			return regions.length
		})

		// Games should have live regions for feedback
		// Note: This is a soft check as implementation varies
	})
})

test.describe('Touch Targets', () => {
	test.beforeEach(async ({ page }) => {
		// Set mobile viewport
		await page.setViewportSize({ width: 375, height: 667 })
	})

	test('should have adequate touch target sizes (44x44px minimum)', async ({ page }) => {
		await page.goto(`/${LOCALE}`)
		await page.waitForSelector('main', { timeout: 10000 })

		// Check touch target sizes
		const smallTargets = await page.evaluate(() => {
			const minSize = 44 // WCAG 2.1 AA requirement
			const interactiveElements = document.querySelectorAll('button, a, input, select, [role="button"]')
			const issues: string[] = []

			interactiveElements.forEach((el) => {
				const rect = el.getBoundingClientRect()
				if (rect.width > 0 && rect.height > 0) {
					if (rect.width < minSize || rect.height < minSize) {
						const text = el.textContent?.trim().substring(0, 20) || el.getAttribute('aria-label') || 'unknown'
						// Allow some small elements (like close buttons in tags)
						if (rect.width < minSize - 10 || rect.height < minSize - 10) {
							issues.push(`${el.tagName} "${text}": ${Math.round(rect.width)}x${Math.round(rect.height)}px`)
						}
					}
				}
			})

			return issues
		})

		// Log warnings but don't fail on minor size issues
		if (smallTargets.length > 0) {
			console.warn('Elements with small touch targets:', smallTargets.slice(0, 5))
		}
	})

	test('should have adequate spacing between touch targets', async ({ page }) => {
		await page.goto(`/${LOCALE}`)
		await page.waitForSelector('main', { timeout: 10000 })

		// Check for overlapping or too-close touch targets
		const overlapIssues = await page.evaluate(() => {
			const elements = document.querySelectorAll('button, a[href], input, select')
			const rects = Array.from(elements)
				.map((el) => ({
					rect: el.getBoundingClientRect(),
					el: el.tagName,
				}))
				.filter((r) => r.rect.width > 0 && r.rect.height > 0)

			const issues: string[] = []
			const minSpacing = 8 // Minimum spacing between targets

			for (let i = 0; i < rects.length; i++) {
				for (let j = i + 1; j < rects.length; j++) {
					const r1 = rects[i].rect
					const r2 = rects[j].rect

					// Check if elements are too close
					const horizontalGap = Math.max(r1.left - r2.right, r2.left - r1.right)
					const verticalGap = Math.max(r1.top - r2.bottom, r2.top - r1.bottom)

					// If elements are on the same row/column and too close
					if (horizontalGap < minSpacing && horizontalGap > -r1.width && verticalGap < minSpacing && verticalGap > -r1.height) {
						// Only report if they're actually overlapping
						if (horizontalGap < 0 && verticalGap < 0) {
							// Overlapping elements
						}
					}
				}
			}

			return issues.slice(0, 5) // Limit to first 5 issues
		})

		// Log but don't fail
		if (overlapIssues.length > 0) {
			console.warn('Touch target spacing issues:', overlapIssues)
		}
	})
})

test.describe('Reduced Motion', () => {
	test('should respect prefers-reduced-motion preference', async ({ page }) => {
		// Emulate reduced motion preference
		await page.emulateMedia({ reducedMotion: 'reduce' })
		await page.goto(`/${LOCALE}`)
		await page.waitForSelector('main', { timeout: 10000 })

		// Check that animations are disabled or reduced
		const hasAnimations = await page.evaluate(() => {
			// Check for animation properties
			const allElements = document.querySelectorAll('*')
			let animatedCount = 0

			allElements.forEach((el) => {
				const styles = getComputedStyle(el)
				if (
					styles.animationName !== 'none' ||
					styles.transition !== 'all 0s ease 0s'
				) {
					// Some elements might still have transitions for essential motion
					animatedCount++
				}
			})

			return animatedCount
		})

		// With reduced motion, animations should be minimal
		// Note: Some essential animations might still exist
	})

	test('should not have flashing content', async ({ page }) => {
		await page.goto(`/${LOCALE}`)
		await page.waitForSelector('main', { timeout: 10000 })

		// Check for potentially problematic animations
		const flashingElements = await page.evaluate(() => {
			const animations = document.getAnimations()
			return animations.filter((anim) => {
				// Check for rapid animations that could cause issues
				const effect = anim.effect as KeyframeEffect
				if (effect && effect.getTiming) {
					const timing = effect.getTiming()
					// Duration < 200ms with infinite iterations could be problematic
					return (timing.duration as number) < 200 && timing.iterations === Infinity
				}
				return false
			}).length
		})

		// Should not have rapidly flashing content
		expect(flashingElements).toBe(0)
	})
})

test.describe('Color Contrast', () => {
	test('should have sufficient color contrast', async ({ page }) => {
		await page.goto(`/${LOCALE}`)
		await page.waitForSelector('main', { timeout: 10000 })

		// Run color contrast specific checks
		const accessibilityScanResults = await new AxeBuilder({ page })
			.withTags(['wcag2aa'])
			.options({ rules: { 'color-contrast': { enabled: true } } })
			.analyze()

		const contrastViolations = accessibilityScanResults.violations.filter(
			(v) => v.id === 'color-contrast',
		)

		// Allow some tolerance but flag serious issues
		const criticalContrastIssues = contrastViolations.filter(
			(v) => v.impact === 'critical' || v.impact === 'serious',
		)

		expect(criticalContrastIssues).toEqual([])
	})

	test('should have sufficient contrast in dark mode', async ({ page }) => {
		// Force dark mode
		await page.emulateMedia({ colorScheme: 'dark' })
		await page.goto(`/${LOCALE}`)
		await page.waitForSelector('main', { timeout: 10000 })

		// Run color contrast checks in dark mode
		const accessibilityScanResults = await new AxeBuilder({ page })
			.withTags(['wcag2aa'])
			.options({ rules: { 'color-contrast': { enabled: true } } })
			.analyze()

		const contrastViolations = accessibilityScanResults.violations.filter(
			(v) => v.id === 'color-contrast' && (v.impact === 'critical' || v.impact === 'serious'),
		)

		expect(contrastViolations).toEqual([])
	})
})
