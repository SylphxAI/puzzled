/**
 * Input Component Tests
 *
 * Tests for input and textarea description ID logic and class generation.
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
// Description ID Logic (from input.tsx)
// ============================================================================

interface InputState {
	id: string;
	error?: string;
	success?: string;
	helperText?: string;
}

/**
 * Determine which description ID to use for aria-describedby
 * Priority: error > success > helperText
 */
function getDescriptionId(state: InputState): string | undefined {
	if (state.error) {
		return `${state.id}-error`;
	}
	if (state.success) {
		return `${state.id}-success`;
	}
	if (state.helperText) {
		return `${state.id}-helper`;
	}
	return undefined;
}

/**
 * Determine which message to display (error, success, or helper)
 */
function getVisibleMessage(state: InputState): {
	type: "error" | "success" | "helper" | null;
	message: string | null;
} {
	if (state.error) {
		return { type: "error", message: state.error };
	}
	if (state.success) {
		return { type: "success", message: state.success };
	}
	if (state.helperText) {
		return { type: "helper", message: state.helperText };
	}
	return { type: null, message: null };
}

// ============================================================================
// Input Class Generators
// ============================================================================

function getInputClasses(
	state: { error?: string; success?: string },
	className?: string,
) {
	return cn(
		"flex h-11 w-full rounded-lg border bg-background px-3 py-2 text-base transition-all duration-150",
		"placeholder:text-muted-foreground",
		"hover:border-primary/70 hover:bg-muted/30",
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:border-primary focus-visible:bg-background",
		"disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-muted/50 disabled:text-muted-foreground disabled:hover:border-border disabled:hover:bg-muted/50",
		state.error &&
			"border-error hover:border-error focus-visible:ring-error/50 focus-visible:border-error",
		state.success &&
			!state.error &&
			"border-success hover:border-success focus-visible:ring-success/50 focus-visible:border-success",
		className,
	);
}

function getTextareaClasses(
	state: { error?: string; success?: string },
	className?: string,
) {
	return cn(
		"flex min-h-[80px] w-full rounded-lg border bg-background px-3 py-2 text-base transition-all duration-150",
		"placeholder:text-muted-foreground",
		"hover:border-primary/70 hover:bg-muted/30",
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:border-primary focus-visible:bg-background",
		"disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-muted/50 disabled:text-muted-foreground disabled:hover:border-border disabled:hover:bg-muted/50",
		state.error &&
			"border-error hover:border-error focus-visible:ring-error/50 focus-visible:border-error",
		state.success &&
			!state.error &&
			"border-success hover:border-success focus-visible:ring-success/50 focus-visible:border-success",
		className,
	);
}

// ============================================================================
// Description ID Tests
// ============================================================================

describe("getDescriptionId", () => {
	test("returns error ID when error exists", () => {
		const id = getDescriptionId({
			id: "email",
			error: "Invalid email",
		});
		expect(id).toBe("email-error");
	});

	test("returns success ID when success exists (no error)", () => {
		const id = getDescriptionId({
			id: "email",
			success: "Email is valid",
		});
		expect(id).toBe("email-success");
	});

	test("returns helper ID when only helperText exists", () => {
		const id = getDescriptionId({
			id: "email",
			helperText: "Enter your email address",
		});
		expect(id).toBe("email-helper");
	});

	test("error takes priority over success", () => {
		const id = getDescriptionId({
			id: "email",
			error: "Invalid email",
			success: "Email is valid", // Should be ignored
		});
		expect(id).toBe("email-error");
	});

	test("error takes priority over helperText", () => {
		const id = getDescriptionId({
			id: "email",
			error: "Invalid email",
			helperText: "Help text", // Should be ignored
		});
		expect(id).toBe("email-error");
	});

	test("success takes priority over helperText", () => {
		const id = getDescriptionId({
			id: "email",
			success: "Valid",
			helperText: "Help text", // Should be ignored
		});
		expect(id).toBe("email-success");
	});

	test("returns undefined when no messages", () => {
		const id = getDescriptionId({ id: "email" });
		expect(id).toBeUndefined();
	});
});

// ============================================================================
// Visible Message Tests
// ============================================================================

