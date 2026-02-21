import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Accessibility testing with axe-core
 * Tests key pages for WCAG compliance
 */

test.describe("Accessibility Tests", () => {
	test("home page should not have accessibility violations", async ({
		page,
	}) => {
		await page.goto("/");

		const accessibilityScanResults = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();

		expect(accessibilityScanResults.violations).toEqual([]);
	});

	test("pricing page should not have accessibility violations", async ({
		page,
	}) => {
		await page.goto("/pricing");

		const accessibilityScanResults = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();

		expect(accessibilityScanResults.violations).toEqual([]);
	});

	test("login page should not have accessibility violations", async ({
		page,
	}) => {
		await page.goto("/login");

		const accessibilityScanResults = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();

		expect(accessibilityScanResults.violations).toEqual([]);
	});

	test("signup page should not have accessibility violations", async ({
		page,
	}) => {
		await page.goto("/signup");

		const accessibilityScanResults = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();

		expect(accessibilityScanResults.violations).toEqual([]);
	});

	test("should have no critical or serious accessibility violations on any page", async ({
		page,
	}) => {
		const pagesToTest = ["/", "/pricing", "/login", "/signup"];

		for (const path of pagesToTest) {
			await page.goto(path);

			const accessibilityScanResults = await new AxeBuilder({ page })
				.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
				.analyze();

			// Filter for critical and serious violations
			const criticalViolations = accessibilityScanResults.violations.filter(
				(violation) =>
					violation.impact === "critical" || violation.impact === "serious",
			);

			expect(
				criticalViolations,
				`Page ${path} should have no critical or serious violations`,
			).toEqual([]);
		}
	});

	test("all interactive elements should be keyboard accessible", async ({
		page,
	}) => {
		await page.goto("/");

		const accessibilityScanResults = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa"])
			.include("button, a, input, select, textarea")
			.analyze();

		const keyboardViolations = accessibilityScanResults.violations.filter(
			(violation) =>
				violation.id.includes("keyboard") || violation.id.includes("focus"),
		);

		expect(keyboardViolations).toEqual([]);
	});
});
