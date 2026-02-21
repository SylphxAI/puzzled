/**
 * AlertDialog Component Tests
 *
 * Tests for alert dialog class generation, button variants, and ConfirmDialog helper.
 * AlertDialog uses CSS animations via data-state attributes.
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
// buttonVariants (from button.tsx - used by AlertDialogAction/Cancel)
// ============================================================================

type ButtonVariant =
	| "default"
	| "secondary"
	| "outline"
	| "ghost"
	| "destructive";

function buttonVariants({
	variant = "default",
	className,
}: {
	variant?: ButtonVariant;
	className?: string;
} = {}) {
	return cn(
		"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60",
		variant === "default" &&
			"bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:-translate-y-px hover:shadow-md",
		variant === "outline" &&
			"border border-border bg-background hover:bg-muted/50 hover:border-muted-foreground/40 hover:shadow-sm",
		variant === "destructive" &&
			"bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-md",
		"h-11 px-5 py-2", // Default size
		className,
	);
}

// ============================================================================
// AlertDialog Class Generators (from alert-dialog.tsx)
// ============================================================================

function getAlertDialogOverlayClasses(className?: string) {
	return cn(
		"alert-dialog-overlay fixed inset-0 z-modal bg-black/50",
		className,
	);
}

function getAlertDialogContentClasses(className?: string) {
	return cn(
		"alert-dialog-content fixed left-1/2 top-1/2 z-modal max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl border bg-card p-6 shadow-lg",
		className,
	);
}

function getAlertDialogHeaderClasses(className?: string) {
	return cn("flex flex-col space-y-2", className);
}

function getAlertDialogFooterClasses(className?: string) {
	return cn("flex justify-end gap-2 pt-4", className);
}

function getAlertDialogTitleClasses(className?: string) {
	return cn("text-lg font-semibold", className);
}

function getAlertDialogDescriptionClasses(className?: string) {
	return cn("text-sm text-muted-foreground", className);
}

function getAlertDialogActionClasses(
	variant: "default" | "destructive" = "default",
	className?: string,
) {
	return buttonVariants({ variant, className });
}

function getAlertDialogCancelClasses(className?: string) {
	return buttonVariants({ variant: "outline", className });
}

// ============================================================================
// AlertDialog Overlay Tests
// ============================================================================

describe("AlertDialogOverlay styles", () => {
	test("covers full viewport", () => {
		const classes = getAlertDialogOverlayClasses();
		expect(classes).toContain("fixed");
		expect(classes).toContain("inset-0");
	});

	test("uses z-modal z-index", () => {
		const classes = getAlertDialogOverlayClasses();
		expect(classes).toContain("z-modal");
	});

	test("has semi-transparent background", () => {
		const classes = getAlertDialogOverlayClasses();
		expect(classes).toContain("bg-black/50");
	});

	test("has CSS animation class", () => {
		const classes = getAlertDialogOverlayClasses();
		expect(classes).toContain("alert-dialog-overlay");
	});

	test("accepts custom className", () => {
		const classes = getAlertDialogOverlayClasses("backdrop-blur-sm");
		expect(classes).toContain("backdrop-blur-sm");
	});
});

// ============================================================================
// AlertDialog Content Tests
// ============================================================================

describe("AlertDialogContent styles", () => {
	test("has CSS animation class", () => {
		const classes = getAlertDialogContentClasses();
		expect(classes).toContain("alert-dialog-content");
	});

	test("is centered on screen", () => {
		const classes = getAlertDialogContentClasses();
		expect(classes).toContain("fixed");
		expect(classes).toContain("left-1/2");
		expect(classes).toContain("top-1/2");
		expect(classes).toContain("-translate-x-1/2");
		expect(classes).toContain("-translate-y-1/2");
	});

	test("uses z-modal z-index", () => {
		const classes = getAlertDialogContentClasses();
		expect(classes).toContain("z-modal");
	});

	test("has max height with overflow", () => {
		const classes = getAlertDialogContentClasses();
		expect(classes).toContain("max-h-[90vh]");
		expect(classes).toContain("overflow-auto");
	});

	test("has responsive width", () => {
		const classes = getAlertDialogContentClasses();
		expect(classes).toContain("w-full");
		expect(classes).toContain("max-w-lg");
	});

	test("has visual styling", () => {
		const classes = getAlertDialogContentClasses();
		expect(classes).toContain("rounded-xl");
		expect(classes).toContain("border");
		expect(classes).toContain("bg-card");
		expect(classes).toContain("shadow-lg");
	});

	test("has padding (unlike Dialog which has it in children)", () => {
		const classes = getAlertDialogContentClasses();
		expect(classes).toContain("p-6");
	});

	test("accepts custom className", () => {
		const classes = getAlertDialogContentClasses("max-w-md");
		expect(classes).toContain("max-w-md");
	});
});

// ============================================================================
// AlertDialog Header Tests
// ============================================================================

describe("AlertDialogHeader styles", () => {
	test("is flex column", () => {
		const classes = getAlertDialogHeaderClasses();
		expect(classes).toContain("flex");
		expect(classes).toContain("flex-col");
	});

	test("has vertical spacing", () => {
		const classes = getAlertDialogHeaderClasses();
		expect(classes).toContain("space-y-2");
	});

	test("has no padding (content provides it)", () => {
		const classes = getAlertDialogHeaderClasses();
		expect(classes).not.toContain("p-");
	});

	test("accepts custom className", () => {
		const classes = getAlertDialogHeaderClasses("pb-4");
		expect(classes).toContain("pb-4");
	});
});

// ============================================================================
// AlertDialog Footer Tests
// ============================================================================

describe("AlertDialogFooter styles", () => {
	test("is flex with end alignment", () => {
		const classes = getAlertDialogFooterClasses();
		expect(classes).toContain("flex");
		expect(classes).toContain("justify-end");
	});

	test("has gap between buttons", () => {
		const classes = getAlertDialogFooterClasses();
		expect(classes).toContain("gap-2");
	});

	test("has top padding only", () => {
		const classes = getAlertDialogFooterClasses();
		expect(classes).toContain("pt-4");
	});

	test("accepts custom className", () => {
		const classes = getAlertDialogFooterClasses("justify-between");
		expect(classes).toContain("justify-between");
	});
});

// ============================================================================
// AlertDialog Title Tests
// ============================================================================

describe("AlertDialogTitle styles", () => {
	test("has large text", () => {
		const classes = getAlertDialogTitleClasses();
		expect(classes).toContain("text-lg");
	});

	test("is semibold", () => {
		const classes = getAlertDialogTitleClasses();
		expect(classes).toContain("font-semibold");
	});

	test("accepts custom className", () => {
		const classes = getAlertDialogTitleClasses("text-xl");
		expect(classes).toContain("text-xl");
	});
});

// ============================================================================
// AlertDialog Description Tests
// ============================================================================

describe("AlertDialogDescription styles", () => {
	test("has small text", () => {
		const classes = getAlertDialogDescriptionClasses();
		expect(classes).toContain("text-sm");
	});

	test("has muted color", () => {
		const classes = getAlertDialogDescriptionClasses();
		expect(classes).toContain("text-muted-foreground");
	});

	test("accepts custom className", () => {
		const classes = getAlertDialogDescriptionClasses("text-base");
		expect(classes).toContain("text-base");
	});
});

// ============================================================================
// AlertDialog Action Button Tests
// ============================================================================

describe("AlertDialogAction button variants", () => {
	describe("default variant", () => {
		test("has primary styling", () => {
			const classes = getAlertDialogActionClasses("default");
			expect(classes).toContain("bg-primary");
			expect(classes).toContain("text-primary-foreground");
		});

		test("has hover state", () => {
			const classes = getAlertDialogActionClasses("default");
			expect(classes).toContain("hover:bg-primary/90");
		});

		test("meets 44px touch target", () => {
			const classes = getAlertDialogActionClasses("default");
			expect(classes).toContain("h-11");
		});
	});

	describe("destructive variant", () => {
		test("has destructive styling", () => {
			const classes = getAlertDialogActionClasses("destructive");
			expect(classes).toContain("bg-destructive");
			expect(classes).toContain("text-destructive-foreground");
		});

		test("has hover state", () => {
			const classes = getAlertDialogActionClasses("destructive");
			expect(classes).toContain("hover:bg-destructive/90");
		});

		test("meets 44px touch target", () => {
			const classes = getAlertDialogActionClasses("destructive");
			expect(classes).toContain("h-11");
		});
	});

	test("accepts custom className", () => {
		const classes = getAlertDialogActionClasses("default", "w-full");
		expect(classes).toContain("w-full");
	});
});

// ============================================================================
// AlertDialog Cancel Button Tests
// ============================================================================

describe("AlertDialogCancel button", () => {
	test("uses outline variant", () => {
		const classes = getAlertDialogCancelClasses();
		expect(classes).toContain("border");
		expect(classes).toContain("border-border");
		expect(classes).toContain("bg-background");
	});

	test("has hover state", () => {
		const classes = getAlertDialogCancelClasses();
		expect(classes).toContain("hover:bg-muted/50");
	});

	test("meets 44px touch target", () => {
		const classes = getAlertDialogCancelClasses();
		expect(classes).toContain("h-11");
	});

	test("has focus ring", () => {
		const classes = getAlertDialogCancelClasses();
		expect(classes).toContain("focus-visible:ring-2");
	});

	test("accepts custom className", () => {
		const classes = getAlertDialogCancelClasses("w-full");
		expect(classes).toContain("w-full");
	});
});

// ============================================================================
// Button Accessibility Tests
// ============================================================================

describe("AlertDialog button accessibility", () => {
	test("action and cancel both meet touch target", () => {
		const actionClasses = getAlertDialogActionClasses("default");
		const cancelClasses = getAlertDialogCancelClasses();

		expect(actionClasses).toContain("h-11");
		expect(cancelClasses).toContain("h-11");
	});

	test("buttons have focus visible states", () => {
		const actionClasses = getAlertDialogActionClasses("default");
		const cancelClasses = getAlertDialogCancelClasses();

		expect(actionClasses).toContain("focus-visible:ring-2");
		expect(cancelClasses).toContain("focus-visible:ring-2");
	});

	test("buttons have disabled states", () => {
		const actionClasses = getAlertDialogActionClasses("default");
		const cancelClasses = getAlertDialogCancelClasses();

		expect(actionClasses).toContain("disabled:opacity-60");
		expect(cancelClasses).toContain("disabled:opacity-60");
	});

	test("buttons have active feedback", () => {
		const actionClasses = getAlertDialogActionClasses("default");
		const cancelClasses = getAlertDialogCancelClasses();

		expect(actionClasses).toContain("active:scale-[0.98]");
		expect(cancelClasses).toContain("active:scale-[0.98]");
	});
});

// ============================================================================
// ConfirmDialog Pattern Tests
// ============================================================================

describe("ConfirmDialog composition", () => {
	test("uses AlertDialog structure", () => {
		const content = getAlertDialogContentClasses();
		const header = getAlertDialogHeaderClasses();
		const title = getAlertDialogTitleClasses();
		const description = getAlertDialogDescriptionClasses();
		const footer = getAlertDialogFooterClasses();

		// All parts should exist
		expect(content).toContain("alert-dialog-content");
		expect(header).toContain("flex-col");
		expect(title).toContain("font-semibold");
		expect(description).toContain("text-muted-foreground");
		expect(footer).toContain("justify-end");
	});

	test("destructive confirmation pattern", () => {
		const action = getAlertDialogActionClasses("destructive");
		const cancel = getAlertDialogCancelClasses();

		expect(action).toContain("bg-destructive");
		expect(cancel).toContain("border");
	});

	test("default confirmation pattern", () => {
		const action = getAlertDialogActionClasses("default");
		const cancel = getAlertDialogCancelClasses();

		expect(action).toContain("bg-primary");
		expect(cancel).toContain("border");
	});
});

// ============================================================================
// Icon Container Tests (ConfirmDialog uses warning icon)
// ============================================================================

describe("ConfirmDialog icon styling", () => {
	// The ConfirmDialog component has an icon container

	function getIconContainerClasses(variant: "default" | "destructive") {
		return cn(
			"flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
			variant === "destructive" ? "bg-destructive/10" : "bg-warning/10",
		);
	}

	function getIconClasses(variant: "default" | "destructive") {
		return cn(
			"h-5 w-5",
			variant === "destructive" ? "text-destructive" : "text-warning",
		);
	}

	test("icon container is centered circle", () => {
		const classes = getIconContainerClasses("default");
		expect(classes).toContain("flex");
		expect(classes).toContain("items-center");
		expect(classes).toContain("justify-center");
		expect(classes).toContain("rounded-full");
	});

	test("icon container has fixed size", () => {
		const classes = getIconContainerClasses("default");
		expect(classes).toContain("h-10");
		expect(classes).toContain("w-10");
		expect(classes).toContain("shrink-0");
	});

	test("destructive variant has destructive background", () => {
		const classes = getIconContainerClasses("destructive");
		expect(classes).toContain("bg-destructive/10");
	});

	test("default variant has warning background", () => {
		const classes = getIconContainerClasses("default");
		expect(classes).toContain("bg-warning/10");
	});

	test("icon has proper size", () => {
		const classes = getIconClasses("default");
		expect(classes).toContain("h-5");
		expect(classes).toContain("w-5");
	});

	test("destructive icon has destructive color", () => {
		const classes = getIconClasses("destructive");
		expect(classes).toContain("text-destructive");
	});

	test("default icon has warning color", () => {
		const classes = getIconClasses("default");
		expect(classes).toContain("text-warning");
	});
});

// ============================================================================
// CSS Animation Class Tests
// ============================================================================

describe("AlertDialog CSS animation classes", () => {
	test("overlay has animation class for CSS transitions", () => {
		const classes = getAlertDialogOverlayClasses();
		expect(classes).toContain("alert-dialog-overlay");
	});

	test("content has animation class for CSS transitions", () => {
		const classes = getAlertDialogContentClasses();
		expect(classes).toContain("alert-dialog-content");
	});
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("AlertDialog edge cases", () => {
	test("handles undefined className", () => {
		const classes = getAlertDialogContentClasses(undefined);
		expect(classes).toContain("alert-dialog-content");
	});

	test("handles empty className", () => {
		const classes = getAlertDialogContentClasses("");
		expect(classes).toContain("alert-dialog-content");
	});

	test("multiple custom classes merge correctly", () => {
		const classes = getAlertDialogContentClasses("bg-card/95 backdrop-blur-sm");
		expect(classes).toContain("backdrop-blur-sm");
	});

	test("default action variant when not specified", () => {
		const classes = getAlertDialogActionClasses();
		expect(classes).toContain("bg-primary");
	});
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("AlertDialog integration patterns", () => {
	test("delete confirmation dialog", () => {
		const content = getAlertDialogContentClasses();
		const action = getAlertDialogActionClasses("destructive");
		const cancel = getAlertDialogCancelClasses();

		expect(content).toContain("rounded-xl");
		expect(action).toContain("bg-destructive");
		expect(cancel).toContain("border");
	});

	test("save confirmation dialog", () => {
		const content = getAlertDialogContentClasses();
		const action = getAlertDialogActionClasses("default");
		const cancel = getAlertDialogCancelClasses();

		expect(content).toContain("rounded-xl");
		expect(action).toContain("bg-primary");
		expect(cancel).toContain("border");
	});

	test("unsaved changes dialog", () => {
		const title = getAlertDialogTitleClasses();
		const description = getAlertDialogDescriptionClasses();
		const footer = getAlertDialogFooterClasses();

		expect(title).toContain("font-semibold");
		expect(description).toContain("text-muted-foreground");
		expect(footer).toContain("gap-2"); // Space for multiple buttons
	});
});