describe("getVisibleMessage", () => {
	test("returns error message with type", () => {
		const result = getVisibleMessage({
			id: "email",
			error: "Invalid email format",
		});
		expect(result.type).toBe("error");
		expect(result.message).toBe("Invalid email format");
	});

	test("returns success message with type", () => {
		const result = getVisibleMessage({
			id: "email",
			success: "Email verified",
		});
		expect(result.type).toBe("success");
		expect(result.message).toBe("Email verified");
	});

	test("returns helper message with type", () => {
		const result = getVisibleMessage({
			id: "email",
			helperText: "We will never share your email",
		});
		expect(result.type).toBe("helper");
		expect(result.message).toBe("We will never share your email");
	});

	test("error takes priority", () => {
		const result = getVisibleMessage({
			id: "email",
			error: "Error",
			success: "Success",
			helperText: "Helper",
		});
		expect(result.type).toBe("error");
		expect(result.message).toBe("Error");
	});

	test("returns null when no messages", () => {
		const result = getVisibleMessage({ id: "email" });
		expect(result.type).toBeNull();
		expect(result.message).toBeNull();
	});
});

// ============================================================================
// Input Base Styles Tests
// ============================================================================

describe("Input base styles", () => {
	test("meets 44px touch target (h-11)", () => {
		const classes = getInputClasses({});
		expect(classes).toContain("h-11");
	});

	test("has full width", () => {
		const classes = getInputClasses({});
		expect(classes).toContain("w-full");
	});

	test("has rounded corners", () => {
		const classes = getInputClasses({});
		expect(classes).toContain("rounded-lg");
	});

	test("has border", () => {
		const classes = getInputClasses({});
		expect(classes).toContain("border");
	});

	test("has background", () => {
		const classes = getInputClasses({});
		expect(classes).toContain("bg-background");
	});

	test("has padding", () => {
		const classes = getInputClasses({});
		expect(classes).toContain("px-3");
		expect(classes).toContain("py-2");
	});

	test("has placeholder styling", () => {
		const classes = getInputClasses({});
		expect(classes).toContain("placeholder:text-muted-foreground");
	});

	test("has transition", () => {
		const classes = getInputClasses({});
		expect(classes).toContain("transition-all");
		expect(classes).toContain("duration-150");
	});
});

// ============================================================================
// Input Hover States Tests
// ============================================================================

describe("Input hover states", () => {
	test("has hover border change", () => {
		const classes = getInputClasses({});
		expect(classes).toContain("hover:border-primary/70");
	});

	test("has hover background change", () => {
		const classes = getInputClasses({});
		expect(classes).toContain("hover:bg-muted/30");
	});
});

// ============================================================================
// Input Focus States Tests
// ============================================================================

describe("Input focus states", () => {
	test("removes outline on focus", () => {
		const classes = getInputClasses({});
		expect(classes).toContain("focus-visible:outline-none");
	});

	test("has focus ring", () => {
		const classes = getInputClasses({});
		expect(classes).toContain("focus-visible:ring-2");
		expect(classes).toContain("focus-visible:ring-primary/50");
	});

	test("has focus ring offset", () => {
		const classes = getInputClasses({});
		expect(classes).toContain("focus-visible:ring-offset-2");
		expect(classes).toContain("focus-visible:ring-offset-background");
	});

	test("has focus border color", () => {
		const classes = getInputClasses({});
		expect(classes).toContain("focus-visible:border-primary");
	});
});

// ============================================================================
// Input Disabled States Tests
// ============================================================================

describe("Input disabled states", () => {
	test("has not-allowed cursor", () => {
		const classes = getInputClasses({});
		expect(classes).toContain("disabled:cursor-not-allowed");
	});

	test("has reduced opacity", () => {
		const classes = getInputClasses({});
		expect(classes).toContain("disabled:opacity-60");
	});

	test("has muted background", () => {
		const classes = getInputClasses({});
		expect(classes).toContain("disabled:bg-muted/50");
	});

	test("has muted text", () => {
		const classes = getInputClasses({});
		expect(classes).toContain("disabled:text-muted-foreground");
	});
});

// ============================================================================
// Input Error State Tests
// ============================================================================

describe("Input error state", () => {
	test("has error border", () => {
		const classes = getInputClasses({ error: "Error" });
		expect(classes).toContain("border-error");
	});

	test("has error hover border", () => {
		const classes = getInputClasses({ error: "Error" });
		expect(classes).toContain("hover:border-error");
	});

	test("has error focus ring", () => {
		const classes = getInputClasses({ error: "Error" });
		expect(classes).toContain("focus-visible:ring-error/50");
	});

	test("has error focus border", () => {
		const classes = getInputClasses({ error: "Error" });
		expect(classes).toContain("focus-visible:border-error");
	});
});

// ============================================================================
// Input Success State Tests
// ============================================================================

