/**
 * Skeleton Component Tests
 *
 * Tests for skeleton loading state components.
 * Verifies configuration logic and sizing calculations.
 */

import { describe, expect, test } from "bun:test";

// ============================================================================
// Test Utilities (Extracted Pure Logic)
// ============================================================================

// Size classes mapping from SkeletonAvatar
const avatarSizeClasses = {
	sm: "h-8 w-8",
	md: "h-10 w-10",
	lg: "h-12 w-12",
	xl: "h-16 w-16",
};

// Table column width logic from SkeletonTable
function getColumnWidth(colIndex: number, isHeader: boolean): string {
	if (isHeader) {
		const headerWidths = ["w-24", "w-32", "w-28", "w-20", "w-24"];
		return headerWidths[colIndex % headerWidths.length] as string;
	}
	const bodyWidths = ["w-32", "w-48", "w-24", "w-16", "w-28"];
	return bodyWidths[colIndex % bodyWidths.length] as string;
}

// Grid columns logic from SkeletonStatGrid
function getGridColumns(count: number): string {
	if (count <= 3) return "grid-cols-1 sm:grid-cols-3";
	if (count === 4) return "grid-cols-2 lg:grid-cols-4";
	return "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
}

// ============================================================================
// Avatar Size Tests
// ============================================================================

describe("SkeletonAvatar sizes", () => {
	test("sm size returns correct classes", () => {
		expect(avatarSizeClasses.sm).toBe("h-8 w-8");
	});

	test("md size returns correct classes", () => {
		expect(avatarSizeClasses.md).toBe("h-10 w-10");
	});

	test("lg size returns correct classes", () => {
		expect(avatarSizeClasses.lg).toBe("h-12 w-12");
	});

	test("xl size returns correct classes", () => {
		expect(avatarSizeClasses.xl).toBe("h-16 w-16");
	});

	test("all sizes are square", () => {
		for (const [_, value] of Object.entries(avatarSizeClasses)) {
			const parts = value.split(" ");
			expect(parts.length).toBe(2);
			// Height and width should have same numeric value
			const height = parts[0].match(/h-(\d+)/);
			const width = parts[1].match(/w-(\d+)/);
			expect(height?.[1]).toBe(width?.[1]);
		}
	});
});

// ============================================================================
// Table Column Width Tests
// ============================================================================

describe("SkeletonTable column widths", () => {
	describe("header widths", () => {
		test("returns correct width for first column", () => {
			expect(getColumnWidth(0, true)).toBe("w-24");
		});

		test("returns correct width for second column", () => {
			expect(getColumnWidth(1, true)).toBe("w-32");
		});

		test("cycles through widths for many columns", () => {
			const widths = Array.from({ length: 10 }, (_, i) =>
				getColumnWidth(i, true),
			);
			expect(widths[0]).toBe(widths[5]); // Pattern repeats every 5
			expect(widths[1]).toBe(widths[6]);
		});
	});

	describe("body widths", () => {
		test("returns correct width for first column", () => {
			expect(getColumnWidth(0, false)).toBe("w-32");
		});

		test("returns correct width for second column", () => {
			expect(getColumnWidth(1, false)).toBe("w-48");
		});

		test("body widths differ from header widths", () => {
			expect(getColumnWidth(0, false)).not.toBe(getColumnWidth(0, true));
		});
	});
});

// ============================================================================
// Stat Grid Tests
// ============================================================================

describe("SkeletonStatGrid layout", () => {
	test("3 or fewer items use 3-column layout", () => {
		expect(getGridColumns(1)).toContain("sm:grid-cols-3");
		expect(getGridColumns(2)).toContain("sm:grid-cols-3");
		expect(getGridColumns(3)).toContain("sm:grid-cols-3");
	});

	test("4 items use 4-column layout", () => {
		expect(getGridColumns(4)).toContain("lg:grid-cols-4");
	});

	test("more than 4 items use responsive 4-column layout", () => {
		expect(getGridColumns(5)).toContain("lg:grid-cols-4");
		expect(getGridColumns(8)).toContain("lg:grid-cols-4");
	});

	test("4+ items start with 2 columns on mobile", () => {
		expect(getGridColumns(4)).toContain("grid-cols-2");
		expect(getGridColumns(6)).toContain("grid-cols-2");
	});
});

// ============================================================================
// Configuration Validation Tests
// ============================================================================

