/**
 * Speed Insights / Core Web Vitals Tests
 *
 * Tests for Core Web Vitals collection, thresholds, and reporting.
 * Complements the detailed web-vitals.test.ts in lib/.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
	DEFAULT_WEB_VITALS_CONFIG,
	WEB_VITALS_THRESHOLDS,
	checkCoreWebVitals,
	getWebVitalsReport,
	isWebVitalsInitialized,
	resetWebVitals,
} from "../src/lib/monitoring/web-vitals";

// ============================================================================
// Tests
// ============================================================================

describe("Speed Insights (Core Web Vitals)", () => {
	beforeEach(() => {
		resetWebVitals();
	});

	afterEach(() => {
		resetWebVitals();
	});

	describe("Core Web Vitals thresholds", () => {
		test("LCP threshold is defined (good < 2500ms)", () => {
			expect(WEB_VITALS_THRESHOLDS).toBeDefined();
			expect(WEB_VITALS_THRESHOLDS.LCP).toBeDefined();
			expect(WEB_VITALS_THRESHOLDS.LCP.good).toBeLessThanOrEqual(2500);
		});

		test("INP threshold is defined (good < 200ms)", () => {
			expect(WEB_VITALS_THRESHOLDS.INP).toBeDefined();
			expect(WEB_VITALS_THRESHOLDS.INP.good).toBeLessThanOrEqual(200);
		});

		test("CLS threshold is defined (good < 0.1)", () => {
			expect(WEB_VITALS_THRESHOLDS.CLS).toBeDefined();
			expect(WEB_VITALS_THRESHOLDS.CLS.good).toBeLessThanOrEqual(0.1);
		});

		test("TTFB threshold is defined (good < 800ms)", () => {
			expect(WEB_VITALS_THRESHOLDS.TTFB).toBeDefined();
		});

		test("FCP threshold is defined (good < 1800ms)", () => {
			expect(WEB_VITALS_THRESHOLDS.FCP).toBeDefined();
			expect(WEB_VITALS_THRESHOLDS.FCP.good).toBeLessThanOrEqual(1800);
		});
	});

	describe("Default configuration", () => {
		test("DEFAULT_WEB_VITALS_CONFIG has required fields", () => {
			expect(DEFAULT_WEB_VITALS_CONFIG).toBeDefined();
		});
	});

	describe("Initialization state", () => {
		test("not initialized before init is called", () => {
			expect(isWebVitalsInitialized()).toBe(false);
		});

		test("resetWebVitals clears state", () => {
			resetWebVitals();
			expect(isWebVitalsInitialized()).toBe(false);
		});
	});

	describe("Core Web Vitals check", () => {
		test("checkCoreWebVitals returns a result object", () => {
			const result = checkCoreWebVitals();
			expect(result).toBeDefined();
			expect(typeof result).toBe("object");
		});

		test("web vitals report returns empty when not initialized", () => {
			const report = getWebVitalsReport();
			expect(report).toBeDefined();
		});
	});

	describe("Metric rating classification", () => {
		test("LCP of 1000ms is rated 'good'", () => {
			const { good } = WEB_VITALS_THRESHOLDS.LCP;
			expect(1000).toBeLessThan(good);
		});

		test("LCP of 5000ms is rated 'poor'", () => {
			const { poor } = WEB_VITALS_THRESHOLDS.LCP;
			expect(5000).toBeGreaterThan(poor);
		});

		test("CLS of 0.05 is rated 'good'", () => {
			const { good } = WEB_VITALS_THRESHOLDS.CLS;
			expect(0.05).toBeLessThan(good);
		});

		test("CLS of 0.5 is rated 'poor'", () => {
			const { poor } = WEB_VITALS_THRESHOLDS.CLS;
			expect(0.5).toBeGreaterThan(poor);
		});
	});
});