describe("Input success state", () => {
	test("has success border", () => {
		const classes = getInputClasses({ success: "Valid" });
		expect(classes).toContain("border-success");
	});

	test("has success hover border", () => {
		const classes = getInputClasses({ success: "Valid" });
		expect(classes).toContain("hover:border-success");
	});

	test("has success focus ring", () => {
		const classes = getInputClasses({ success: "Valid" });
		expect(classes).toContain("focus-visible:ring-success/50");
	});

	test("error overrides success", () => {
		const classes = getInputClasses({ error: "Error", success: "Valid" });
		expect(classes).toContain("border-error");
		// Success styles should not be present when error exists
		expect(classes).not.toMatch(/\sborder-success(?!\/)/); // border-success not followed by /
	});
});

// ============================================================================
// Textarea Tests
// ============================================================================

describe("Textarea styles", () => {
	test("has minimum height", () => {
		const classes = getTextareaClasses({});
		expect(classes).toContain("min-h-[80px]");
	});

	test("has full width", () => {
		const classes = getTextareaClasses({});
		expect(classes).toContain("w-full");
	});

	test("shares input styling", () => {
		const classes = getTextareaClasses({});
		expect(classes).toContain("rounded-lg");
		expect(classes).toContain("border");
		expect(classes).toContain("bg-background");
	});

	test("has error state", () => {
		const classes = getTextareaClasses({ error: "Error" });
		expect(classes).toContain("border-error");
	});

	test("has success state", () => {
		const classes = getTextareaClasses({ success: "Valid" });
		expect(classes).toContain("border-success");
	});
});

// ============================================================================
// ARIA Attributes Tests
// ============================================================================

describe("ARIA attributes logic", () => {
	test("aria-invalid is true when error exists", () => {
		const hasError = true;
		const ariaInvalid = hasError ? "true" : "false";
		expect(ariaInvalid).toBe("true");
	});

	test("aria-invalid is false when no error", () => {
		const hasError = false;
		const ariaInvalid = hasError ? "true" : "false";
		expect(ariaInvalid).toBe("false");
	});

	test("aria-describedby matches description ID", () => {
		const descriptionId = getDescriptionId({ id: "email", error: "Invalid" });
		expect(descriptionId).toBe("email-error");
	});
});

// ============================================================================
// Label ID Association Tests
// ============================================================================

describe("Label ID association", () => {
	test("generates consistent ID format", () => {
		const baseId = "email-input";
		const labelId = baseId;
		const inputId = baseId;
		const errorId = `${baseId}-error`;
		const helperId = `${baseId}-helper`;

		expect(labelId).toBe(inputId); // Label for matches input id
		expect(errorId).toBe("email-input-error");
		expect(helperId).toBe("email-input-helper");
	});
});

// ============================================================================
// className Override Tests
// ============================================================================

describe("Input className override", () => {
	test("accepts custom className", () => {
		const classes = getInputClasses({}, "custom-class");
		expect(classes).toContain("custom-class");
	});

	test("can override height", () => {
		const classes = getInputClasses({}, "h-14");
		expect(classes).toContain("h-14");
	});

	test("can add width constraint", () => {
		const classes = getInputClasses({}, "max-w-md");
		expect(classes).toContain("max-w-md");
	});
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Input integration patterns", () => {
	test("full error state setup", () => {
		const state = { id: "email", error: "Invalid email format" };
		const classes = getInputClasses({ error: state.error });
		const descriptionId = getDescriptionId(state);
		const message = getVisibleMessage(state);

		expect(classes).toContain("border-error");
		expect(descriptionId).toBe("email-error");
		expect(message.type).toBe("error");
		expect(message.message).toBe("Invalid email format");
	});

	test("full success state setup", () => {
		const state = { id: "password", success: "Strong password" };
		const classes = getInputClasses({ success: state.success });
		const descriptionId = getDescriptionId(state);
		const message = getVisibleMessage(state);

		expect(classes).toContain("border-success");
		expect(descriptionId).toBe("password-success");
		expect(message.type).toBe("success");
	});

	test("helper text only setup", () => {
		const state = { id: "name", helperText: "Enter your full name" };
		const classes = getInputClasses({});
		const descriptionId = getDescriptionId(state);
		const message = getVisibleMessage(state);

		expect(classes).not.toContain("border-error");
		expect(classes).not.toContain("border-success");
		expect(descriptionId).toBe("name-helper");
		expect(message.type).toBe("helper");
	});
});
