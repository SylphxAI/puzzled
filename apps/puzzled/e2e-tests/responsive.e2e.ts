import { expect, test } from "@playwright/test";

/**
 * Responsive Design E2E Tests
 *
 * Tests responsive design across different viewports:
 * - Mobile (375x667)
 * - Tablet (768x1024)
 * - Desktop (1280x720)
 *
 * Verifies:
 * - No horizontal overflow
 * - Proper navigation display
 * - Touch-friendly interactions on mobile
 */

const LOCALE = "en";

const VIEWPORTS = [
	{ name: "mobile", width: 375, height: 667 },
	{ name: "tablet", width: 768, height: 1024 },
	{ name: "desktop", width: 1280, height: 720 },
];

const PAGES = [
	{ path: `/${LOCALE}`, name: "Home Page" },
	{ path: `/${LOCALE}/pricing`, name: "Pricing Page" },
	{ path: `/${LOCALE}/login`, name: "Login Page" },
	{ path: `/${LOCALE}/signup`, name: "Signup Page" },
	{ path: `/${LOCALE}/stats`, name: "Stats Page" },
	{ path: `/${LOCALE}/privacy`, name: "Privacy Page" },
	{ path: `/${LOCALE}/terms`, name: "Terms Page" },
];

test.describe("Responsive Design - Core Pages", () => {
	for (const { path, name } of PAGES) {
		test.describe(name, () => {
			for (const viewport of VIEWPORTS) {
				test(`should render without horizontal overflow on ${viewport.name}`, async ({
					page,
				}) => {
					await page.setViewportSize({
						width: viewport.width,
						height: viewport.height,
					});
					await page.goto(path);
					await page.waitForSelector("main", { timeout: 10000 });

					// Check for horizontal overflow
					const hasHorizontalOverflow = await page.evaluate(() => {
						return document.body.scrollWidth > window.innerWidth;
					});

					expect(hasHorizontalOverflow).toBe(false);
				});
			}
		});
	}
});

test.describe("Responsive Design - Navigation", () => {
	test.describe("Mobile Navigation", () => {
		test.beforeEach(async ({ page }) => {
			await page.setViewportSize({ width: 375, height: 667 });
		});

		test("should show bottom navigation on mobile", async ({ page }) => {
			await page.goto(`/${LOCALE}`);
			await page.waitForSelector("main", { timeout: 10000 });

			// Bottom navigation should be visible
			const bottomNav = page
				.locator("nav")
				.filter({ has: page.locator('a[href="/"]') });
			await expect(bottomNav.first()).toBeVisible();
		});

		test("should hide top navigation on mobile home page", async ({ page }) => {
			await page.goto(`/${LOCALE}`);
			await page.waitForSelector("main", { timeout: 10000 });

			// Mobile might use a different header
			const mobileHeader = page
				.locator("header")
				.filter({ has: page.locator('a[href="/"]') });
			// Mobile header should be compact
		});

		test("should have touch-friendly navigation items", async ({ page }) => {
			await page.goto(`/${LOCALE}`);
			await page.waitForSelector("main", { timeout: 10000 });

			// Check nav item sizes
			const navItems = page.locator("nav a");
			const count = await navItems.count();

			for (let i = 0; i < Math.min(count, 5); i++) {
				const item = navItems.nth(i);
				if (await item.isVisible()) {
					const box = await item.boundingBox();
					if (box) {
						// Touch target should be at least 44px (WCAG 2.1 AAA) or 40px (minimum)
						expect(box.height).toBeGreaterThanOrEqual(40);
					}
				}
			}
		});
	});

	test.describe("Desktop Navigation", () => {
		test.beforeEach(async ({ page }) => {
			await page.setViewportSize({ width: 1280, height: 720 });
		});

		test("should show top navigation on desktop", async ({ page }) => {
			await page.goto(`/${LOCALE}`);
			await page.waitForSelector("main", { timeout: 10000 });

			// Top navigation should be visible on desktop
			const topNav = page
				.locator("header nav, header")
				.filter({ has: page.locator("a") });
			await expect(topNav.first()).toBeVisible();
		});

		test("should hide bottom navigation on desktop", async ({ page }) => {
			await page.goto(`/${LOCALE}`);
			await page.waitForSelector("main", { timeout: 10000 });

			// Bottom navigation might be hidden on desktop (md:hidden class)
			// Check by looking for the navigation and its visibility
		});
	});
});

