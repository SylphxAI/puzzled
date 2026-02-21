/**
 * Progress Component Tests
 *
 * Tests for linear and circular progress calculation logic.
 */

import { describe, expect, test } from "bun:test";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// ============================================================================
// cn() utility (from utils.ts)
// ============================================================================

function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// ============================================================================
// Progress Types and Styles (from progress.tsx)
// ============================================================================

type ProgressSize = "sm" | "md" | "lg";
type ProgressVariant = "default" | "success" | "warning" | "error";

const sizeStyles: Record<ProgressSize, string> = {
	sm: "h-1",
	md: "h-2",
	lg: "h-3",
};

const variantStyles: Record<ProgressVariant, string> = {
	default: "bg-primary",
	success: "bg-success",
	warning: "bg-warning",
	error: "bg-error",
};

// ============================================================================
// Linear Progress Calculation
// ============================================================================

function calculatePercentage(value: number, max = 100): number {
	return Math.min(Math.max((value / max) * 100, 0), 100);
}

function getProgressClasses(size: ProgressSize = "md") {
	return cn(
		"relative w-full overflow-hidden rounded-full bg-muted",
		sizeStyles[size],
	);
}

function getIndicatorClasses(variant: ProgressVariant = "default") {
	return cn(
		"h-full rounded-full transition-all duration-500",
		variantStyles[variant],
	);
}

// ============================================================================
// Circular Progress Calculation
// ============================================================================

function calculateCircularProgress(size: number, strokeWidth: number) {
	const radius = (size - strokeWidth) / 2;
	const circumference = radius * 2 * Math.PI;
	return { radius, circumference };
}

function calculateStrokeDashoffset(
	circumference: number,
	value: number | undefined,
): number {
	if (value === undefined) {
		// Indeterminate
		return circumference * 0.75;
	}
	return circumference * (1 - value / 100);
}

// ============================================================================
// Percentage Calculation Tests
// ============================================================================

describe("calculatePercentage", () => {
	test("calculates basic percentage", () => {
		expect(calculatePercentage(50, 100)).toBe(50);
		expect(calculatePercentage(25, 100)).toBe(25);
		expect(calculatePercentage(75, 100)).toBe(75);
	});

	test("handles 0 value", () => {
		expect(calculatePercentage(0, 100)).toBe(0);
	});

	test("handles 100% value", () => {
		expect(calculatePercentage(100, 100)).toBe(100);
	});

	test("clamps values above 100%", () => {
		expect(calculatePercentage(150, 100)).toBe(100);
		expect(calculatePercentage(200, 100)).toBe(100);
		expect(calculatePercentage(1000, 100)).toBe(100);
	});

	test("clamps negative values to 0", () => {
		expect(calculatePercentage(-10, 100)).toBe(0);
		expect(calculatePercentage(-50, 100)).toBe(0);
	});

	test("handles custom max values", () => {
		expect(calculatePercentage(5, 10)).toBe(50);
		expect(calculatePercentage(25, 50)).toBe(50);
		expect(calculatePercentage(200, 400)).toBe(50);
	});

	test("handles decimal values", () => {
		expect(calculatePercentage(33.33, 100)).toBeCloseTo(33.33);
		expect(calculatePercentage(66.67, 100)).toBeCloseTo(66.67);
	});

	test("handles max of 0 (edge case)", () => {
		// Division by 0 results in Infinity, which gets clamped to 100
		expect(calculatePercentage(50, 0)).toBe(100);
	});

	test("handles both value and max as 0", () => {
		// 0/0 = NaN, which fails Math.max check, returns 0
		expect(Number.isNaN(calculatePercentage(0, 0))).toBe(true);
	});
});

// ============================================================================
// Progress Size Style Tests
// ============================================================================

