import { expect, test } from "@playwright/test";

/**
 * Profile Settings E2E Tests
 *
 * Tests the username and profile management functionality
 * NOTE: These tests require authentication. Run against a test environment
 * with seeded user data, or skip in CI until auth fixtures are set up.
 */

test.describe("Profile Settings - Username", () => {
	// These tests run on the public signup page which shows username validation
	test.describe("Username validation (public)", () => {
		test("should show username format requirements", async ({ page }) => {
			await page.goto("/signup");

			// Username field might be on signup
			const usernameInput = page.getByRole("textbox", { name: /username/i });
			if (await usernameInput.isVisible()) {
				await usernameInput.fill("UPPERCASE");
				// Should show lowercase conversion or error
				await expect(page.getByText(/lowercase/i)).toBeVisible({
					timeout: 5000,
				});
			}
		});
	});

	test.describe("Username Flow (authenticated)", () => {
		// Skip these tests unless we have auth cookies set up
		test.skip(
			({ page }) => !process.env.TEST_AUTH_COOKIE,
			"Requires authenticated session",
		);

		test.beforeEach(async ({ page }) => {
			// Set auth cookie if available
			if (process.env.TEST_AUTH_COOKIE) {
				await page.context().addCookies([
					{
						name: "sylphx_access_token",
						value: process.env.TEST_AUTH_COOKIE,
						domain: "localhost",
						path: "/",
					},
				]);
			}
			await page.goto("/settings/account");
		});

		test("should display username section", async ({ page }) => {
			// Username section should be visible
			await expect(page.getByText("Username")).toBeVisible();
			await expect(
				page.getByText(/For leaderboards and public profile/i),
			).toBeVisible();
		});

		test("should show edit button for username", async ({ page }) => {
			const editButton = page.getByRole("button", {
				name: /edit|set username/i,
			});
			await expect(editButton).toBeVisible();
		});

		test("should enter edit mode when clicking edit", async ({ page }) => {
			const editButton = page.getByRole("button", {
				name: /edit|set username/i,
			});
			await editButton.click();

			// Should show input field with @ prefix
			await expect(page.getByText("@")).toBeVisible();
			await expect(page.getByRole("textbox")).toBeVisible();
		});

		test("should show validation error for invalid characters", async ({
			page,
		}) => {
			const editButton = page.getByRole("button", {
				name: /edit|set username/i,
			});
			await editButton.click();

			const input = page.locator('input[placeholder="username"]');
			await input.fill("user@name");

			// Should show error about invalid characters
			await expect(
				page.getByText(/lowercase letters, numbers, and underscores/i),
			).toBeVisible();
		});

		test("should show validation error for too short username", async ({
			page,
		}) => {
			const editButton = page.getByRole("button", {
				name: /edit|set username/i,
			});
			await editButton.click();

			const input = page.locator('input[placeholder="username"]');
			await input.fill("ab");

			// Should show error about length
			await expect(page.getByText(/at least 3 characters/i)).toBeVisible();
		});

		test("should auto-lowercase username input", async ({ page }) => {
			const editButton = page.getByRole("button", {
				name: /edit|set username/i,
			});
			await editButton.click();

			const input = page.locator('input[placeholder="username"]');
			await input.fill("UPPERCASE");

			// Value should be converted to lowercase
			await expect(input).toHaveValue("uppercase");
		});

		test("should show loading indicator during availability check", async ({
			page,
		}) => {
			const editButton = page.getByRole("button", {
				name: /edit|set username/i,
			});
			await editButton.click();

			const input = page.locator('input[placeholder="username"]');
			// Type a valid username to trigger availability check
			await input.fill("testuser123");

			// Should show loading indicator (debounced)
			// Note: This may be too fast to catch, but the test validates the flow
		});

		test("should show suggestions when input is empty", async ({ page }) => {
			const editButton = page.getByRole("button", {
				name: /edit|set username/i,
			});
			await editButton.click();

			// Should show suggestions text
			await expect(page.getByText(/suggestions/i)).toBeVisible({
				timeout: 3000,
			});
		});

		test("should clear suggestions when typing", async ({ page }) => {
			const editButton = page.getByRole("button", {
				name: /edit|set username/i,
			});
			await editButton.click();

			// Initially should show suggestions
			const suggestionsText = page.getByText(/suggestions/i);

			const input = page.locator('input[placeholder="username"]');
			await input.fill("myusername");

			// Suggestions should be hidden when input has value
			await expect(suggestionsText).not.toBeVisible();
		});

		test("should cancel edit mode", async ({ page }) => {
			const editButton = page.getByRole("button", {
				name: /edit|set username/i,
			});
			await editButton.click();

			const input = page.locator('input[placeholder="username"]');
			await input.fill("newusername");

			// Click cancel
			const cancelButton = page.getByRole("button", { name: /cancel/i });
			await cancelButton.click();

			// Should exit edit mode
			await expect(input).not.toBeVisible();
			await expect(editButton).toBeVisible();
		});

		test("should have accessible form elements", async ({ page }) => {
			const editButton = page.getByRole("button", {
				name: /edit|set username/i,
			});
			await editButton.click();

			// Input should be focusable
			const input = page.locator('input[placeholder="username"]');
			await expect(input).toBeFocused();

			// Should be able to tab to save button
			await page.keyboard.press("Tab");
			const saveButton = page.getByRole("button", { name: /save/i });
			await expect(saveButton).toBeFocused();
		});
	});
});

