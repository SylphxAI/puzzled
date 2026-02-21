/**
 * Button Variants Tests
 *
 * Tests for button class generation logic.
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
// buttonVariants (from button.tsx)
// ============================================================================

type ButtonVariant =
	| "default"
	| "secondary"
	| "outline"
	| "ghost"
	| "destructive";
type ButtonSize = "default" | "sm" | "lg" | "icon";

function buttonVariants({
	variant = "default",
	size = "default",
	className,
}: {
	variant?: ButtonVariant;
	size?: ButtonSize;
	className?: string;
} = {}) {
	return cn(
		// Base styles
		"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60",
		// Variants
		variant === "default" &&
			"bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:-translate-y-px hover:shadow-md",
		variant === "secondary" &&
			"bg-muted text-foreground hover:bg-muted/70 hover:shadow-sm",
		variant === "outline" &&
			"border border-border bg-background hover:bg-muted/50 hover:border-muted-foreground/40 hover:shadow-sm",
		variant === "ghost" && "hover:bg-muted/80",
		variant === "destructive" &&
			"bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-md",
		// Sizes
		size === "default" && "h-11 px-5 py-2",
		size === "sm" && "h-11 px-4 text-sm",
		size === "lg" && "h-12 px-6 text-lg",
		size === "icon" && "h-11 w-11",
		className,
	);
}

// ============================================================================
// Base Styles Tests
// ============================================================================

describe("buttonVariants base styles", () => {
	test("includes inline-flex layout", () => {
		const result = buttonVariants();
		expect(result).toContain("inline-flex");
		expect(result).toContain("items-center");
		expect(result).toContain("justify-center");
	});

	test("includes gap for icon + text", () => {
		const result = buttonVariants();
		expect(result).toContain("gap-2");
	});

	test("includes whitespace-nowrap", () => {
		const result = buttonVariants();
		expect(result).toContain("whitespace-nowrap");
	});

	test("includes rounded corners", () => {
		const result = buttonVariants();
		expect(result).toContain("rounded-lg");
	});

	test("includes font-medium", () => {
		const result = buttonVariants();
		expect(result).toContain("font-medium");
	});

	test("includes transition", () => {
		const result = buttonVariants();
		expect(result).toContain("transition-all");
		expect(result).toContain("duration-150");
	});

	test("includes focus-visible ring", () => {
		const result = buttonVariants();
		expect(result).toContain("focus-visible:outline-none");
		expect(result).toContain("focus-visible:ring-2");
		expect(result).toContain("focus-visible:ring-ring");
		expect(result).toContain("focus-visible:ring-offset-2");
	});

	test("includes active scale effect", () => {
		const result = buttonVariants();
		expect(result).toContain("active:scale-[0.98]");
	});

	test("includes disabled styles", () => {
		const result = buttonVariants();
		expect(result).toContain("disabled:pointer-events-none");
		expect(result).toContain("disabled:opacity-60");
	});
});

// ============================================================================
// Variant Tests
// ============================================================================

describe("buttonVariants variant styles", () => {
	describe("default variant", () => {
		test("has primary background and foreground", () => {
			const result = buttonVariants({ variant: "default" });
			expect(result).toContain("bg-primary");
			expect(result).toContain("text-primary-foreground");
		});

		test("has shadow", () => {
			const result = buttonVariants({ variant: "default" });
			expect(result).toContain("shadow-sm");
		});

		test("has hover state", () => {
			const result = buttonVariants({ variant: "default" });
			expect(result).toContain("hover:bg-primary/90");
			expect(result).toContain("hover:-translate-y-px");
			expect(result).toContain("hover:shadow-md");
		});
	});

	describe("secondary variant", () => {
		test("has muted background", () => {
			const result = buttonVariants({ variant: "secondary" });
			expect(result).toContain("bg-muted");
			expect(result).toContain("text-foreground");
		});

		test("has hover state", () => {
			const result = buttonVariants({ variant: "secondary" });
			expect(result).toContain("hover:bg-muted/70");
			expect(result).toContain("hover:shadow-sm");
		});
	});

	describe("outline variant", () => {
		test("has border", () => {
			const result = buttonVariants({ variant: "outline" });
			expect(result).toContain("border");
			expect(result).toContain("border-border");
		});

		test("has transparent background", () => {
			const result = buttonVariants({ variant: "outline" });
			expect(result).toContain("bg-background");
		});

		test("has hover state", () => {
			const result = buttonVariants({ variant: "outline" });
			expect(result).toContain("hover:bg-muted/50");
			expect(result).toContain("hover:border-muted-foreground/40");
		});
	});

	describe("ghost variant", () => {
		test("has minimal styling (no base background)", () => {
			const result = buttonVariants({ variant: "ghost" });
			// Ghost should NOT have bg-primary or bg-muted as base (only hover)
			expect(result).not.toContain(" bg-primary");
			expect(result).not.toContain(" bg-destructive");
			// Ghost only has hover:bg-muted/80, not bg-muted as base
			expect(result).not.toMatch(/\sbg-muted\s/); // No base bg-muted (with spaces)
		});

		test("has hover background", () => {
			const result = buttonVariants({ variant: "ghost" });
			expect(result).toContain("hover:bg-muted/80");
		});
	});

	describe("destructive variant", () => {
		test("has destructive colors", () => {
			const result = buttonVariants({ variant: "destructive" });
			expect(result).toContain("bg-destructive");
			expect(result).toContain("text-destructive-foreground");
		});

		test("has hover state", () => {
			const result = buttonVariants({ variant: "destructive" });
			expect(result).toContain("hover:bg-destructive/90");
			expect(result).toContain("hover:shadow-md");
		});
	});
});

// ============================================================================
// Size Tests
// ============================================================================

describe("buttonVariants size styles", () => {
	describe("default size", () => {
		test("has h-11 (44px min touch target)", () => {
			const result = buttonVariants({ size: "default" });
			expect(result).toContain("h-11");
		});

		test("has horizontal padding", () => {
			const result = buttonVariants({ size: "default" });
			expect(result).toContain("px-5");
			expect(result).toContain("py-2");
		});
	});

	describe("sm size", () => {
		test("still meets 44px minimum height", () => {
			const result = buttonVariants({ size: "sm" });
			expect(result).toContain("h-11");
		});

		test("has smaller padding", () => {
			const result = buttonVariants({ size: "sm" });
			expect(result).toContain("px-4");
		});

		test("has smaller text", () => {
			const result = buttonVariants({ size: "sm" });
			expect(result).toContain("text-sm");
		});
	});

	describe("lg size", () => {
		test("has h-12 (48px)", () => {
			const result = buttonVariants({ size: "lg" });
			expect(result).toContain("h-12");
		});

		test("has larger padding", () => {
			const result = buttonVariants({ size: "lg" });
			expect(result).toContain("px-6");
		});

		test("has larger text", () => {
			const result = buttonVariants({ size: "lg" });
			expect(result).toContain("text-lg");
		});
	});

	describe("icon size", () => {
		test("is square (44x44)", () => {
			const result = buttonVariants({ size: "icon" });
			expect(result).toContain("h-11");
			expect(result).toContain("w-11");
		});

		test("does not have text padding", () => {
			const result = buttonVariants({ size: "icon" });
			// Should not have px-4, px-5, px-6 when icon size
			expect(result).not.toMatch(/px-[456]/);
		});
	});
});

// ============================================================================
// Combination Tests
// ============================================================================

describe("buttonVariants combinations", () => {
	test("variant and size combine correctly", () => {
		const result = buttonVariants({ variant: "destructive", size: "lg" });
		expect(result).toContain("bg-destructive");
		expect(result).toContain("h-12");
		expect(result).toContain("text-lg");
	});

	test("ghost + icon is minimal", () => {
		const result = buttonVariants({ variant: "ghost", size: "icon" });
		expect(result).toContain("hover:bg-muted/80");
		expect(result).toContain("h-11");
		expect(result).toContain("w-11");
	});

	test("outline + sm has border and small text", () => {
		const result = buttonVariants({ variant: "outline", size: "sm" });
		expect(result).toContain("border");
		expect(result).toContain("text-sm");
	});
});

// ============================================================================
// className Override Tests
// ============================================================================

describe("buttonVariants className override", () => {
	test("appends custom className", () => {
		const result = buttonVariants({ className: "custom-class" });
		expect(result).toContain("custom-class");
	});

	test("className can override size", () => {
		const result = buttonVariants({ size: "default", className: "h-20" });
		// tailwind-merge should resolve to h-20
		expect(result).toContain("h-20");
		expect(result).not.toContain("h-11");
	});

	test("className can override padding", () => {
		const result = buttonVariants({ size: "default", className: "px-10" });
		expect(result).toContain("px-10");
		expect(result).not.toContain("px-5");
	});

	test("className can add width", () => {
		const result = buttonVariants({ className: "w-full" });
		expect(result).toContain("w-full");
	});

	test("className can override rounded", () => {
		const result = buttonVariants({ className: "rounded-full" });
		expect(result).toContain("rounded-full");
		expect(result).not.toContain("rounded-lg");
	});
});

// ============================================================================
// Default Behavior Tests
// ============================================================================

describe("buttonVariants defaults", () => {
	test("uses default variant when not specified", () => {
		const result = buttonVariants();
		expect(result).toContain("bg-primary");
	});

	test("uses default size when not specified", () => {
		const result = buttonVariants();
		expect(result).toContain("h-11");
		expect(result).toContain("px-5");
	});

	test("empty options object uses defaults", () => {
		const result = buttonVariants({});
		expect(result).toContain("bg-primary");
		expect(result).toContain("h-11");
	});

	test("no arguments uses defaults", () => {
		const resultNoArgs = buttonVariants();
		const resultEmptyObj = buttonVariants({});
		expect(resultNoArgs).toBe(resultEmptyObj);
	});
});

// ============================================================================
// WCAG Accessibility Tests
// ============================================================================

describe("buttonVariants accessibility", () => {
	test("all sizes meet 44px minimum touch target", () => {
		const sizes: ButtonSize[] = ["default", "sm", "lg", "icon"];

		sizes.forEach((size) => {
			const result = buttonVariants({ size });
			// h-11 = 44px, h-12 = 48px
			const hasMinimumHeight =
				result.includes("h-11") || result.includes("h-12");
			expect(hasMinimumHeight).toBe(true);
		});
	});

	test("icon size has equal width and height", () => {
		const result = buttonVariants({ size: "icon" });
		expect(result).toContain("h-11");
		expect(result).toContain("w-11");
	});

	test("focus state is visible", () => {
		const result = buttonVariants();
		expect(result).toContain("focus-visible:ring-2");
	});

	test("disabled state is visually distinct", () => {
		const result = buttonVariants();
		expect(result).toContain("disabled:opacity-60");
	});
});

// ============================================================================
// Snapshot-like Tests
// ============================================================================

describe("buttonVariants output stability", () => {
	test("default button has expected classes", () => {
		const result = buttonVariants();

		// Base classes
		expect(result).toContain("inline-flex");
		expect(result).toContain("items-center");
		expect(result).toContain("justify-center");
		expect(result).toContain("rounded-lg");
		expect(result).toContain("font-medium");

		// Default variant
		expect(result).toContain("bg-primary");
		expect(result).toContain("text-primary-foreground");

		// Default size
		expect(result).toContain("h-11");
		expect(result).toContain("px-5");

		// Interaction states
		expect(result).toContain("focus-visible:ring-2");
		expect(result).toContain("active:scale-[0.98]");
		expect(result).toContain("disabled:opacity-60");
	});

	test("destructive icon button has expected classes", () => {
		const result = buttonVariants({ variant: "destructive", size: "icon" });

		expect(result).toContain("bg-destructive");
		expect(result).toContain("text-destructive-foreground");
		expect(result).toContain("h-11");
		expect(result).toContain("w-11");
	});

	test("ghost sm button has expected classes", () => {
		const result = buttonVariants({ variant: "ghost", size: "sm" });

		expect(result).toContain("hover:bg-muted/80");
		expect(result).toContain("text-sm");
		expect(result).toContain("h-11");
		expect(result).toContain("px-4");
	});
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("buttonVariants edge cases", () => {
	test("handles undefined className", () => {
		const result = buttonVariants({ className: undefined });
		expect(result).not.toContain("undefined");
	});

	test("handles empty string className", () => {
		const result = buttonVariants({ className: "" });
		// Should work without adding empty string
		expect(result.length).toBeGreaterThan(0);
	});

	test("handles complex className", () => {
		const result = buttonVariants({
			className: "w-full max-w-xs mt-4 hover:scale-105",
		});
		expect(result).toContain("w-full");
		expect(result).toContain("max-w-xs");
		expect(result).toContain("mt-4");
	});

	test("variant styles do not leak between variants", () => {
		const ghost = buttonVariants({ variant: "ghost" });
		const destructive = buttonVariants({ variant: "destructive" });

		// Ghost should not have destructive colors
		expect(ghost).not.toContain("bg-destructive");

		// Destructive should not have ghost's minimal style (only hover:bg-muted)
		expect(destructive).toContain("bg-destructive");
	});
});
