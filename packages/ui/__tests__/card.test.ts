/**
 * Card Components Tests
 *
 * Tests for card layout component classes.
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
// Card Class Generators (from card.tsx)
// ============================================================================

function getCardClasses(className?: string) {
	return cn(
		"rounded-2xl border bg-card text-card-foreground",
		"shadow-[var(--shadow-card)] transition-all duration-200",
		"hover:shadow-[var(--shadow-card-hover)]",
		className,
	);
}

function getCardHeaderClasses(className?: string) {
	return cn("flex flex-col space-y-1.5 p-4 sm:p-6", className);
}

function getCardTitleClasses(className?: string) {
	return cn(
		"text-base font-semibold leading-none tracking-tight sm:text-lg",
		className,
	);
}

function getCardDescriptionClasses(className?: string) {
	return cn("text-sm text-muted-foreground", className);
}

function getCardContentClasses(className?: string) {
	return cn("p-4 pt-0 sm:p-6 sm:pt-0", className);
}

function getCardFooterClasses(className?: string) {
	return cn("flex items-center p-4 pt-0 sm:p-6 sm:pt-0", className);
}

// ============================================================================
// Card Base Tests
// ============================================================================

describe("Card base styles", () => {
	test("has large border radius (16px / rounded-2xl)", () => {
		const classes = getCardClasses();
		expect(classes).toContain("rounded-2xl");
	});

	test("has border", () => {
		const classes = getCardClasses();
		expect(classes).toContain("border");
	});

	test("has card background color", () => {
		const classes = getCardClasses();
		expect(classes).toContain("bg-card");
	});

	test("has card foreground text", () => {
		const classes = getCardClasses();
		expect(classes).toContain("text-card-foreground");
	});

	test("has shadow CSS variable", () => {
		const classes = getCardClasses();
		expect(classes).toContain("shadow-[var(--shadow-card)]");
	});

	test("has hover shadow", () => {
		const classes = getCardClasses();
		expect(classes).toContain("hover:shadow-[var(--shadow-card-hover)]");
	});

	test("has transition", () => {
		const classes = getCardClasses();
		expect(classes).toContain("transition-all");
		expect(classes).toContain("duration-200");
	});

	test("accepts custom className", () => {
		const classes = getCardClasses("custom-class");
		expect(classes).toContain("custom-class");
	});

	test("className can override border radius", () => {
		const classes = getCardClasses("rounded-lg");
		expect(classes).toContain("rounded-lg");
		expect(classes).not.toContain("rounded-2xl");
	});
});

// ============================================================================
// Card Header Tests
// ============================================================================

describe("CardHeader styles", () => {
	test("is flex column", () => {
		const classes = getCardHeaderClasses();
		expect(classes).toContain("flex");
		expect(classes).toContain("flex-col");
	});

	test("has vertical spacing", () => {
		const classes = getCardHeaderClasses();
		expect(classes).toContain("space-y-1.5");
	});

	test("has responsive padding", () => {
		const classes = getCardHeaderClasses();
		expect(classes).toContain("p-4");
		expect(classes).toContain("sm:p-6");
	});

	test("accepts custom className", () => {
		const classes = getCardHeaderClasses("bg-muted");
		expect(classes).toContain("bg-muted");
	});
});

// ============================================================================
// Card Title Tests
// ============================================================================

describe("CardTitle styles", () => {
	test("has base font size", () => {
		const classes = getCardTitleClasses();
		expect(classes).toContain("text-base");
	});

	test("has responsive larger size", () => {
		const classes = getCardTitleClasses();
		expect(classes).toContain("sm:text-lg");
	});

	test("is semibold", () => {
		const classes = getCardTitleClasses();
		expect(classes).toContain("font-semibold");
	});

	test("has tight leading", () => {
		const classes = getCardTitleClasses();
		expect(classes).toContain("leading-none");
	});

	test("has tight tracking", () => {
		const classes = getCardTitleClasses();
		expect(classes).toContain("tracking-tight");
	});

	test("accepts custom className", () => {
		const classes = getCardTitleClasses("text-2xl");
		expect(classes).toContain("text-2xl");
	});
});

// ============================================================================
// Card Description Tests
// ============================================================================

describe("CardDescription styles", () => {
	test("has small text", () => {
		const classes = getCardDescriptionClasses();
		expect(classes).toContain("text-sm");
	});

	test("has muted foreground color", () => {
		const classes = getCardDescriptionClasses();
		expect(classes).toContain("text-muted-foreground");
	});

	test("accepts custom className", () => {
		const classes = getCardDescriptionClasses("text-primary");
		expect(classes).toContain("text-primary");
	});
});

// ============================================================================
// Card Content Tests
// ============================================================================

describe("CardContent styles", () => {
	test("has responsive padding", () => {
		const classes = getCardContentClasses();
		expect(classes).toContain("p-4");
		expect(classes).toContain("sm:p-6");
	});

	test("has no top padding (flows from header)", () => {
		const classes = getCardContentClasses();
		expect(classes).toContain("pt-0");
		expect(classes).toContain("sm:pt-0");
	});

	test("accepts custom className", () => {
		const classes = getCardContentClasses("space-y-4");
		expect(classes).toContain("space-y-4");
	});

	test("can override padding", () => {
		const classes = getCardContentClasses("p-8");
		expect(classes).toContain("p-8");
	});
});

// ============================================================================
// Card Footer Tests
// ============================================================================

describe("CardFooter styles", () => {
	test("is flex row", () => {
		const classes = getCardFooterClasses();
		expect(classes).toContain("flex");
		expect(classes).toContain("items-center");
	});

	test("has responsive padding", () => {
		const classes = getCardFooterClasses();
		expect(classes).toContain("p-4");
		expect(classes).toContain("sm:p-6");
	});

	test("has no top padding (flows from content)", () => {
		const classes = getCardFooterClasses();
		expect(classes).toContain("pt-0");
		expect(classes).toContain("sm:pt-0");
	});

	test("accepts custom className", () => {
		const classes = getCardFooterClasses("justify-between");
		expect(classes).toContain("justify-between");
	});

	test("accepts gap class", () => {
		const classes = getCardFooterClasses("gap-2");
		expect(classes).toContain("gap-2");
	});
});

// ============================================================================
// Composition Tests
// ============================================================================

describe("Card composition", () => {
	test("all parts have consistent horizontal padding", () => {
		const header = getCardHeaderClasses();
		const content = getCardContentClasses();
		const footer = getCardFooterClasses();

		// All should have p-4 and sm:p-6 for consistent alignment
		expect(header).toContain("p-4");
		expect(content).toContain("p-4");
		expect(footer).toContain("p-4");

		expect(header).toContain("sm:p-6");
		expect(content).toContain("sm:p-6");
		expect(footer).toContain("sm:p-6");
	});

	test("content and footer have no top padding", () => {
		const content = getCardContentClasses();
		const footer = getCardFooterClasses();

		expect(content).toContain("pt-0");
		expect(footer).toContain("pt-0");
	});

	test("only header has full padding", () => {
		const header = getCardHeaderClasses();

		// Header doesn't have pt-0, so gets full padding
		expect(header).not.toContain("pt-0");
	});
});

// ============================================================================
// Responsive Tests
// ============================================================================

describe("Card responsive behavior", () => {
	test("card header has mobile and desktop padding", () => {
		const classes = getCardHeaderClasses();

		// Mobile first (p-4 = 16px)
		expect(classes).toContain("p-4");

		// Desktop (sm:p-6 = 24px)
		expect(classes).toContain("sm:p-6");
	});

	test("title has mobile and desktop font sizes", () => {
		const classes = getCardTitleClasses();

		// Mobile (text-base = 16px)
		expect(classes).toContain("text-base");

		// Desktop (sm:text-lg = 18px)
		expect(classes).toContain("sm:text-lg");
	});
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Card integration patterns", () => {
	test("full card structure", () => {
		const card = getCardClasses();
		const header = getCardHeaderClasses();
		const title = getCardTitleClasses();
		const description = getCardDescriptionClasses();
		const content = getCardContentClasses();
		const footer = getCardFooterClasses();

		// Card has shadow and hover
		expect(card).toContain("shadow-[var(--shadow-card)]");
		expect(card).toContain("hover:shadow-[var(--shadow-card-hover)]");

		// Header, content, footer align
		expect(header).toContain("p-4");
		expect(content).toContain("p-4");
		expect(footer).toContain("p-4");

		// Title and description have text styling
		expect(title).toContain("font-semibold");
		expect(description).toContain("text-muted-foreground");
	});

	test("simple card (direct content)", () => {
		// Card with just className="p-6" and children
		const card = getCardClasses("p-6");
		expect(card).toContain("p-6");
		expect(card).toContain("rounded-2xl");
	});

	test("card with custom footer alignment", () => {
		const footer = getCardFooterClasses("justify-between gap-4");
		expect(footer).toContain("justify-between");
		expect(footer).toContain("gap-4");
	});
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Card edge cases", () => {
	test("empty className", () => {
		const card = getCardClasses("");
		expect(card).toContain("rounded-2xl");
	});

	test("undefined className", () => {
		const card = getCardClasses(undefined);
		expect(card).toContain("rounded-2xl");
	});

	test("multiple custom classes", () => {
		const card = getCardClasses("max-w-md mx-auto hover:scale-105");
		expect(card).toContain("max-w-md");
		expect(card).toContain("mx-auto");
		expect(card).toContain("hover:scale-105");
	});
});