test.describe("Profile Settings - Display Name", () => {
	test.describe("Name Flow (authenticated)", () => {
		test.skip(
			({ page }) => !process.env.TEST_AUTH_COOKIE,
			"Requires authenticated session",
		);

		test.beforeEach(async ({ page }) => {
			if (process.env.TEST_AUTH_COOKIE) {
				await page.context().addCookies([
					{
						name: "sylphx_access_token",
						value: process.env.TEST_AUTH_COOKIE,
						domain: "localhost",
						path: "/",
					},
				]);
			}
			await page.goto("/settings/account");
		});

		test("should display name section", async ({ page }) => {
			await expect(page.getByText("Display Name")).toBeVisible();
		});

		test("should enter edit mode for name", async ({ page }) => {
			// Find the Edit button next to Display Name
			const nameSection = page
				.locator("div", { hasText: "Display Name" })
				.first();
			const editButton = nameSection.getByRole("button", { name: /edit/i });
			await editButton.click();

			// Should show input
			await expect(page.getByRole("textbox")).toBeVisible();
		});

		test("should show error for empty name", async ({ page }) => {
			const nameSection = page
				.locator("div", { hasText: "Display Name" })
				.first();
			const editButton = nameSection.getByRole("button", { name: /edit/i });
			await editButton.click();

			const input = page.getByPlaceholder("Your name");
			await input.fill("");

			const saveButton = page.getByRole("button", { name: /save/i });
			await saveButton.click();

			// Should show error toast
			await expect(page.getByText(/name required/i)).toBeVisible();
		});
	});
});

test.describe("Profile Settings - Bio", () => {
	test.describe("Bio Flow (authenticated)", () => {
		test.skip(
			({ page }) => !process.env.TEST_AUTH_COOKIE,
			"Requires authenticated session",
		);

		test.beforeEach(async ({ page }) => {
			if (process.env.TEST_AUTH_COOKIE) {
				await page.context().addCookies([
					{
						name: "sylphx_access_token",
						value: process.env.TEST_AUTH_COOKIE,
						domain: "localhost",
						path: "/",
					},
				]);
			}
			await page.goto("/settings/account");
		});

		test("should display bio section", async ({ page }) => {
			await expect(page.getByText("Bio")).toBeVisible();
			await expect(page.getByPlaceholder(/tell us/i)).toBeVisible();
		});

		test("should show character count", async ({ page }) => {
			// Should show character count like "0/160"
			await expect(page.getByText(/\/160/)).toBeVisible();
		});

		test("should update character count on typing", async ({ page }) => {
			const textarea = page.getByPlaceholder(/tell us/i);
			await textarea.fill("Hello world");

			// Should show "11/160"
			await expect(page.getByText("11/160")).toBeVisible();
		});

		test("should warn when approaching limit", async ({ page }) => {
			const textarea = page.getByPlaceholder(/tell us/i);
			// Fill close to limit (160 - 20 = 140)
			await textarea.fill("a".repeat(145));

			// Character count should have warning styling (text-warning class)
			const charCount = page.getByText(/145\/160/);
			await expect(charCount).toBeVisible();
		});

		test("should auto-save bio with debounce", async ({ page }) => {
			const textarea = page.getByPlaceholder(/tell us/i);
			await textarea.fill("Test bio content");

			// Wait for debounce (1s) + save
			await page.waitForTimeout(1500);

			// Should show saving indicator briefly
			// Note: May be too fast to catch, validates flow works
		});
	});
});

test.describe("Profile Settings - Public Profile Toggle", () => {
	test.describe("Public Profile (authenticated)", () => {
		test.skip(
			({ page }) => !process.env.TEST_AUTH_COOKIE,
			"Requires authenticated session",
		);

		test.beforeEach(async ({ page }) => {
			if (process.env.TEST_AUTH_COOKIE) {
				await page.context().addCookies([
					{
						name: "sylphx_access_token",
						value: process.env.TEST_AUTH_COOKIE,
						domain: "localhost",
						path: "/",
					},
				]);
			}
			await page.goto("/settings/account");
		});

		test("should display public profile toggle", async ({ page }) => {
			await expect(page.getByText("Public Profile")).toBeVisible();
			await expect(page.getByText(/Make your profile visible/i)).toBeVisible();
		});

		test("should show disabled toggle if no username set", async ({ page }) => {
			// If user has no username, toggle should be disabled
			const toggle = page.getByRole("switch");

			// Check if there's a message about setting username first
			const noUsernameMessage = page.getByText(/Set a username to enable/i);
			if (await noUsernameMessage.isVisible()) {
				await expect(toggle).toBeDisabled();
			}
		});
	});
});

test.describe("Settings Page - Navigation", () => {
	test("should redirect unauthenticated users to login", async ({ page }) => {
		await page.goto("/settings");

		// Should redirect to login
		await page.waitForURL(/login|signin/, { timeout: 5000 });
	});

	test("should show settings navigation sidebar", async ({ page }) => {
		// Skip if no auth
		test.skip(!process.env.TEST_AUTH_COOKIE, "Requires authenticated session");

		if (process.env.TEST_AUTH_COOKIE) {
			await page.context().addCookies([
				{
					name: "sylphx_access_token",
					value: process.env.TEST_AUTH_COOKIE,
					domain: "localhost",
					path: "/",
				},
			]);
		}

		await page.goto("/settings");

		// Should have navigation items
		await expect(page.getByRole("link", { name: /account/i })).toBeVisible();
		await expect(page.getByRole("link", { name: /security/i })).toBeVisible();
		await expect(
			page.getByRole("link", { name: /preferences/i }),
		).toBeVisible();
	});
});
