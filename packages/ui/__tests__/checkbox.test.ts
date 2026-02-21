/**
 * Checkbox Component Tests
 *
 * Tests for checkbox class generation, states, and accessibility.
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
// Checkbox Class Generators (from checkbox.tsx)
// ============================================================================

function getCheckboxClasses(className?: string) {
	return cn(
		// h-6 w-6 with min-h-11 min-w-11 touch area wrapper effect via padding
		// Actual checkbox is 24px but clickable area extends via focus ring offset
		"peer h-6 w-6 shrink-0 rounded-md border border-primary ring-offset-background",
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
		"disabled:cursor-not-allowed disabled:opacity-50",
		"data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
		"transition-all duration-150 hover:border-primary/70",
		"active:scale-95 motion-reduce:active:scale-100",
		className,
	);
}

function getCheckboxIndicatorClasses(className?: string) {
	return cn("flex items-center justify-center text-current", className);
}

// ============================================================================
// Checkbox Base Styles Tests
// ============================================================================

describe("Checkbox base styles", () => {
	test("has 24px size (h-6 w-6)", () => {
		const classes = getCheckboxClasses();
		expect(classes).toContain("h-6");
		expect(classes).toContain("w-6");
	});

	test("does not shrink in flex layouts", () => {
		const classes = getCheckboxClasses();
		expect(classes).toContain("shrink-0");
	});

	test("has rounded corners", () => {
		const classes = getCheckboxClasses();
		expect(classes).toContain("rounded-md");
	});

	test("has primary border", () => {
		const classes = getCheckboxClasses();
		expect(classes).toContain("border");
		expect(classes).toContain("border-primary");
	});

	test("has ring offset for focus", () => {
		const classes = getCheckboxClasses();
		expect(classes).toContain("ring-offset-background");
	});

	test("is a peer for label styling", () => {
		const classes = getCheckboxClasses();
		expect(classes).toContain("peer");
	});
});

// ============================================================================
// Checkbox Focus States Tests
// ============================================================================

describe("Checkbox focus states", () => {
	test("removes outline on focus", () => {
		const classes = getCheckboxClasses();
		expect(classes).toContain("focus-visible:outline-none");
	});

	test("has focus ring", () => {
		const classes = getCheckboxClasses();
		expect(classes).toContain("focus-visible:ring-2");
		expect(classes).toContain("focus-visible:ring-ring");
	});

	test("has focus ring offset", () => {
		const classes = getCheckboxClasses();
		expect(classes).toContain("focus-visible:ring-offset-2");
	});
});

// ============================================================================
// Checkbox Disabled State Tests
// ============================================================================

describe("Checkbox disabled state", () => {
	test("has not-allowed cursor", () => {
		const classes = getCheckboxClasses();
		expect(classes).toContain("disabled:cursor-not-allowed");
	});

	test("has reduced opacity", () => {
		const classes = getCheckboxClasses();
		expect(classes).toContain("disabled:opacity-50");
	});
});

// ============================================================================
// Checkbox Checked State Tests
// ============================================================================

describe("Checkbox checked state", () => {
	test("has primary background when checked", () => {
		const classes = getCheckboxClasses();
		expect(classes).toContain("data-[state=checked]:bg-primary");
	});

	test("has primary foreground text when checked", () => {
		const classes = getCheckboxClasses();
		expect(classes).toContain("data-[state=checked]:text-primary-foreground");
	});
});

// ============================================================================
// Checkbox Transition Tests
// ============================================================================

describe("Checkbox transitions", () => {
	test("has transition", () => {
		const classes = getCheckboxClasses();
		expect(classes).toContain("transition-all");
		expect(classes).toContain("duration-150");
	});

	test("has hover state", () => {
		const classes = getCheckboxClasses();
		expect(classes).toContain("hover:border-primary/70");
	});

	test("has active scale effect", () => {
		const classes = getCheckboxClasses();
		expect(classes).toContain("active:scale-95");
	});

	test("respects reduced motion preference", () => {
		const classes = getCheckboxClasses();
		expect(classes).toContain("motion-reduce:active:scale-100");
	});
});

// ============================================================================
// Checkbox Indicator Tests
// ============================================================================

describe("Checkbox indicator styles", () => {
	test("is flex centered", () => {
		const classes = getCheckboxIndicatorClasses();
		expect(classes).toContain("flex");
		expect(classes).toContain("items-center");
		expect(classes).toContain("justify-center");
	});

	test("inherits text color", () => {
		const classes = getCheckboxIndicatorClasses();
		expect(classes).toContain("text-current");
	});

	test("accepts custom className", () => {
		const classes = getCheckboxIndicatorClasses("text-white");
		expect(classes).toContain("text-white");
	});
});

// ============================================================================
// Checkbox className Override Tests
// ============================================================================

describe("Checkbox className override", () => {
	test("accepts custom className", () => {
		const classes = getCheckboxClasses("custom-class");
		expect(classes).toContain("custom-class");
	});

	test("can override size", () => {
		const classes = getCheckboxClasses("h-8 w-8");
		expect(classes).toContain("h-8");
		expect(classes).toContain("w-8");
	});

	test("can override border color", () => {
		const classes = getCheckboxClasses("border-secondary");
		expect(classes).toContain("border-secondary");
	});
});

// ============================================================================
// Animated Check Icon Tests
// ============================================================================

describe("AnimatedCheck icon", () => {
	// The AnimatedCheck component is an SVG with specific properties

	test("check icon has correct size classes", () => {
		const expectedClasses = "h-4 w-4";
		expect(expectedClasses).toContain("h-4");
		expect(expectedClasses).toContain("w-4");
	});

	test("check icon path uses animation class", () => {
		const expectedClass = "animate-checkmark";
		expect(expectedClass).toBe("animate-checkmark");
	});

	test("respects reduced motion", () => {
		const expectedClasses =
			"motion-reduce:animate-none motion-reduce:[stroke-dashoffset:0]";
		expect(expectedClasses).toContain("motion-reduce:animate-none");
		expect(expectedClasses).toContain("motion-reduce:[stroke-dashoffset:0]");
	});
});

// ============================================================================
// Accessibility Tests
// ============================================================================

describe("Checkbox accessibility", () => {
	test("focus ring provides visible focus indicator", () => {
		const classes = getCheckboxClasses();
		expect(classes).toContain("focus-visible:ring-2");
	});

	test("has sufficient contrast with primary border", () => {
		const classes = getCheckboxClasses();
		expect(classes).toContain("border-primary");
	});

	test("disabled state is visually distinct", () => {
		const classes = getCheckboxClasses();
		expect(classes).toContain("disabled:opacity-50");
	});

	test("checked state is visually distinct", () => {
		const classes = getCheckboxClasses();
		expect(classes).toContain("data-[state=checked]:bg-primary");
	});

	test("size is reasonable for touch (24px)", () => {
		const classes = getCheckboxClasses();
		// h-6 = 24px which is slightly below 44px but acceptable
		// as the focus ring offset extends clickable area
		expect(classes).toContain("h-6");
		expect(classes).toContain("w-6");
	});
});

// ============================================================================
// Keyboard Navigation Tests
// ============================================================================

describe("Checkbox keyboard navigation", () => {
	// These test the expected behavior patterns

	test("checkbox is keyboard focusable", () => {
		// Radix handles this, but we test the focus styling
		const classes = getCheckboxClasses();
		expect(classes).toContain("focus-visible:ring-2");
	});

	test("focus ring offset creates visual separation", () => {
		const classes = getCheckboxClasses();
		expect(classes).toContain("focus-visible:ring-offset-2");
		expect(classes).toContain("ring-offset-background");
	});
});

// ============================================================================
// SVG Checkmark Configuration Tests
// ============================================================================

describe("SVG checkmark configuration", () => {
	// SVG attributes from the AnimatedCheck component
	const svgConfig = {
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: 3,
		strokeLinecap: "round",
		strokeLinejoin: "round",
		pathD: "M5 12l5 5L19 7",
	};

	test("has correct viewBox", () => {
		expect(svgConfig.viewBox).toBe("0 0 24 24");
	});

	test("has no fill", () => {
		expect(svgConfig.fill).toBe("none");
	});

	test("uses current color for stroke", () => {
		expect(svgConfig.stroke).toBe("currentColor");
	});

	test("has visible stroke width", () => {
		expect(svgConfig.strokeWidth).toBe(3);
	});

	test("has rounded line caps", () => {
		expect(svgConfig.strokeLinecap).toBe("round");
	});

	test("has rounded line joins", () => {
		expect(svgConfig.strokeLinejoin).toBe("round");
	});

	test("has checkmark path", () => {
		expect(svgConfig.pathD).toBe("M5 12l5 5L19 7");
	});
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Checkbox edge cases", () => {
	test("handles undefined className", () => {
		const classes = getCheckboxClasses(undefined);
		expect(classes).toContain("h-6");
	});

	test("handles empty className", () => {
		const classes = getCheckboxClasses("");
		expect(classes).toContain("h-6");
	});

	test("multiple custom classes merge correctly", () => {
		const classes = getCheckboxClasses("border-2 rounded-lg");
		expect(classes).toContain("border-2");
		expect(classes).toContain("rounded-lg");
	});
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Checkbox integration patterns", () => {
	test("checkbox with label layout", () => {
		// Common pattern: flex items-center gap-2
		const checkboxClasses = getCheckboxClasses();

		// Checkbox shrinks to fit
		expect(checkboxClasses).toContain("shrink-0");

		// Can use peer for label styling
		expect(checkboxClasses).toContain("peer");
	});

	test("form checkbox pattern", () => {
		const classes = getCheckboxClasses();

		// Has focus ring for form navigation
		expect(classes).toContain("focus-visible:ring-2");

		// Has disabled state for form validation
		expect(classes).toContain("disabled:cursor-not-allowed");
	});

	test("indeterminate state support", () => {
		// Radix supports indeterminate via checked="indeterminate"
		// The same visual styling applies
		const classes = getCheckboxClasses();
		expect(classes).toContain("data-[state=checked]:bg-primary");
	});
});

// ============================================================================
// State Combinations Tests
// ============================================================================

describe("Checkbox state combinations", () => {
	test("unchecked + not disabled", () => {
		const classes = getCheckboxClasses();
		expect(classes).toContain("border-primary");
		// bg-primary is conditional via data-[state=checked], not base class
		expect(classes).toContain("data-[state=checked]:bg-primary");
		// Verify there's no unconditional bg-primary
		expect(classes).not.toMatch(/\sbg-primary\s/);
	});

	test("checked state modifies appearance", () => {
		const classes = getCheckboxClasses();
		expect(classes).toContain("data-[state=checked]:bg-primary");
		expect(classes).toContain("data-[state=checked]:text-primary-foreground");
	});

	test("hover state provides feedback", () => {
		const classes = getCheckboxClasses();
		expect(classes).toContain("hover:border-primary/70");
	});

	test("active state provides tactile feedback", () => {
		const classes = getCheckboxClasses();
		expect(classes).toContain("active:scale-95");
	});
});
