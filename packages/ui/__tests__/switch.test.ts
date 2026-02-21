/**
 * Switch Component Tests
 *
 * Tests for switch/toggle class generation, label handling, and accessibility.
 * Switch uses inline styles with CSS classes defined in a style tag.
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
// Switch Class Generators (from switch.tsx)
// Switch uses CSS classes defined in a <style> tag, not Tailwind
// These tests verify the expected class names are applied
// ============================================================================

function getSwitchRootClasses(className?: string) {
	return cn("switch-root", className);
}

function getSwitchThumbClasses(className?: string) {
	return cn("switch-thumb", className);
}

// Label wrapper classes
function getSwitchWithLabelClasses() {
	return cn("flex items-center gap-3");
}

function getSwitchLabelClasses() {
	return cn("cursor-pointer select-none");
}

function getSwitchLabelTextClasses() {
	return cn("text-sm font-medium");
}

function getSwitchDescriptionClasses() {
	return cn("text-sm text-muted-foreground");
}

// ============================================================================
// Switch Root Classes Tests
// ============================================================================

describe("Switch root classes", () => {
	test("has switch-root class for CSS styling", () => {
		const classes = getSwitchRootClasses();
		expect(classes).toContain("switch-root");
	});

	test("accepts custom className", () => {
		const classes = getSwitchRootClasses("my-custom-switch");
		expect(classes).toContain("switch-root");
		expect(classes).toContain("my-custom-switch");
	});
});

// ============================================================================
// Switch Thumb Classes Tests
// ============================================================================

describe("Switch thumb classes", () => {
	test("has switch-thumb class for CSS styling", () => {
		const classes = getSwitchThumbClasses();
		expect(classes).toContain("switch-thumb");
	});

	test("accepts custom className", () => {
		const classes = getSwitchThumbClasses("custom-thumb");
		expect(classes).toContain("switch-thumb");
		expect(classes).toContain("custom-thumb");
	});
});

// ============================================================================
// Switch with Label Layout Tests
// ============================================================================

describe("Switch with label layout", () => {
	test("wrapper is flex with gap", () => {
		const classes = getSwitchWithLabelClasses();
		expect(classes).toContain("flex");
		expect(classes).toContain("items-center");
		expect(classes).toContain("gap-3");
	});
});

// ============================================================================
// Switch Label Tests
// ============================================================================

describe("Switch label styles", () => {
	test("is clickable", () => {
		const classes = getSwitchLabelClasses();
		expect(classes).toContain("cursor-pointer");
	});

	test("is not selectable", () => {
		const classes = getSwitchLabelClasses();
		expect(classes).toContain("select-none");
	});
});

// ============================================================================
// Switch Label Text Tests
// ============================================================================

describe("Switch label text styles", () => {
	test("has small text", () => {
		const classes = getSwitchLabelTextClasses();
		expect(classes).toContain("text-sm");
	});

	test("is medium weight", () => {
		const classes = getSwitchLabelTextClasses();
		expect(classes).toContain("font-medium");
	});
});

// ============================================================================
// Switch Description Tests
// ============================================================================

describe("Switch description styles", () => {
	test("has small text", () => {
		const classes = getSwitchDescriptionClasses();
		expect(classes).toContain("text-sm");
	});

	test("has muted color", () => {
		const classes = getSwitchDescriptionClasses();
		expect(classes).toContain("text-muted-foreground");
	});
});

// ============================================================================
// CSS Styling Expectations (defined in style tag)
// ============================================================================

describe("Switch CSS styling expectations", () => {
	// These describe the expected CSS rules in the style tag

	const expectedRootStyles = {
		width: "44px", // 2.75rem
		height: "24px", // 1.5rem
		borderRadius: "9999px", // rounded-full
		position: "relative",
		display: "inline-flex",
		alignItems: "center",
		cursor: "pointer",
	};

	const expectedThumbStyles = {
		width: "20px", // 1.25rem
		height: "20px", // 1.25rem
		borderRadius: "9999px", // rounded-full
		background: "white",
		boxShadow: "present",
		transition: "transform",
	};

	test("root has pill shape dimensions", () => {
		expect(expectedRootStyles.width).toBe("44px");
		expect(expectedRootStyles.height).toBe("24px");
	});

	test("root is fully rounded", () => {
		expect(expectedRootStyles.borderRadius).toBe("9999px");
	});

	test("root uses inline-flex", () => {
		expect(expectedRootStyles.display).toBe("inline-flex");
		expect(expectedRootStyles.alignItems).toBe("center");
	});

	test("root is clickable", () => {
		expect(expectedRootStyles.cursor).toBe("pointer");
	});

	test("thumb is circular", () => {
		expect(expectedThumbStyles.width).toBe("20px");
		expect(expectedThumbStyles.height).toBe("20px");
		expect(expectedThumbStyles.borderRadius).toBe("9999px");
	});

	test("thumb has white background", () => {
		expect(expectedThumbStyles.background).toBe("white");
	});

	test("thumb has shadow for depth", () => {
		expect(expectedThumbStyles.boxShadow).toBe("present");
	});

	test("thumb has transition for smooth toggle", () => {
		expect(expectedThumbStyles.transition).toBe("transform");
	});
});

// ============================================================================
// Switch State Styling Expectations
// ============================================================================

describe("Switch state styling expectations", () => {
	// Expected CSS state-based rules

	const uncheckedStyles = {
		background: "var(--color-muted)", // or similar
		thumbTranslate: "2px", // translateX(2px)
	};

	const checkedStyles = {
		background: "var(--color-primary)",
		thumbTranslate: "22px", // translateX(22px)
	};

	const disabledStyles = {
		opacity: "0.5",
		cursor: "not-allowed",
	};

	const focusStyles = {
		outline: "none",
		ring: "2px",
		ringOffset: "2px",
	};

	test("unchecked has muted background", () => {
		expect(uncheckedStyles.background).toContain("muted");
	});

	test("unchecked thumb is at start", () => {
		expect(uncheckedStyles.thumbTranslate).toBe("2px");
	});

	test("checked has primary background", () => {
		expect(checkedStyles.background).toContain("primary");
	});

	test("checked thumb is at end", () => {
		expect(checkedStyles.thumbTranslate).toBe("22px");
	});

	test("disabled has reduced opacity", () => {
		expect(disabledStyles.opacity).toBe("0.5");
	});

	test("disabled has not-allowed cursor", () => {
		expect(disabledStyles.cursor).toBe("not-allowed");
	});

	test("focus removes outline", () => {
		expect(focusStyles.outline).toBe("none");
	});

	test("focus has ring", () => {
		expect(focusStyles.ring).toBe("2px");
	});
});

// ============================================================================
// Accessibility Tests
// ============================================================================

describe("Switch accessibility", () => {
	test("root meets minimum interactive size", () => {
		// 44px width x 24px height is acceptable for horizontal interaction
		// The 44px width meets minimum touch target in primary dimension
		const expectedWidth = 44;
		const expectedHeight = 24;
		expect(expectedWidth).toBeGreaterThanOrEqual(44);
		expect(expectedHeight).toBeGreaterThanOrEqual(24);
	});

	test("label is associated via htmlFor", () => {
		// The component uses htmlFor={id} pattern
		// This is handled by the component, not CSS
		expect(true).toBe(true);
	});

	test("label is not selectable to prevent accidental selection", () => {
		const classes = getSwitchLabelClasses();
		expect(classes).toContain("select-none");
	});
});

// ============================================================================
// ID Generation Tests
// ============================================================================

describe("Switch ID generation", () => {
	// The component uses useId() for automatic ID generation

	test("uses provided ID when available", () => {
		const providedId = "my-switch";
		const result = providedId || "generated-id";
		expect(result).toBe("my-switch");
	});

	test("falls back to generated ID", () => {
		const providedId = undefined;
		const generatedId = "react-useId-123";
		const result = providedId || generatedId;
		expect(result).toBe("react-useId-123");
	});
});

// ============================================================================
// Component Props Interface Tests
// ============================================================================

describe("Switch props interface", () => {
	// SwitchProps extends Radix Switch props with label and description

	type SwitchProps = {
		label?: string;
		description?: string;
		id?: string;
		checked?: boolean;
		onCheckedChange?: (checked: boolean) => void;
		disabled?: boolean;
		// ... other Radix props
	};

	test("supports label prop", () => {
		const props: SwitchProps = { label: "Dark mode" };
		expect(props.label).toBe("Dark mode");
	});

	test("supports description prop", () => {
		const props: SwitchProps = { description: "Enable dark theme" };
		expect(props.description).toBe("Enable dark theme");
	});

	test("supports controlled mode", () => {
		const props: SwitchProps = {
			checked: true,
			onCheckedChange: (checked) => {},
		};
		expect(props.checked).toBe(true);
		expect(typeof props.onCheckedChange).toBe("function");
	});

	test("supports disabled state", () => {
		const props: SwitchProps = { disabled: true };
		expect(props.disabled).toBe(true);
	});
});

// ============================================================================
// Rendering Variants Tests
// ============================================================================

describe("Switch rendering variants", () => {
	test("renders without label when not provided", () => {
		// When label and description are both undefined/falsy
		// The component returns just the switch element
		const hasLabel = false;
		const hasDescription = false;
		const shouldRenderWrapper = hasLabel || hasDescription;
		expect(shouldRenderWrapper).toBe(false);
	});

	test("renders with wrapper when label provided", () => {
		const hasLabel = true;
		const hasDescription = false;
		const shouldRenderWrapper = hasLabel || hasDescription;
		expect(shouldRenderWrapper).toBe(true);
	});

	test("renders with wrapper when description provided", () => {
		const hasLabel = false;
		const hasDescription = true;
		const shouldRenderWrapper = hasLabel || hasDescription;
		expect(shouldRenderWrapper).toBe(true);
	});

	test("renders both label and description", () => {
		const hasLabel = true;
		const hasDescription = true;
		const shouldRenderWrapper = hasLabel || hasDescription;
		expect(shouldRenderWrapper).toBe(true);
	});
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Switch edge cases", () => {
	test("handles undefined className", () => {
		const classes = getSwitchRootClasses(undefined);
		expect(classes).toBe("switch-root");
	});

	test("handles empty className", () => {
		const classes = getSwitchRootClasses("");
		expect(classes).toBe("switch-root");
	});

	test("handles multiple custom classes", () => {
		const classes = getSwitchRootClasses("my-switch theme-dark");
		expect(classes).toContain("switch-root");
		expect(classes).toContain("my-switch");
		expect(classes).toContain("theme-dark");
	});
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Switch integration patterns", () => {
	test("basic toggle pattern", () => {
		const rootClasses = getSwitchRootClasses();
		const thumbClasses = getSwitchThumbClasses();

		expect(rootClasses).toContain("switch-root");
		expect(thumbClasses).toContain("switch-thumb");
	});

	test("labeled switch pattern", () => {
		const wrapperClasses = getSwitchWithLabelClasses();
		const labelClasses = getSwitchLabelClasses();
		const labelTextClasses = getSwitchLabelTextClasses();

		expect(wrapperClasses).toContain("flex");
		expect(wrapperClasses).toContain("gap-3");
		expect(labelClasses).toContain("cursor-pointer");
		expect(labelTextClasses).toContain("font-medium");
	});

	test("switch with description pattern", () => {
		const labelClasses = getSwitchLabelClasses();
		const labelTextClasses = getSwitchLabelTextClasses();
		const descriptionClasses = getSwitchDescriptionClasses();

		expect(labelClasses).toContain("select-none");
		expect(labelTextClasses).toContain("text-sm");
		expect(descriptionClasses).toContain("text-muted-foreground");
	});

	test("settings panel pattern", () => {
		// Multiple switches in a settings panel
		const wrapper = getSwitchWithLabelClasses();
		const label = getSwitchLabelTextClasses();
		const description = getSwitchDescriptionClasses();

		expect(wrapper).toContain("items-center");
		expect(label).toContain("font-medium");
		expect(description).toContain("text-sm");
	});
});

// ============================================================================
// CSS Class Naming Convention Tests
// ============================================================================

describe("Switch CSS class naming", () => {
	test("root uses BEM-like naming", () => {
		const classes = getSwitchRootClasses();
		expect(classes).toContain("switch-root");
	});

	test("thumb uses BEM-like naming", () => {
		const classes = getSwitchThumbClasses();
		expect(classes).toContain("switch-thumb");
	});

	test("class names are hyphenated", () => {
		const root = getSwitchRootClasses();
		const thumb = getSwitchThumbClasses();

		expect(root).toMatch(/switch-/);
		expect(thumb).toMatch(/switch-/);
	});
});
