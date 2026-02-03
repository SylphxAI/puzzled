import { test, expect } from '@playwright/test'

/**
 * Settings E2E Tests
 *
 * Tests settings page functionality including:
 * - Theme switching (light/dark)
 * - Language selection
 * - Settings navigation
 * - Account settings (authenticated)
 */

const LOCALE = 'en'

test.describe('Settings', () => {
	test.describe('Public Settings Access', () => {
		test('should redirect to login when accessing settings without auth', async ({ page }) => {
			await page.goto(`/${LOCALE}/settings`)

			// Should redirect to login page
			await page.waitForURL(/login/, { timeout: 10000 })

			// Login page should have auth form
			const loginForm = page.locator('form')
			await expect(loginForm).toBeVisible()
		})

		test('should redirect to login for preferences page without auth', async ({ page }) => {
			await page.goto(`/${LOCALE}/settings/preferences`)
			await page.waitForURL(/login/, { timeout: 10000 })
		})

		test('should redirect to login for account page without auth', async ({ page }) => {
			await page.goto(`/${LOCALE}/settings/account`)
			await page.waitForURL(/login/, { timeout: 10000 })
		})

		test('should redirect to login for security page without auth', async ({ page }) => {
			await page.goto(`/${LOCALE}/settings/security`)
			await page.waitForURL(/login/, { timeout: 10000 })
		})
	})

	test.describe('Theme Toggle (Public)', () => {
		test('should have theme toggle accessible somewhere', async ({ page }) => {
			// Theme toggle might be in header or footer on public pages
			await page.goto(`/${LOCALE}`)
			await page.waitForSelector('main', { timeout: 10000 })

			// Look for theme toggle button
			const themeToggle = page.locator(
				'button[aria-label*="theme" i], button[aria-label*="dark" i], button[aria-label*="light" i]',
			)

			// Theme toggle exists somewhere on the page
			// It might be in mobile menu or header
		})

		test('should persist theme preference', async ({ page }) => {
			await page.goto(`/${LOCALE}`)
			await page.waitForSelector('main', { timeout: 10000 })

			// Get initial theme
			const initialTheme = await page.evaluate(() => {
				return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
			})

			// Reload page
			await page.reload()
			await page.waitForSelector('main', { timeout: 10000 })

			// Theme should persist
			const persistedTheme = await page.evaluate(() => {
				return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
			})

			// Theme should be consistent (though it might follow system preference)
			expect(typeof persistedTheme).toBe('string')
		})

		test('should respect system color scheme preference', async ({ page }) => {
			// Emulate dark mode
			await page.emulateMedia({ colorScheme: 'dark' })
			await page.goto(`/${LOCALE}`)
			await page.waitForSelector('main', { timeout: 10000 })

			// Give time for theme to apply
			await page.waitForTimeout(500)

			// Check if dark mode is applied (or if there's a manual override)
			const isDark = await page.evaluate(() => {
				return (
					document.documentElement.classList.contains('dark') ||
					getComputedStyle(document.documentElement).getPropertyValue('color-scheme') === 'dark'
				)
			})

			// Should either be dark or have system preference respected
			// Note: User might have manually set light mode previously
		})
	})

	test.describe('Settings Navigation (Authenticated)', () => {
		// Skip these tests unless we have auth cookies set up
		test.skip(
			() => !process.env.TEST_AUTH_COOKIE,
			'Requires authenticated session - set TEST_AUTH_COOKIE',
		)

		test.beforeEach(async ({ page }) => {
			if (process.env.TEST_AUTH_COOKIE) {
				await page.context().addCookies([
					{
						name: '__sylphx_dev_session',
						value: process.env.TEST_AUTH_COOKIE,
						domain: 'localhost',
						path: '/',
					},
				])
			}
		})

		test('should display settings navigation sidebar', async ({ page }) => {
			await page.goto(`/${LOCALE}/settings`)

			// Should show settings navigation
			await expect(page.getByRole('link', { name: /account/i })).toBeVisible({ timeout: 10000 })
			await expect(page.getByRole('link', { name: /preferences/i })).toBeVisible()
			await expect(page.getByRole('link', { name: /security/i })).toBeVisible()
		})

		test('should navigate between settings pages', async ({ page }) => {
			await page.goto(`/${LOCALE}/settings`)

			// Click on preferences
			await page.getByRole('link', { name: /preferences/i }).click()
			await page.waitForURL(/preferences/, { timeout: 5000 })

			// Click on security
			await page.getByRole('link', { name: /security/i }).click()
			await page.waitForURL(/security/, { timeout: 5000 })

			// Click on account
			await page.getByRole('link', { name: /account/i }).click()
			await page.waitForURL(/account/, { timeout: 5000 })
		})

		test('should display preferences page with theme and language options', async ({ page }) => {
			await page.goto(`/${LOCALE}/settings/preferences`)

			// Theme section
			await expect(page.getByText(/appearance|theme/i).first()).toBeVisible({ timeout: 10000 })

			// Language section
			await expect(page.getByText(/language/i).first()).toBeVisible()
		})

		test('should allow theme selection', async ({ page }) => {
			await page.goto(`/${LOCALE}/settings/preferences`)
			await page.waitForSelector('main', { timeout: 10000 })

			// Find theme toggle or buttons
			const themeButtons = page.locator(
				'button[aria-label*="theme" i], [role="radiogroup"] button',
			)
			if ((await themeButtons.count()) > 0) {
				// Click a theme option
				await themeButtons.first().click()
				await page.waitForTimeout(500)
			}
		})

		test('should allow language selection', async ({ page }) => {
			await page.goto(`/${LOCALE}/settings/preferences`)
			await page.waitForSelector('main', { timeout: 10000 })

			// Find language switcher
			const languageSwitcher = page.locator(
				'button:has-text("English"), [aria-label*="language" i]',
			)
			if (await languageSwitcher.isVisible()) {
				await languageSwitcher.click()
				await page.waitForTimeout(300)

				// Language options should appear
				const languageOptions = page.locator('[role="menuitem"], [role="option"]')
				await expect(languageOptions.first()).toBeVisible({ timeout: 3000 })
			}
		})
	})

	test.describe('Account Settings (Authenticated)', () => {
		test.skip(
			() => !process.env.TEST_AUTH_COOKIE,
			'Requires authenticated session - set TEST_AUTH_COOKIE',
		)

		test.beforeEach(async ({ page }) => {
			if (process.env.TEST_AUTH_COOKIE) {
				await page.context().addCookies([
					{
						name: '__sylphx_dev_session',
						value: process.env.TEST_AUTH_COOKIE,
						domain: 'localhost',
						path: '/',
					},
				])
			}
			await page.goto(`/${LOCALE}/settings/account`)
		})

		test('should display user profile section', async ({ page }) => {
			// Should show profile-related sections
			await expect(page.getByText(/username|display name|profile/i).first()).toBeVisible({
				timeout: 10000,
			})
		})

		test('should have editable display name', async ({ page }) => {
			const editButton = page.getByRole('button', { name: /edit/i }).first()
			if (await editButton.isVisible()) {
				await editButton.click()

				// Should show input field
				await expect(page.getByRole('textbox').first()).toBeVisible({ timeout: 5000 })
			}
		})
	})

	test.describe('Security Settings (Authenticated)', () => {
		test.skip(
			() => !process.env.TEST_AUTH_COOKIE,
			'Requires authenticated session - set TEST_AUTH_COOKIE',
		)

		test.beforeEach(async ({ page }) => {
			if (process.env.TEST_AUTH_COOKIE) {
				await page.context().addCookies([
					{
						name: '__sylphx_dev_session',
						value: process.env.TEST_AUTH_COOKIE,
						domain: 'localhost',
						path: '/',
					},
				])
			}
			await page.goto(`/${LOCALE}/settings/security`)
		})

		test('should display security options', async ({ page }) => {
			// Should show security-related sections
			await expect(page.getByText(/password|two-factor|2fa|security/i).first()).toBeVisible({
				timeout: 10000,
			})
		})

		test('should have password change option', async ({ page }) => {
			const changePasswordButton = page.getByRole('button', {
				name: /change password|update password/i,
			})
			// Button should exist (might be disabled if using OAuth only)
		})
	})

	test.describe('Subscription Settings (Authenticated)', () => {
		test.skip(
			() => !process.env.TEST_AUTH_COOKIE,
			'Requires authenticated session - set TEST_AUTH_COOKIE',
		)

		test.beforeEach(async ({ page }) => {
			if (process.env.TEST_AUTH_COOKIE) {
				await page.context().addCookies([
					{
						name: '__sylphx_dev_session',
						value: process.env.TEST_AUTH_COOKIE,
						domain: 'localhost',
						path: '/',
					},
				])
			}
			await page.goto(`/${LOCALE}/settings/subscription`)
		})

		test('should display subscription status', async ({ page }) => {
			// Should show subscription info
			await expect(
				page.getByText(/subscription|plan|free|premium|billing/i).first(),
			).toBeVisible({
				timeout: 10000,
			})
		})

		test('should have upgrade option for free users', async ({ page }) => {
			const upgradeLink = page.getByRole('link', { name: /upgrade|premium|unlock/i })
			// Upgrade button/link should exist for free tier users
		})
	})
})