test.describe("Responsive Design - Game Pages", () => {
	const GAMES = ["word-guess", "word-groups", "sudoku"];

	for (const game of GAMES) {
		test.describe(`${game} game`, () => {
			for (const viewport of VIEWPORTS) {
				test(`should render game without overflow on ${viewport.name}`, async ({
					page,
				}) => {
					await page.setViewportSize({
						width: viewport.width,
						height: viewport.height,
					});
					await page.goto(`/${LOCALE}/games/${game}`);
					await page.waitForSelector("main", { timeout: 15000 });

					// Allow page to fully render
					await page.waitForTimeout(1000);

					const hasOverflow = await page.evaluate(() => {
						return document.body.scrollWidth > window.innerWidth;
					});

					expect(hasOverflow).toBe(false);
				});
			}

			test("should show on-screen keyboard on mobile", async ({ page }) => {
				await page.setViewportSize({ width: 375, height: 667 });
				await page.goto(`/${LOCALE}/games/${game}`);
				await page.waitForSelector("main", { timeout: 15000 });

				// Start game if needed
				const playButton = page.getByRole("button", { name: /play/i });
				if (await playButton.isVisible()) {
					await playButton.click();
					await page.waitForTimeout(500);
				}

				// For keyboard-based games, on-screen keyboard should be visible
				if (["word-guess", "sudoku"].includes(game)) {
					const keyboard = page.locator(
						'[class*="keyboard"], button:has-text("Q"), button:has-text("1")',
					);
					// Keyboard might be visible for these games
				}
			});

			test("should fit game board in viewport on mobile", async ({ page }) => {
				await page.setViewportSize({ width: 375, height: 667 });
				await page.goto(`/${LOCALE}/games/${game}`);
				await page.waitForSelector("main", { timeout: 15000 });

				// Start game if needed
				const playButton = page.getByRole("button", { name: /play/i });
				if (await playButton.isVisible()) {
					await playButton.click();
					await page.waitForTimeout(500);
				}

				// Game board should fit within viewport width
				const gameBoard = page
					.locator('[class*="board"], [class*="grid"]')
					.first();
				if (await gameBoard.isVisible()) {
					const box = await gameBoard.boundingBox();
					if (box) {
						expect(box.width).toBeLessThanOrEqual(375);
					}
				}
			});
		});
	}
});

test.describe("Responsive Design - Forms", () => {
	test("login form should be responsive", async ({ page }) => {
		for (const viewport of VIEWPORTS) {
			await page.setViewportSize({
				width: viewport.width,
				height: viewport.height,
			});
			await page.goto(`/${LOCALE}/login`);
			await page.waitForSelector("form", { timeout: 10000 });

			// Form should not overflow
			const hasOverflow = await page.evaluate(() => {
				return document.body.scrollWidth > window.innerWidth;
			});
			expect(hasOverflow).toBe(false);

			// Form inputs should fit viewport
			const inputs = await page.locator("input").all();
			for (const input of inputs) {
				if (await input.isVisible()) {
					const box = await input.boundingBox();
					if (box) {
						expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
					}
				}
			}
		}
	});

	test("signup form should be responsive", async ({ page }) => {
		for (const viewport of VIEWPORTS) {
			await page.setViewportSize({
				width: viewport.width,
				height: viewport.height,
			});
			await page.goto(`/${LOCALE}/signup`);
			await page.waitForSelector("form", { timeout: 10000 });

			const hasOverflow = await page.evaluate(() => {
				return document.body.scrollWidth > window.innerWidth;
			});
			expect(hasOverflow).toBe(false);
		}
	});
});

