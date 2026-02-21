/**
 * Sheet Component Tests
 *
 * Tests for sheet/drawer component class generation and side variants.
 * Sheet uses CSS transitions via data-state attributes from Radix UI.
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
// Sheet Class Generators (from sheet.tsx)
// ============================================================================

function getSheetOverlayClasses(className?: string) {
	return cn("sheet-overlay fixed inset-0 z-drawer bg-black/50", className);
}

type SheetSide = "top" | "bottom" | "left" | "right";

function getSheetPanelClasses(side: SheetSide = "right", className?: string) {
	const sideClasses = {
		top: "sheet-panel-top inset-x-0 top-0 border-b",
		bottom: "sheet-panel-bottom inset-x-0 bottom-0 border-t",
		left: "sheet-panel-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
		right:
			"sheet-panel-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
	};

	return cn(
		"sheet-panel fixed z-drawer bg-background shadow-lg",
		sideClasses[side],
		className,
	);
}

function getSheetHeaderClasses(className?: string) {
	return cn("flex flex-col space-y-2 p-4 border-b border-border", className);
}

function getSheetFooterClasses(className?: string) {
	return cn(
		"flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 p-4 border-t border-border",
		className,
	);
}

function getSheetTitleClasses(className?: string) {
	return cn("text-lg font-semibold", className);
}

function getSheetDescriptionClasses(className?: string) {
	return cn("text-sm text-muted-foreground", className);
}

function getSheetCloseButtonClasses() {
	return cn(
		// min-h-11 min-w-11 = 44px minimum touch target (WCAG 2.1 AA)
		"absolute right-4 top-4 flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground opacity-70 ring-offset-background transition-opacity",
		"hover:bg-muted hover:opacity-100",
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
		"disabled:pointer-events-none",
	);
}

// ============================================================================
// Sheet Overlay Tests
// ============================================================================

describe("SheetOverlay styles", () => {
	test("covers full viewport", () => {
		const classes = getSheetOverlayClasses();
		expect(classes).toContain("fixed");
		expect(classes).toContain("inset-0");
	});

	test("uses z-drawer z-index (higher than modal)", () => {
		const classes = getSheetOverlayClasses();
		expect(classes).toContain("z-drawer");
	});

	test("has semi-transparent background", () => {
		const classes = getSheetOverlayClasses();
		expect(classes).toContain("bg-black/50");
	});

	test("has CSS animation class", () => {
		const classes = getSheetOverlayClasses();
		expect(classes).toContain("sheet-overlay");
	});

	test("accepts custom className", () => {
		const classes = getSheetOverlayClasses("bg-black/80");
		expect(classes).toContain("bg-black/80");
	});
});

// ============================================================================
// Sheet Panel Base Styles Tests
// ============================================================================

describe("SheetPanel base styles", () => {
	test("has sheet-panel class for CSS animation", () => {
		const classes = getSheetPanelClasses("right");
		expect(classes).toContain("sheet-panel");
	});

	test("is fixed positioned", () => {
		const classes = getSheetPanelClasses("right");
		expect(classes).toContain("fixed");
	});

	test("uses z-drawer z-index", () => {
		const classes = getSheetPanelClasses("right");
		expect(classes).toContain("z-drawer");
	});

	test("has background color", () => {
		const classes = getSheetPanelClasses("right");
		expect(classes).toContain("bg-background");
	});

	test("has shadow", () => {
		const classes = getSheetPanelClasses("right");
		expect(classes).toContain("shadow-lg");
	});
});

// ============================================================================
// Sheet Side Variants Tests
// ============================================================================

describe("SheetPanel side variants", () => {
	describe("right side (default)", () => {
		test("has animation class", () => {
			const classes = getSheetPanelClasses("right");
			expect(classes).toContain("sheet-panel-right");
		});

		test("is positioned on right edge", () => {
			const classes = getSheetPanelClasses("right");
			expect(classes).toContain("right-0");
			expect(classes).toContain("inset-y-0");
		});

		test("has full height", () => {
			const classes = getSheetPanelClasses("right");
			expect(classes).toContain("h-full");
		});

		test("has responsive width", () => {
			const classes = getSheetPanelClasses("right");
			expect(classes).toContain("w-3/4");
			expect(classes).toContain("sm:max-w-sm");
		});

		test("has left border", () => {
			const classes = getSheetPanelClasses("right");
			expect(classes).toContain("border-l");
		});
	});

	describe("left side", () => {
		test("has animation class", () => {
			const classes = getSheetPanelClasses("left");
			expect(classes).toContain("sheet-panel-left");
		});

		test("is positioned on left edge", () => {
			const classes = getSheetPanelClasses("left");
			expect(classes).toContain("left-0");
			expect(classes).toContain("inset-y-0");
		});

		test("has full height", () => {
			const classes = getSheetPanelClasses("left");
			expect(classes).toContain("h-full");
		});

		test("has responsive width", () => {
			const classes = getSheetPanelClasses("left");
			expect(classes).toContain("w-3/4");
			expect(classes).toContain("sm:max-w-sm");
		});

		test("has right border", () => {
			const classes = getSheetPanelClasses("left");
			expect(classes).toContain("border-r");
		});
	});

	describe("top side", () => {
		test("has animation class", () => {
			const classes = getSheetPanelClasses("top");
			expect(classes).toContain("sheet-panel-top");
		});

		test("is positioned on top edge", () => {
			const classes = getSheetPanelClasses("top");
			expect(classes).toContain("top-0");
			expect(classes).toContain("inset-x-0");
		});

		test("has bottom border", () => {
			const classes = getSheetPanelClasses("top");
			expect(classes).toContain("border-b");
		});

		test("does not have height constraint", () => {
			const classes = getSheetPanelClasses("top");
			expect(classes).not.toContain("h-full");
		});
	});

	describe("bottom side", () => {
		test("has animation class", () => {
			const classes = getSheetPanelClasses("bottom");
			expect(classes).toContain("sheet-panel-bottom");
		});

		test("is positioned on bottom edge", () => {
			const classes = getSheetPanelClasses("bottom");
			expect(classes).toContain("bottom-0");
			expect(classes).toContain("inset-x-0");
		});

		test("has top border", () => {
			const classes = getSheetPanelClasses("bottom");
			expect(classes).toContain("border-t");
		});

		test("does not have height constraint", () => {
			const classes = getSheetPanelClasses("bottom");
			expect(classes).not.toContain("h-full");
		});
	});
});

// ============================================================================
// Sheet Header Tests
// ============================================================================

describe("SheetHeader styles", () => {
	test("is flex column", () => {
		const classes = getSheetHeaderClasses();
		expect(classes).toContain("flex");
		expect(classes).toContain("flex-col");
	});

	test("has vertical spacing", () => {
		const classes = getSheetHeaderClasses();
		expect(classes).toContain("space-y-2");
	});

	test("has padding", () => {
		const classes = getSheetHeaderClasses();
		expect(classes).toContain("p-4");
	});

	test("has bottom border", () => {
		const classes = getSheetHeaderClasses();
		expect(classes).toContain("border-b");
		expect(classes).toContain("border-border");
	});

	test("accepts custom className", () => {
		const classes = getSheetHeaderClasses("pb-6");
		expect(classes).toContain("pb-6");
	});
});

// ============================================================================
// Sheet Footer Tests
// ============================================================================

describe("SheetFooter styles", () => {
	test("is responsive flex", () => {
		const classes = getSheetFooterClasses();
		expect(classes).toContain("flex");
		expect(classes).toContain("flex-col-reverse");
		expect(classes).toContain("sm:flex-row");
	});

	test("has end alignment on desktop", () => {
		const classes = getSheetFooterClasses();
		expect(classes).toContain("sm:justify-end");
	});

	test("has spacing on desktop", () => {
		const classes = getSheetFooterClasses();
		expect(classes).toContain("sm:space-x-2");
	});

	test("has padding", () => {
		const classes = getSheetFooterClasses();
		expect(classes).toContain("p-4");
	});

	test("has top border", () => {
		const classes = getSheetFooterClasses();
		expect(classes).toContain("border-t");
		expect(classes).toContain("border-border");
	});

	test("accepts custom className", () => {
		const classes = getSheetFooterClasses("gap-4");
		expect(classes).toContain("gap-4");
	});
});

// ============================================================================
// Sheet Title Tests
// ============================================================================

describe("SheetTitle styles", () => {
	test("has large text", () => {
		const classes = getSheetTitleClasses();
		expect(classes).toContain("text-lg");
	});

	test("is semibold", () => {
		const classes = getSheetTitleClasses();
		expect(classes).toContain("font-semibold");
	});

	test("accepts custom className", () => {
		const classes = getSheetTitleClasses("text-xl");
		expect(classes).toContain("text-xl");
	});
});

// ============================================================================
// Sheet Description Tests
// ============================================================================

describe("SheetDescription styles", () => {
	test("has small text", () => {
		const classes = getSheetDescriptionClasses();
		expect(classes).toContain("text-sm");
	});

	test("has muted color", () => {
		const classes = getSheetDescriptionClasses();
		expect(classes).toContain("text-muted-foreground");
	});

	test("accepts custom className", () => {
		const classes = getSheetDescriptionClasses("text-base");
		expect(classes).toContain("text-base");
	});
});

// ============================================================================
// Sheet Close Button Tests (WCAG Compliance)
// ============================================================================

describe("SheetClose button accessibility", () => {
	test("meets 44px minimum touch target", () => {
		const classes = getSheetCloseButtonClasses();
		expect(classes).toContain("min-h-11");
		expect(classes).toContain("min-w-11");
	});

	test("is positioned in top right", () => {
		const classes = getSheetCloseButtonClasses();
		expect(classes).toContain("absolute");
		expect(classes).toContain("right-4");
		expect(classes).toContain("top-4");
	});

	test("is flex centered", () => {
		const classes = getSheetCloseButtonClasses();
		expect(classes).toContain("flex");
		expect(classes).toContain("items-center");
		expect(classes).toContain("justify-center");
	});

	test("is rounded for icon button", () => {
		const classes = getSheetCloseButtonClasses();
		expect(classes).toContain("rounded-full");
	});

	test("has hover state", () => {
		const classes = getSheetCloseButtonClasses();
		expect(classes).toContain("hover:bg-muted");
		expect(classes).toContain("hover:opacity-100");
	});

	test("has focus visible ring", () => {
		const classes = getSheetCloseButtonClasses();
		expect(classes).toContain("focus-visible:outline-none");
		expect(classes).toContain("focus-visible:ring-2");
		expect(classes).toContain("focus-visible:ring-ring");
		expect(classes).toContain("focus-visible:ring-offset-2");
	});

	test("has disabled state", () => {
		const classes = getSheetCloseButtonClasses();
		expect(classes).toContain("disabled:pointer-events-none");
	});
});

// ============================================================================
// Side Variant Consistency Tests
// ============================================================================

describe("Sheet side variants consistency", () => {
	test("all sides have animation class", () => {
		const sides: SheetSide[] = ["top", "bottom", "left", "right"];

		sides.forEach((side) => {
			const classes = getSheetPanelClasses(side);
			expect(classes).toContain(`sheet-panel-${side}`);
		});
	});

	test("horizontal sides have height and max-width", () => {
		const horizontalSides: SheetSide[] = ["left", "right"];

		horizontalSides.forEach((side) => {
			const classes = getSheetPanelClasses(side);
			expect(classes).toContain("h-full");
			expect(classes).toContain("w-3/4");
			expect(classes).toContain("sm:max-w-sm");
		});
	});

	test("vertical sides have full width", () => {
		const verticalSides: SheetSide[] = ["top", "bottom"];

		verticalSides.forEach((side) => {
			const classes = getSheetPanelClasses(side);
			expect(classes).toContain("inset-x-0");
		});
	});

	test("horizontal sides have full height", () => {
		const horizontalSides: SheetSide[] = ["left", "right"];

		horizontalSides.forEach((side) => {
			const classes = getSheetPanelClasses(side);
			expect(classes).toContain("inset-y-0");
		});
	});
});

// ============================================================================
// className Override Tests
// ============================================================================

describe("Sheet className overrides", () => {
	test("can override width on right sheet", () => {
		const classes = getSheetPanelClasses("right", "w-full sm:max-w-lg");
		expect(classes).toContain("sm:max-w-lg");
	});

	test("can add padding to panel", () => {
		const classes = getSheetPanelClasses("right", "p-6");
		expect(classes).toContain("p-6");
	});

	test("can override background", () => {
		const classes = getSheetPanelClasses("left", "bg-card");
		expect(classes).toContain("bg-card");
	});
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Sheet integration patterns", () => {
	test("navigation drawer pattern (left side)", () => {
		const panel = getSheetPanelClasses("left");
		const header = getSheetHeaderClasses();

		expect(panel).toContain("sheet-panel-left");
		expect(panel).toContain("left-0");
		expect(header).toContain("border-b");
	});

	test("detail panel pattern (right side)", () => {
		const panel = getSheetPanelClasses("right", "sm:max-w-md");
		const header = getSheetHeaderClasses();
		const footer = getSheetFooterClasses();

		expect(panel).toContain("sheet-panel-right");
		expect(panel).toContain("sm:max-w-md");
		expect(header).toContain("p-4");
		expect(footer).toContain("p-4");
	});

	test("action sheet pattern (bottom side)", () => {
		const panel = getSheetPanelClasses("bottom");

		expect(panel).toContain("sheet-panel-bottom");
		expect(panel).toContain("bottom-0");
		expect(panel).toContain("inset-x-0");
	});

	test("notification panel pattern (top side)", () => {
		const panel = getSheetPanelClasses("top");

		expect(panel).toContain("sheet-panel-top");
		expect(panel).toContain("top-0");
		expect(panel).toContain("inset-x-0");
	});
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Sheet edge cases", () => {
	test("handles undefined className", () => {
		const classes = getSheetPanelClasses("right", undefined);
		expect(classes).toContain("sheet-panel");
	});

	test("handles empty className", () => {
		const classes = getSheetPanelClasses("right", "");
		expect(classes).toContain("sheet-panel");
	});

	test("default side is right", () => {
		const defaultClasses = getSheetPanelClasses();
		const rightClasses = getSheetPanelClasses("right");
		expect(defaultClasses).toBe(rightClasses);
	});
});