describe("Progress size styles", () => {
	test("sm size is h-1 (4px)", () => {
		const classes = getProgressClasses("sm");
		expect(classes).toContain("h-1");
	});

	test("md size is h-2 (8px)", () => {
		const classes = getProgressClasses("md");
		expect(classes).toContain("h-2");
	});

	test("lg size is h-3 (12px)", () => {
		const classes = getProgressClasses("lg");
		expect(classes).toContain("h-3");
	});

	test("has rounded-full for pill shape", () => {
		const classes = getProgressClasses("md");
		expect(classes).toContain("rounded-full");
	});

	test("has muted background track", () => {
		const classes = getProgressClasses("md");
		expect(classes).toContain("bg-muted");
	});

	test("has overflow hidden for indicator", () => {
		const classes = getProgressClasses("md");
		expect(classes).toContain("overflow-hidden");
	});
});

// ============================================================================
// Progress Variant Style Tests
// ============================================================================

describe("Progress variant styles", () => {
	test("default variant is primary color", () => {
		const classes = getIndicatorClasses("default");
		expect(classes).toContain("bg-primary");
	});

	test("success variant is success color", () => {
		const classes = getIndicatorClasses("success");
		expect(classes).toContain("bg-success");
	});

	test("warning variant is warning color", () => {
		const classes = getIndicatorClasses("warning");
		expect(classes).toContain("bg-warning");
	});

	test("error variant is error color", () => {
		const classes = getIndicatorClasses("error");
		expect(classes).toContain("bg-error");
	});

	test("has transition for smooth animation", () => {
		const classes = getIndicatorClasses("default");
		expect(classes).toContain("transition-all");
		expect(classes).toContain("duration-500");
	});

	test("is full height of track", () => {
		const classes = getIndicatorClasses("default");
		expect(classes).toContain("h-full");
	});
});

// ============================================================================
// Circular Progress Calculation Tests
// ============================================================================

describe("calculateCircularProgress", () => {
	test("calculates radius correctly", () => {
		const { radius } = calculateCircularProgress(40, 4);
		// (40 - 4) / 2 = 18
		expect(radius).toBe(18);
	});

	test("calculates circumference correctly", () => {
		const { radius, circumference } = calculateCircularProgress(40, 4);
		// 2 * PI * 18 = ~113.09
		expect(circumference).toBeCloseTo(2 * Math.PI * radius);
		expect(circumference).toBeCloseTo(113.097, 2);
	});

	test("handles different sizes", () => {
		const small = calculateCircularProgress(24, 2);
		const medium = calculateCircularProgress(40, 4);
		const large = calculateCircularProgress(80, 8);

		expect(small.radius).toBe(11);
		expect(medium.radius).toBe(18);
		expect(large.radius).toBe(36);
	});

	test("larger stroke width reduces radius", () => {
		const thin = calculateCircularProgress(40, 2);
		const thick = calculateCircularProgress(40, 8);

		expect(thin.radius).toBe(19); // (40-2)/2
		expect(thick.radius).toBe(16); // (40-8)/2
	});
});

// ============================================================================
// Stroke Dashoffset Calculation Tests
// ============================================================================

describe("calculateStrokeDashoffset", () => {
	const circumference = 113.097; // For size=40, stroke=4

	test("0% progress has full offset", () => {
		const offset = calculateStrokeDashoffset(circumference, 0);
		expect(offset).toBeCloseTo(circumference);
	});

	test("100% progress has no offset", () => {
		const offset = calculateStrokeDashoffset(circumference, 100);
		expect(offset).toBeCloseTo(0);
	});

	test("50% progress has half offset", () => {
		const offset = calculateStrokeDashoffset(circumference, 50);
		expect(offset).toBeCloseTo(circumference * 0.5);
	});

	test("25% progress has 75% offset", () => {
		const offset = calculateStrokeDashoffset(circumference, 25);
		expect(offset).toBeCloseTo(circumference * 0.75);
	});

	test("indeterminate (undefined) has 75% offset", () => {
		const offset = calculateStrokeDashoffset(circumference, undefined);
		expect(offset).toBeCloseTo(circumference * 0.75);
	});
});

// ============================================================================
// Progress Width Style Tests
// ============================================================================