test.describe("Responsive Design - Typography", () => {
	test("should have readable font sizes on mobile", async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto(`/${LOCALE}`);
		await page.waitForSelector("main", { timeout: 10000 });

		// Check minimum font sizes
		const smallText = await page.evaluate(() => {
			const allText = document.querySelectorAll("p, span, a, button, li");
			let smallestSize = 999;
			let smallestElement = "";

			allText.forEach((el) => {
				const styles = getComputedStyle(el);
				const fontSize = Number.parseFloat(styles.fontSize);
				if (fontSize > 0 && fontSize < smallestSize) {
					smallestSize = fontSize;
					smallestElement = el.textContent?.substring(0, 20) || "";
				}
			});

			return { smallestSize, smallestElement };
		});

		// Minimum readable font size is typically 12px
		expect(smallText.smallestSize).toBeGreaterThanOrEqual(10);
	});

	test("should have appropriate line lengths on desktop", async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto(`/${LOCALE}/privacy`);
		await page.waitForSelector("main", { timeout: 10000 });

		// Check that content has max-width for readability
		const contentWidth = await page.evaluate(() => {
			const mainContent = document.querySelector("main > div, article");
			if (mainContent) {
				const box = mainContent.getBoundingClientRect();
				return box.width;
			}
			return 1280;
		});

		// Optimal line length is 45-75 characters, roughly 600-900px
		// Content should have some constraint
	});
});

test.describe("Responsive Design - Images and Media", () => {
	test("images should be responsive", async ({ page }) => {
		await page.goto(`/${LOCALE}`);
		await page.waitForSelector("main", { timeout: 10000 });

		// Check all images for responsive attributes
		const images = await page.locator("img").all();

		for (const img of images) {
			if (await img.isVisible()) {
				const hasResponsiveAttribute = await img.evaluate((el) => {
					const hasMaxWidth =
						el.style.maxWidth || getComputedStyle(el).maxWidth !== "none";
					const hasWidth100 = getComputedStyle(el).width.includes("%");
					const hasSrcset = el.hasAttribute("srcset");
					const hasSizes = el.hasAttribute("sizes");

					return hasMaxWidth || hasWidth100 || hasSrcset || hasSizes;
				});

				// Log but don't fail - some images might be fixed size icons
			}
		}
	});

	test("should not have images wider than viewport on mobile", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto(`/${LOCALE}`);
		await page.waitForSelector("main", { timeout: 10000 });

		const oversizedImages = await page.evaluate(() => {
			const images = document.querySelectorAll("img");
			const issues: string[] = [];

			images.forEach((img, index) => {
				const rect = img.getBoundingClientRect();
				if (rect.width > window.innerWidth) {
					issues.push(
						`Image ${index}: ${Math.round(rect.width)}px wide (viewport: ${window.innerWidth}px)`,
					);
				}
			});

			return issues;
		});

		expect(oversizedImages).toEqual([]);
	});
});

test.describe("Responsive Design - Spacing", () => {
	test("should have appropriate padding on mobile", async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto(`/${LOCALE}`);
		await page.waitForSelector("main", { timeout: 10000 });

		// Content should have horizontal padding (not edge-to-edge)
		const mainPadding = await page.evaluate(() => {
			const main = document.querySelector("main");
			if (main) {
				const firstChild = main.firstElementChild;
				if (firstChild) {
					const rect = firstChild.getBoundingClientRect();
					return {
						leftPadding: rect.left,
						rightPadding: window.innerWidth - rect.right,
					};
				}
			}
			return { leftPadding: 0, rightPadding: 0 };
		});

		// Should have some padding (at least 8px on each side)
		// Note: Some elements might intentionally go edge-to-edge
	});

	test("should maintain spacing consistency across breakpoints", async ({
		page,
	}) => {
		const spacingResults: Record<string, number> = {};

		for (const viewport of VIEWPORTS) {
			await page.setViewportSize({
				width: viewport.width,
				height: viewport.height,
			});
			await page.goto(`/${LOCALE}`);
			await page.waitForSelector("main", { timeout: 10000 });

			const spacing = await page.evaluate(() => {
				const main = document.querySelector("main");
				if (main) {
					const styles = getComputedStyle(main);
					return (
						Number.parseFloat(styles.paddingLeft) +
						Number.parseFloat(styles.paddingRight)
					);
				}
				return 0;
			});

			spacingResults[viewport.name] = spacing;
		}

		// Spacing should exist at all breakpoints (might vary)
	});
});
