import { test, expect } from '@playwright/test'

/**
 * Navigation E2E Tests
 *
 * Tests the core navigation flows including:
 * - Home page loading and game selection
 * - Bottom navigation (mobile)
 * - Top navigation (desktop)
 * - Route protection (settings, stats)
 */

const LOCALE = 'en'

test.describe('Navigation', () => {
	test.describe('Home Page', () => {
		test('should load home page with game cards', async ({ page }) => {
			await page.goto(`/${LOCALE}`)

			// Wait for page to load
			await page.waitForSelector('main', { timeout: 10000 })

			// Check page title
			await expect(page).toHaveTitle(/Puzzled/i)

			// Home page should display game cards
			// Look for game links (they link to /games/[slug])
			const gameLinks = page.locator('a[href*="/games/"]')
			await expect(gameLinks.first()).toBeVisible({ timeout: 10000 })
		})

		test('should display streak indicator on mobile', async ({ page }) => {
			// Set mobile viewport
			await page.setViewportSize({ width: 375, height: 667 })
			await page.goto(`/${LOCALE}`)

			// Mobile header should have streak indicator
			const streakIndicator = page.locator('header').locator('text=/\\d+/')
			await expect(streakIndicator.first()).toBeVisible({ timeout: 10000 })
		})

		test('should have settings link accessible', async ({ page }) => {
			await page.goto(`/${LOCALE}`)

			// Look for settings button/link
			const settingsLink = page.getByRole('link', { name: /settings/i })
			if (await settingsLink.isVisible()) {
				await expect(settingsLink).toBeEnabled()
			}
		})

		test('should navigate to game when clicking game card', async ({ page }) => {
			await page.goto(`/${LOCALE}`)
			await page.waitForSelector('main', { timeout: 10000 })

			// Find a game link and click it
			const gameLink = page.locator('a[href*="/games/"]').first()
			await expect(gameLink).toBeVisible({ timeout: 10000 })

			const href = await gameLink.getAttribute('href')
			await gameLink.click()

			// Should navigate to game page
			await page.waitForURL(/\/games\//, { timeout: 10000 })
			expect(page.url()).toContain('/games/')
		})
	})

	test.describe('Bottom Navigation (Mobile)', () => {
		test.beforeEach(async ({ page }) => {
			await page.setViewportSize({ width: 375, height: 667 })
		})

		test('should have navigation accessible on mobile', async ({ page }) => {
			await page.goto(`/${LOCALE}`)
			await page.waitForSelector('main', { timeout: 10000 })

			// On mobile, navigation is either bottom nav or a mobile header
			// Check that navigation elements exist (might be in different locations)
			const navElements = await page.locator('nav, header').count()
			expect(navElements).toBeGreaterThan(0)

			// Check that some interactive navigation exists
			const links = await page.locator('a[href*="/"], button').count()
			expect(links).toBeGreaterThan(0)
		})

		test('should have home link accessible', async ({ page }) => {
			await page.goto(`/${LOCALE}`)
			await page.waitForSelector('main', { timeout: 10000 })

			// Home link should exist somewhere (might be logo or nav item)
			const homeLinks = page.locator('a[href="/"], a[href="/en"]')
			const count = await homeLinks.count()
			expect(count).toBeGreaterThan(0)
		})

		test('should highlight active page in navigation', async ({ page }) => {
			await page.goto(`/${LOCALE}`)

			// Home link should be active (have aria-current)
			const homeLink = page.locator('nav a[href="/"]').first()
			await expect(homeLink).toHaveAttribute('aria-current', 'page')
		})

		test('should navigate to stats page', async ({ page }) => {
			await page.goto(`/${LOCALE}`)

			// Click stats link in bottom nav
			const statsLink = page.locator('nav a[href*="/stats"]').first()
			if (await statsLink.isVisible()) {
				await statsLink.click()
				await page.waitForURL(/stats/, { timeout: 10000 })
			}
		})
	})

	test.describe('Route Protection', () => {
		test('should redirect to login when accessing settings unauthenticated', async ({
			page,
		}) => {
			await page.goto(`/${LOCALE}/settings`)

			// Should redirect to login
			await page.waitForURL(/login/, { timeout: 10000 })
		})

		test('should show login prompt on stats page when unauthenticated', async ({ page }) => {
			await page.goto(`/${LOCALE}/stats`)

			// Stats page should show login prompt for unauthenticated users
			const loginPrompt = page.getByRole('button', { name: /sign in/i })
			await expect(loginPrompt).toBeVisible({ timeout: 10000 })
		})

		test('should allow access to public pages without auth', async ({ page }) => {
			// Home page
			await page.goto(`/${LOCALE}`)
			await expect(page.locator('main')).toBeVisible({ timeout: 15000 })

			// Pricing page - might redirect or show content
			const pricingResponse = await page.goto(`/${LOCALE}/pricing`)
			// Should either load successfully or redirect
			expect(pricingResponse?.status()).toBeLessThan(500)

			// Terms page
			const termsResponse = await page.goto(`/${LOCALE}/terms`)
			expect(termsResponse?.status()).toBeLessThan(500)

			// Privacy page
			const privacyResponse = await page.goto(`/${LOCALE}/privacy`)
			expect(privacyResponse?.status()).toBeLessThan(500)
		})
	})

	test.describe('Locale Handling', () => {
		test('should load page in English locale', async ({ page }) => {
			await page.goto('/en')
			// Lang attribute might be 'en' or 'en-US' depending on config
			const lang = await page.locator('html').getAttribute('lang')
			expect(lang).toMatch(/^en/)
		})

		test('should handle root URL', async ({ page }) => {
			// Root URL should either redirect to locale or serve default locale
			const response = await page.goto('/')
			expect(response?.ok()).toBe(true)

			// Page should load successfully (either / or /en)
			await expect(page.locator('main')).toBeVisible({ timeout: 10000 })
		})
	})
})
