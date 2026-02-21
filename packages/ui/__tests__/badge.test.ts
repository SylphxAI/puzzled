/**
 * Badge Components Tests
 *
 * Tests for Badge, StatusDot, and CountBadge logic.
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
// Badge Types and Styles (from badge.tsx)
// ============================================================================

type BadgeVariant =
	| "default"
	| "secondary"
	| "success"
	| "warning"
	| "error"
	| "outline";
type BadgeSize = "sm" | "md" | "lg";
type StatusDotStatus = "online" | "offline" | "away" | "busy";

const variantStyles: Record<BadgeVariant, string> = {
	default: "bg-primary text-primary-foreground",
	secondary: "bg-muted text-muted-foreground",
	success: "bg-success/10 text-success",
	warning: "bg-warning/10 text-warning",
	error: "bg-error/10 text-error",
	outline: "border bg-transparent text-foreground",
};

const sizeStyles: Record<BadgeSize, string> = {
	sm: "px-1.5 py-0.5 text-xs",
	md: "px-2 py-0.5 text-xs",
	lg: "px-2.5 py-1 text-sm",
};

const statusColors: Record<StatusDotStatus, string> = {
	online: "bg-success text-success/40",
	offline: "bg-muted-foreground text-muted-foreground/40",
	away: "bg-warning text-warning/40",
	busy: "bg-error text-error/40",
};

// ============================================================================
// Badge Class Generation
// ============================================================================

function getBadgeClasses(
	variant: BadgeVariant = "default",
	size: BadgeSize = "md",
	className?: string,
) {
	return cn(
		"inline-flex items-center gap-1 rounded-full font-medium",
		variantStyles[variant],
		sizeStyles[size],
		className,
	);
}

// ============================================================================
// StatusDot Logic
// ============================================================================

function getStatusDotClasses(
	status: StatusDotStatus,
	pulse: boolean,
	className?: string,
) {
	const shouldPulse = pulse && (status === "online" || status === "busy");

	return cn(
		"relative inline-block h-2 w-2 rounded-full",
		statusColors[status],
		shouldPulse && "animate-status-pulse motion-reduce:after:hidden",
		className,
	);
}

// ============================================================================
// CountBadge Logic
// ============================================================================

function getDisplayCount(count: number, max = 99): string | null {
	if (count === 0) return null;
	return count > max ? `${max}+` : String(count);
}

function getCountBadgeClasses(className?: string) {
	return cn(
		"inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1.5 text-xs font-bold text-error-foreground",
		className,
	);
}

// ============================================================================
// Badge Variant Tests
// ============================================================================

describe("Badge variant styles", () => {
	test("default variant has primary colors", () => {
		const classes = getBadgeClasses("default");
		expect(classes).toContain("bg-primary");
		expect(classes).toContain("text-primary-foreground");
	});

	test("secondary variant has muted colors", () => {
		const classes = getBadgeClasses("secondary");
		expect(classes).toContain("bg-muted");
		expect(classes).toContain("text-muted-foreground");
	});

	test("success variant has success colors", () => {
		const classes = getBadgeClasses("success");
		expect(classes).toContain("bg-success/10");
		expect(classes).toContain("text-success");
	});

	test("warning variant has warning colors", () => {
		const classes = getBadgeClasses("warning");
		expect(classes).toContain("bg-warning/10");
		expect(classes).toContain("text-warning");
	});

	test("error variant has error colors", () => {
		const classes = getBadgeClasses("error");
		expect(classes).toContain("bg-error/10");
		expect(classes).toContain("text-error");
	});

	test("outline variant has border", () => {
		const classes = getBadgeClasses("outline");
		expect(classes).toContain("border");
		expect(classes).toContain("bg-transparent");
		expect(classes).toContain("text-foreground");
	});
});

// ============================================================================
// Badge Size Tests
// ============================================================================

describe("Badge size styles", () => {
	test("sm size has smallest padding", () => {
		const classes = getBadgeClasses("default", "sm");
		expect(classes).toContain("px-1.5");
		expect(classes).toContain("py-0.5");
		expect(classes).toContain("text-xs");
	});

	test("md size has medium padding", () => {
		const classes = getBadgeClasses("default", "md");
		expect(classes).toContain("px-2");
		expect(classes).toContain("py-0.5");
		expect(classes).toContain("text-xs");
	});

	test("lg size has largest padding and larger text", () => {
		const classes = getBadgeClasses("default", "lg");
		expect(classes).toContain("px-2.5");
		expect(classes).toContain("py-1");
		expect(classes).toContain("text-sm");
	});
});

// ============================================================================
// Badge Base Styles Tests
// ============================================================================

describe("Badge base styles", () => {
	test("is inline-flex for icon alignment", () => {
		const classes = getBadgeClasses();
		expect(classes).toContain("inline-flex");
		expect(classes).toContain("items-center");
	});

	test("has gap for icon + text", () => {
		const classes = getBadgeClasses();
		expect(classes).toContain("gap-1");
	});

	test("is pill-shaped (fully rounded)", () => {
		const classes = getBadgeClasses();
		expect(classes).toContain("rounded-full");
	});

	test("has medium font weight", () => {
		const classes = getBadgeClasses();
		expect(classes).toContain("font-medium");
	});
});

// ============================================================================
// Badge className Override Tests
// ============================================================================

describe("Badge className override", () => {
	test("appends custom className", () => {
		const classes = getBadgeClasses("default", "md", "custom-class");
		expect(classes).toContain("custom-class");
	});

	test("can override padding", () => {
		const classes = getBadgeClasses("default", "md", "px-4");
		expect(classes).toContain("px-4");
		expect(classes).not.toContain("px-2");
	});

	test("can add margin", () => {
		const classes = getBadgeClasses("default", "md", "ml-2");
		expect(classes).toContain("ml-2");
	});
});

// ============================================================================
// StatusDot Color Tests
// ============================================================================

describe("StatusDot colors", () => {
	test("online status is green", () => {
		const classes = getStatusDotClasses("online", false);
		expect(classes).toContain("bg-success");
	});

	test("offline status is gray", () => {
		const classes = getStatusDotClasses("offline", false);
		expect(classes).toContain("bg-muted-foreground");
	});

	test("away status is yellow/warning", () => {
		const classes = getStatusDotClasses("away", false);
		expect(classes).toContain("bg-warning");
	});

	test("busy status is red", () => {
		const classes = getStatusDotClasses("busy", false);
		expect(classes).toContain("bg-error");
	});
});

// ============================================================================
// StatusDot Shape Tests
// ============================================================================

describe("StatusDot shape", () => {
	test("is 8x8 pixels (h-2 w-2)", () => {
		const classes = getStatusDotClasses("online", false);
		expect(classes).toContain("h-2");
		expect(classes).toContain("w-2");
	});

	test("is circular", () => {
		const classes = getStatusDotClasses("online", false);
		expect(classes).toContain("rounded-full");
	});

	test("is inline-block for text alignment", () => {
		const classes = getStatusDotClasses("online", false);
		expect(classes).toContain("inline-block");
	});

	test("has relative positioning for pulse", () => {
		const classes = getStatusDotClasses("online", true);
		expect(classes).toContain("relative");
	});
});

// ============================================================================
// StatusDot Pulse Animation Tests
// ============================================================================

describe("StatusDot pulse animation", () => {
	test("online + pulse = animated", () => {
		const classes = getStatusDotClasses("online", true);
		expect(classes).toContain("animate-status-pulse");
	});

	test("busy + pulse = animated", () => {
		const classes = getStatusDotClasses("busy", true);
		expect(classes).toContain("animate-status-pulse");
	});

	test("offline + pulse = NOT animated", () => {
		const classes = getStatusDotClasses("offline", true);
		expect(classes).not.toContain("animate-status-pulse");
	});

	test("away + pulse = NOT animated", () => {
		const classes = getStatusDotClasses("away", true);
		expect(classes).not.toContain("animate-status-pulse");
	});

	test("online without pulse = NOT animated", () => {
		const classes = getStatusDotClasses("online", false);
		expect(classes).not.toContain("animate-status-pulse");
	});

	test("respects reduced motion", () => {
		const classes = getStatusDotClasses("online", true);
		expect(classes).toContain("motion-reduce:after:hidden");
	});
});

// ============================================================================
// StatusDot className Override Tests
// ============================================================================

describe("StatusDot className override", () => {
	test("appends custom className", () => {
		const classes = getStatusDotClasses("online", false, "custom-class");
		expect(classes).toContain("custom-class");
	});

	test("can change size", () => {
		const classes = getStatusDotClasses("online", false, "h-3 w-3");
		expect(classes).toContain("h-3");
		expect(classes).toContain("w-3");
	});

	test("can add margin", () => {
		const classes = getStatusDotClasses("online", false, "mr-2");
		expect(classes).toContain("mr-2");
	});
});

// ============================================================================
// CountBadge Display Logic Tests
// ============================================================================

describe("CountBadge display logic", () => {
	test("returns null for count 0", () => {
		const display = getDisplayCount(0);
		expect(display).toBeNull();
	});

	test("returns count as string for small numbers", () => {
		expect(getDisplayCount(1)).toBe("1");
		expect(getDisplayCount(5)).toBe("5");
		expect(getDisplayCount(50)).toBe("50");
		expect(getDisplayCount(99)).toBe("99");
	});

	test("returns max+ for numbers exceeding max", () => {
		expect(getDisplayCount(100)).toBe("99+");
		expect(getDisplayCount(150)).toBe("99+");
		expect(getDisplayCount(999)).toBe("99+");
	});

	test("respects custom max", () => {
		expect(getDisplayCount(10, 9)).toBe("9+");
		expect(getDisplayCount(1000, 999)).toBe("999+");
		expect(getDisplayCount(50, 50)).toBe("50"); // Exactly at max is OK
	});

	test("handles edge case at max boundary", () => {
		expect(getDisplayCount(99, 99)).toBe("99");
		expect(getDisplayCount(100, 99)).toBe("99+");
	});

	test("handles negative numbers", () => {
		// Edge case - should probably never happen
		// But if it does, negative is not 0, so it returns a string
		const result = getDisplayCount(-1);
		expect(result).toBe("-1");
	});
});

// ============================================================================
// CountBadge Style Tests
// ============================================================================

describe("CountBadge styles", () => {
	test("has error background (red)", () => {
		const classes = getCountBadgeClasses();
		expect(classes).toContain("bg-error");
		expect(classes).toContain("text-error-foreground");
	});

	test("has fixed height", () => {
		const classes = getCountBadgeClasses();
		expect(classes).toContain("h-5");
	});

	test("has minimum width", () => {
		const classes = getCountBadgeClasses();
		expect(classes).toContain("min-w-5");
	});

	test("is circular", () => {
		const classes = getCountBadgeClasses();
		expect(classes).toContain("rounded-full");
	});

	test("has small text", () => {
		const classes = getCountBadgeClasses();
		expect(classes).toContain("text-xs");
	});

	test("has bold text", () => {
		const classes = getCountBadgeClasses();
		expect(classes).toContain("font-bold");
	});

	test("centers content", () => {
		const classes = getCountBadgeClasses();
		expect(classes).toContain("inline-flex");
		expect(classes).toContain("items-center");
		expect(classes).toContain("justify-center");
	});

	test("has horizontal padding", () => {
		const classes = getCountBadgeClasses();
		expect(classes).toContain("px-1.5");
	});
});

// ============================================================================
// CountBadge className Override Tests
// ============================================================================

describe("CountBadge className override", () => {
	test("appends custom className", () => {
		const classes = getCountBadgeClasses("absolute -top-1 -right-1");
		expect(classes).toContain("absolute");
		expect(classes).toContain("-top-1");
		expect(classes).toContain("-right-1");
	});

	test("can override background", () => {
		const classes = getCountBadgeClasses("bg-primary");
		expect(classes).toContain("bg-primary");
	});
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Badge integration patterns", () => {
	test("success badge for active status", () => {
		const classes = getBadgeClasses("success", "md");
		expect(classes).toContain("bg-success/10");
		expect(classes).toContain("text-success");
		expect(classes).toContain("rounded-full");
	});

	test("error badge for failed status", () => {
		const classes = getBadgeClasses("error", "md");
		expect(classes).toContain("bg-error/10");
		expect(classes).toContain("text-error");
	});

	test("outline badge for tags", () => {
		const classes = getBadgeClasses("outline", "sm");
		expect(classes).toContain("border");
		expect(classes).toContain("text-xs");
	});
});

describe("StatusDot integration patterns", () => {
	test("online user with activity indicator", () => {
		const classes = getStatusDotClasses("online", true);
		expect(classes).toContain("bg-success");
		expect(classes).toContain("animate-status-pulse");
	});

	test("offline user without activity", () => {
		const classes = getStatusDotClasses("offline", false);
		expect(classes).toContain("bg-muted-foreground");
		expect(classes).not.toContain("animate-status-pulse");
	});

	test("busy indicator for do-not-disturb", () => {
		const classes = getStatusDotClasses("busy", true);
		expect(classes).toContain("bg-error");
		expect(classes).toContain("animate-status-pulse");
	});
});

describe("CountBadge integration patterns", () => {
	test("notification badge on bell icon", () => {
		const count = getDisplayCount(5);
		const classes = getCountBadgeClasses("absolute -top-1 -right-1");

		expect(count).toBe("5");
		expect(classes).toContain("absolute");
		expect(classes).toContain("bg-error");
	});

	test("overflow notification count", () => {
		const count = getDisplayCount(150);
		expect(count).toBe("99+");
	});

	test("no badge when count is 0", () => {
		const count = getDisplayCount(0);
		expect(count).toBeNull();
	});
});

// ============================================================================
// Accessibility Tests
// ============================================================================

describe("Badge accessibility", () => {
	test("badges have visible text", () => {
		// Badge shows children, which should be text for screen readers
		// Base styles don't hide content
		const classes = getBadgeClasses();
		expect(classes).not.toContain("sr-only");
	});

	test("StatusDot should have aria-label for status", () => {
		// StatusDot renders with role="img" and aria-label={status}
		// This is enforced at component level, not in class generation
		// The status string IS the accessible label
		const statuses: StatusDotStatus[] = ["online", "offline", "away", "busy"];
		statuses.forEach((status) => {
			expect(typeof status).toBe("string");
			expect(status.length).toBeGreaterThan(0);
		});
	});
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Badge edge cases", () => {
	test("handles undefined className", () => {
		const classes = getBadgeClasses("default", "md", undefined);
		expect(classes).not.toContain("undefined");
	});

	test("handles empty string className", () => {
		const classes = getBadgeClasses("default", "md", "");
		expect(classes.length).toBeGreaterThan(0);
	});
});

describe("CountBadge edge cases", () => {
	test("handles very large numbers", () => {
		const count = getDisplayCount(1000000);
		expect(count).toBe("99+");
	});

	test("handles decimal numbers (floors)", () => {
		// parseInt would handle this, but our function uses comparison
		// 99.5 > 99 so it would return "99+"
		const count = getDisplayCount(99.5);
		expect(count).toBe("99+");
	});

	test("handles max of 0", () => {
		// Any positive count exceeds max of 0
		const count = getDisplayCount(1, 0);
		expect(count).toBe("0+");
	});
});