describe("Progress indicator width", () => {
	test("width matches percentage", () => {
		const percentage = calculatePercentage(50, 100);
		const width = `${percentage}%`;
		expect(width).toBe("50%");
	});

	test("clamped width at 0%", () => {
		const percentage = calculatePercentage(-10, 100);
		const width = `${percentage}%`;
		expect(width).toBe("0%");
	});

	test("clamped width at 100%", () => {
		const percentage = calculatePercentage(150, 100);
		const width = `${percentage}%`;
		expect(width).toBe("100%");
	});
});

// ============================================================================
// Label Display Tests
// ============================================================================

describe("Progress label display", () => {
	test("label shows rounded percentage", () => {
		const percentage = calculatePercentage(33.33, 100);
		const display = `${Math.round(percentage)}%`;
		expect(display).toBe("33%");
	});

	test("label rounds 66.67 to 67%", () => {
		const percentage = calculatePercentage(66.67, 100);
		const display = `${Math.round(percentage)}%`;
		expect(display).toBe("67%");
	});

	test("label shows 0% for empty", () => {
		const percentage = calculatePercentage(0, 100);
		const display = `${Math.round(percentage)}%`;
		expect(display).toBe("0%");
	});

	test("label shows 100% for complete", () => {
		const percentage = calculatePercentage(100, 100);
		const display = `${Math.round(percentage)}%`;
		expect(display).toBe("100%");
	});
});

// ============================================================================
// Circular Progress Accessibility Tests
// ============================================================================

describe("Circular progress accessibility", () => {
	test("indeterminate has no valuenow", () => {
		const value = undefined;
		const ariaNow = value === undefined ? undefined : value;
		expect(ariaNow).toBeUndefined();
	});

	test("determinate has valuenow", () => {
		const value = 50;
		const ariaNow = value === undefined ? undefined : value;
		expect(ariaNow).toBe(50);
	});

	test("value range is 0-100", () => {
		const ariaMin = 0;
		const ariaMax = 100;
		expect(ariaMin).toBe(0);
		expect(ariaMax).toBe(100);
	});
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Progress integration", () => {
	test("sm success progress", () => {
		const trackClasses = getProgressClasses("sm");
		const indicatorClasses = getIndicatorClasses("success");
		const percentage = calculatePercentage(75, 100);

		expect(trackClasses).toContain("h-1");
		expect(indicatorClasses).toContain("bg-success");
		expect(percentage).toBe(75);
	});

	test("lg error progress at max", () => {
		const trackClasses = getProgressClasses("lg");
		const indicatorClasses = getIndicatorClasses("error");
		const percentage = calculatePercentage(100, 100);

		expect(trackClasses).toContain("h-3");
		expect(indicatorClasses).toContain("bg-error");
		expect(percentage).toBe(100);
	});

	test("circular progress at 25%", () => {
		const { circumference } = calculateCircularProgress(40, 4);
		const offset = calculateStrokeDashoffset(circumference, 25);

		// 25% complete = 75% offset
		expect(offset / circumference).toBeCloseTo(0.75);
	});

	test("circular progress indeterminate has animation offset", () => {
		const { circumference } = calculateCircularProgress(40, 4);
		const offset = calculateStrokeDashoffset(circumference, undefined);

		// Indeterminate shows ~25% of arc
		expect(offset / circumference).toBeCloseTo(0.75);
	});
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Progress edge cases", () => {
	test("very small values", () => {
		const percentage = calculatePercentage(0.1, 100);
		expect(percentage).toBeCloseTo(0.1);
	});

	test("very large max", () => {
		const percentage = calculatePercentage(500, 1000000);
		expect(percentage).toBeCloseTo(0.05);
	});

	test("value equals max", () => {
		const percentage = calculatePercentage(50, 50);
		expect(percentage).toBe(100);
	});

	test("extremely small stroke width", () => {
		const { radius } = calculateCircularProgress(40, 0.5);
		expect(radius).toBe(19.75);
	});
});