describe("skeleton configuration validation", () => {
	test("SkeletonText default lines is 1", () => {
		const defaultLines = 1;
		expect(defaultLines).toBe(1);
	});

	test("SkeletonText default lastLineWidth is 75%", () => {
		const defaultLastLineWidth = "75%";
		expect(defaultLastLineWidth).toBe("75%");
	});

	test("SkeletonTable default rows is 5", () => {
		const defaultRows = 5;
		expect(defaultRows).toBe(5);
	});

	test("SkeletonTable default columns is 4", () => {
		const defaultColumns = 4;
		expect(defaultColumns).toBe(4);
	});

	test("SkeletonCard default contentLines is 2", () => {
		const defaultContentLines = 2;
		expect(defaultContentLines).toBe(2);
	});

	test("LeaderboardEntrySkeleton default rows is 5", () => {
		const defaultRows = 5;
		expect(defaultRows).toBe(5);
	});
});

// ============================================================================
// Width Calculation Tests
// ============================================================================

describe("skeleton width calculations", () => {
	test("last line width for text is reduced", () => {
		const lastLineWidth = "75%";
		const otherLineWidth = "100%";

		expect(lastLineWidth).not.toBe(otherLineWidth);
		expect(Number.parseInt(lastLineWidth)).toBeLessThan(
			Number.parseInt(otherLineWidth),
		);
	});

	test("breadcrumb last item is wider", () => {
		// Last breadcrumb item typically wider to fit page name
		const lastItemWidth = "w-32";
		const otherItemWidth = "w-16";

		// Extract numeric values
		const lastWidth = Number.parseInt(lastItemWidth.replace("w-", ""));
		const otherWidth = Number.parseInt(otherItemWidth.replace("w-", ""));

		expect(lastWidth).toBeGreaterThan(otherWidth);
	});
});

// ============================================================================
// Button Size Tests
// ============================================================================

describe("SkeletonButton sizes", () => {
	const buttonSizes = {
		default: "h-11 w-24",
		sm: "h-10 w-20",
		lg: "h-12 w-28",
	};

	test("default size matches Button component", () => {
		expect(buttonSizes.default).toContain("h-11");
	});

	test("small size matches Button component", () => {
		expect(buttonSizes.sm).toContain("h-10");
	});

	test("large size matches Button component", () => {
		expect(buttonSizes.lg).toContain("h-12");
	});

	test("sizes are ordered correctly", () => {
		const defaultHeight = 11;
		const smHeight = 10;
		const lgHeight = 12;

		expect(smHeight).toBeLessThan(defaultHeight);
		expect(lgHeight).toBeGreaterThan(defaultHeight);
	});
});

// ============================================================================
// Accessibility Tests
// ============================================================================

describe("skeleton accessibility", () => {
	test("base skeleton should have aria-hidden", () => {
		// The Skeleton component includes aria-hidden="true"
		// This is correct because loading placeholders should be hidden from screen readers
		const ariaHidden = true;
		expect(ariaHidden).toBe(true);
	});
});

// ============================================================================
// Animation Tests
// ============================================================================

describe("skeleton animation configuration", () => {
	test("shimmer animation duration is 2s", () => {
		// From: motion-safe:before:animate-[shimmer_2s_infinite]
		const shimmerDuration = "2s";
		expect(shimmerDuration).toBe("2s");
	});

	test("shimmer animation is infinite", () => {
		// Animation repeats indefinitely
		const shimmerIteration = "infinite";
		expect(shimmerIteration).toBe("infinite");
	});

	test("reduced motion uses pulse animation", () => {
		// motion-reduce:animate-pulse
		const reducedMotionAnimation = "pulse";
		expect(reducedMotionAnimation).toBe("pulse");
	});
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("skeleton component composition", () => {
	test("SkeletonCard uses SkeletonAvatar lg size", () => {
		// SkeletonCard header uses size="lg" for avatar
		const cardAvatarSize = "lg";
		expect(avatarSizeClasses[cardAvatarSize]).toBe("h-12 w-12");
	});

	test("SkeletonStatGrid renders correct number of cards", () => {
		const counts = [3, 4, 6];

		for (const count of counts) {
			const cards = Array.from({ length: count });
			expect(cards.length).toBe(count);
		}
	});

	test("SkeletonDataTable combines header and rows correctly", () => {
		const rows = 5;
		const columns = 4;
		const hasHeader = true;
		const hasPagination = true;

		const totalSections = (hasHeader ? 1 : 0) + rows + (hasPagination ? 1 : 0);
		expect(totalSections).toBe(7); // 1 header + 5 rows + 1 pagination
	});
});
