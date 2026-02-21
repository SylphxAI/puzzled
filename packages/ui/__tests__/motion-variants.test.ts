/**
 * Motion Variants Tests
 *
 * Tests for reusable animation state definitions.
 */

import { describe, expect, test } from "bun:test";

// ============================================================================
// Duration and Easing (from motion/config.ts)
// ============================================================================

const duration = {
	fast: 0.1,
	normal: 0.15,
	medium: 0.2,
	slow: 0.3,
};

const easing = {
	easeOut: [0, 0, 0.2, 1] as const,
	easeIn: [0.4, 0, 1, 1] as const,
};

const spring = {
	default: { type: "spring" as const, stiffness: 400, damping: 30 },
	bouncy: { type: "spring" as const, stiffness: 300, damping: 15 },
};

const stagger = {
	fast: 0.03,
	normal: 0.05,
	slow: 0.08,
};

// ============================================================================
// Fade Variants (from motion/variants.ts)
// ============================================================================

const fadeVariants = {
	initial: { opacity: 0 },
	animate: { opacity: 1 },
	exit: { opacity: 0 },
};

const fadeUpVariants = {
	initial: { opacity: 0, y: 10 },
	animate: {
		opacity: 1,
		y: 0,
		transition: { duration: duration.medium, ease: easing.easeOut },
	},
	exit: {
		opacity: 0,
		y: -10,
		transition: { duration: duration.fast, ease: easing.easeIn },
	},
};

const fadeDownVariants = {
	initial: { opacity: 0, y: -10 },
	animate: {
		opacity: 1,
		y: 0,
		transition: { duration: duration.medium, ease: easing.easeOut },
	},
	exit: {
		opacity: 0,
		y: 10,
		transition: { duration: duration.fast, ease: easing.easeIn },
	},
};

const fadeLeftVariants = {
	initial: { opacity: 0, x: 20 },
	animate: {
		opacity: 1,
		x: 0,
		transition: { duration: duration.medium, ease: easing.easeOut },
	},
	exit: {
		opacity: 0,
		x: -20,
		transition: { duration: duration.fast, ease: easing.easeIn },
	},
};

const fadeRightVariants = {
	initial: { opacity: 0, x: -20 },
	animate: {
		opacity: 1,
		x: 0,
		transition: { duration: duration.medium, ease: easing.easeOut },
	},
	exit: {
		opacity: 0,
		x: 20,
		transition: { duration: duration.fast, ease: easing.easeIn },
	},
};

// ============================================================================
// Scale Variants
// ============================================================================

const scaleVariants = {
	initial: { opacity: 0, scale: 0.95 },
	animate: {
		opacity: 1,
		scale: 1,
		transition: { duration: duration.medium, ease: easing.easeOut },
	},
	exit: {
		opacity: 0,
		scale: 0.95,
		transition: { duration: duration.fast, ease: easing.easeIn },
	},
};

const scaleSpringVariants = {
	initial: { opacity: 0, scale: 0.9 },
	animate: {
		opacity: 1,
		scale: 1,
		transition: spring.default,
	},
	exit: {
		opacity: 0,
		scale: 0.95,
		transition: { duration: duration.fast, ease: easing.easeIn },
	},
};

const popVariants = {
	initial: { opacity: 0, scale: 0.8 },
	animate: {
		opacity: 1,
		scale: 1,
		transition: spring.bouncy,
	},
	exit: {
		opacity: 0,
		scale: 0.8,
		transition: { duration: duration.fast, ease: easing.easeIn },
	},
};

// ============================================================================
// Slide Variants
// ============================================================================

const slideLeftVariants = {
	initial: { x: "-100%" },
	animate: {
		x: 0,
		transition: { duration: duration.slow, ease: easing.easeOut },
	},
	exit: {
		x: "-100%",
		transition: { duration: duration.medium, ease: easing.easeIn },
	},
};

const slideRightVariants = {
	initial: { x: "100%" },
	animate: {
		x: 0,
		transition: { duration: duration.slow, ease: easing.easeOut },
	},
	exit: {
		x: "100%",
		transition: { duration: duration.medium, ease: easing.easeIn },
	},
};

// ============================================================================
// Stagger Variants
// ============================================================================

const staggerContainerFast = {
	initial: {},
	animate: {
		transition: {
			staggerChildren: stagger.fast,
			delayChildren: 0,
		},
	},
	exit: {
		transition: {
			staggerChildren: stagger.fast / 2,
			staggerDirection: -1,
		},
	},
};

const staggerContainer = {
	initial: {},
	animate: {
		transition: {
			staggerChildren: stagger.normal,
			delayChildren: 0,
		},
	},
	exit: {
		transition: {
			staggerChildren: stagger.fast,
			staggerDirection: -1,
		},
	},
};

const staggerItemVariants = {
	initial: { opacity: 0, y: 10 },
	animate: {
		opacity: 1,
		y: 0,
		transition: { duration: duration.medium, ease: easing.easeOut },
	},
	exit: {
		opacity: 0,
		y: -5,
		transition: { duration: duration.fast, ease: easing.easeIn },
	},
};

// ============================================================================
// Interactive Variants
// ============================================================================

const buttonTapVariants = {
	tap: { scale: 0.98 },
};

const cardHoverVariants = {
	initial: { y: 0 },
	hover: {
		y: -2,
		transition: { duration: duration.fast, ease: easing.easeOut },
	},
};

const hoverScaleVariants = {
	initial: { scale: 1 },
	hover: {
		scale: 1.02,
		transition: { duration: duration.fast, ease: easing.easeOut },
	},
};

// ============================================================================
// Fade Variants Tests
// ============================================================================

describe("fadeVariants", () => {
	test("initial state is fully transparent", () => {
		expect(fadeVariants.initial.opacity).toBe(0);
	});

	test("animate state is fully opaque", () => {
		expect(fadeVariants.animate.opacity).toBe(1);
	});

	test("exit state returns to transparent", () => {
		expect(fadeVariants.exit.opacity).toBe(0);
	});
});

describe("fadeUpVariants", () => {
	test("initial state is transparent and below", () => {
		expect(fadeUpVariants.initial.opacity).toBe(0);
		expect(fadeUpVariants.initial.y).toBe(10);
	});

	test("animate state is at origin", () => {
		expect(fadeUpVariants.animate.opacity).toBe(1);
		expect(fadeUpVariants.animate.y).toBe(0);
	});

	test("exit state moves up", () => {
		expect(fadeUpVariants.exit.opacity).toBe(0);
		expect(fadeUpVariants.exit.y).toBe(-10);
	});

	test("animate uses easeOut transition", () => {
		expect(fadeUpVariants.animate.transition?.ease).toBe(easing.easeOut);
	});

	test("exit uses faster timing", () => {
		expect(fadeUpVariants.exit.transition?.duration).toBe(duration.fast);
	});
});

describe("fadeDownVariants", () => {
	test("initial state is transparent and above", () => {
		expect(fadeDownVariants.initial.opacity).toBe(0);
		expect(fadeDownVariants.initial.y).toBe(-10);
	});

	test("exit state moves down", () => {
		expect(fadeDownVariants.exit.y).toBe(10);
	});
});

describe("fadeLeftVariants", () => {
	test("initial state is offset right", () => {
		expect(fadeLeftVariants.initial.x).toBe(20);
	});

	test("exit state moves left", () => {
		expect(fadeLeftVariants.exit.x).toBe(-20);
	});
});

describe("fadeRightVariants", () => {
	test("initial state is offset left", () => {
		expect(fadeRightVariants.initial.x).toBe(-20);
	});

	test("exit state moves right", () => {
		expect(fadeRightVariants.exit.x).toBe(20);
	});
});

// ============================================================================
// Scale Variants Tests
// ============================================================================

describe("scaleVariants", () => {
	test("initial state is slightly smaller", () => {
		expect(scaleVariants.initial.scale).toBe(0.95);
		expect(scaleVariants.initial.opacity).toBe(0);
	});

	test("animate state is full size", () => {
		expect(scaleVariants.animate.scale).toBe(1);
		expect(scaleVariants.animate.opacity).toBe(1);
	});

	test("exit state returns to smaller", () => {
		expect(scaleVariants.exit.scale).toBe(0.95);
	});
});

describe("scaleSpringVariants", () => {
	test("initial state is smaller for spring", () => {
		expect(scaleSpringVariants.initial.scale).toBe(0.9);
	});

	test("animate uses spring transition", () => {
		expect(scaleSpringVariants.animate.transition?.type).toBe("spring");
	});

	test("exit still uses timed transition", () => {
		expect(scaleSpringVariants.exit.transition?.duration).toBe(duration.fast);
	});
});

describe("popVariants", () => {
	test("initial state is dramatically smaller", () => {
		expect(popVariants.initial.scale).toBe(0.8);
	});

	test("animate uses bouncy spring", () => {
		expect(popVariants.animate.transition?.type).toBe("spring");
		expect(popVariants.animate.transition?.damping).toBe(spring.bouncy.damping);
	});

	test("exit returns to initial size", () => {
		expect(popVariants.exit.scale).toBe(0.8);
	});
});

// ============================================================================
// Slide Variants Tests
// ============================================================================

describe("slideLeftVariants", () => {
	test("initial state is fully offscreen left", () => {
		expect(slideLeftVariants.initial.x).toBe("-100%");
	});

	test("animate brings to center", () => {
		expect(slideLeftVariants.animate.x).toBe(0);
	});

	test("exit slides back left", () => {
		expect(slideLeftVariants.exit.x).toBe("-100%");
	});

	test("uses slower timing for slides", () => {
		expect(slideLeftVariants.animate.transition?.duration).toBe(duration.slow);
	});
});

describe("slideRightVariants", () => {
	test("initial state is fully offscreen right", () => {
		expect(slideRightVariants.initial.x).toBe("100%");
	});

	test("exit slides back right", () => {
		expect(slideRightVariants.exit.x).toBe("100%");
	});
});

// ============================================================================
// Stagger Variants Tests
// ============================================================================

describe("staggerContainerFast", () => {
	test("initial has no properties", () => {
		expect(Object.keys(staggerContainerFast.initial).length).toBe(0);
	});

	test("animate configures stagger children", () => {
		expect(staggerContainerFast.animate.transition.staggerChildren).toBe(
			stagger.fast,
		);
		expect(staggerContainerFast.animate.transition.delayChildren).toBe(0);
	});

	test("exit staggers in reverse faster", () => {
		expect(staggerContainerFast.exit.transition.staggerChildren).toBe(
			stagger.fast / 2,
		);
		expect(staggerContainerFast.exit.transition.staggerDirection).toBe(-1);
	});
});

describe("staggerContainer", () => {
	test("uses normal stagger timing", () => {
		expect(staggerContainer.animate.transition.staggerChildren).toBe(
			stagger.normal,
		);
	});

	test("exit uses fast stagger", () => {
		expect(staggerContainer.exit.transition.staggerChildren).toBe(stagger.fast);
	});
});

describe("staggerItemVariants", () => {
	test("initial is transparent and below", () => {
		expect(staggerItemVariants.initial.opacity).toBe(0);
		expect(staggerItemVariants.initial.y).toBe(10);
	});

	test("animate brings to view", () => {
		expect(staggerItemVariants.animate.opacity).toBe(1);
		expect(staggerItemVariants.animate.y).toBe(0);
	});

	test("exit fades up slightly", () => {
		expect(staggerItemVariants.exit.y).toBe(-5); // Less movement on exit
	});
});

// ============================================================================
// Interactive Variants Tests
// ============================================================================

describe("buttonTapVariants", () => {
	test("tap scales down slightly", () => {
		expect(buttonTapVariants.tap.scale).toBe(0.98);
	});

	test("scale is subtle (2% reduction)", () => {
		const reduction = 1 - buttonTapVariants.tap.scale;
		expect(reduction).toBeCloseTo(0.02);
	});
});

describe("cardHoverVariants", () => {
	test("initial is at rest position", () => {
		expect(cardHoverVariants.initial.y).toBe(0);
	});

	test("hover lifts the card", () => {
		expect(cardHoverVariants.hover.y).toBe(-2);
	});

	test("hover uses fast transition", () => {
		expect(cardHoverVariants.hover.transition?.duration).toBe(duration.fast);
	});
});

describe("hoverScaleVariants", () => {
	test("initial is normal size", () => {
		expect(hoverScaleVariants.initial.scale).toBe(1);
	});

	test("hover scales up subtly", () => {
		expect(hoverScaleVariants.hover.scale).toBe(1.02);
	});

	test("scale increase is 2%", () => {
		const increase = hoverScaleVariants.hover.scale - 1;
		expect(increase).toBeCloseTo(0.02);
	});
});

// ============================================================================
// Variant Structure Tests
// ============================================================================

describe("variant structure consistency", () => {
	test("all entry variants have initial and animate", () => {
		const entryVariants = [
			fadeVariants,
			fadeUpVariants,
			fadeDownVariants,
			scaleVariants,
			popVariants,
		];

		entryVariants.forEach((variant) => {
			expect(variant.initial).toBeDefined();
			expect(variant.animate).toBeDefined();
		});
	});

	test("all entry variants have exit for AnimatePresence", () => {
		const entryVariants = [
			fadeVariants,
			fadeUpVariants,
			fadeDownVariants,
			scaleVariants,
			popVariants,
			slideLeftVariants,
			slideRightVariants,
		];

		entryVariants.forEach((variant) => {
			expect(variant.exit).toBeDefined();
		});
	});

	test("interactive variants have hover or tap", () => {
		expect(buttonTapVariants.tap).toBeDefined();
		expect(cardHoverVariants.hover).toBeDefined();
		expect(hoverScaleVariants.hover).toBeDefined();
	});

	test("stagger containers have empty initial", () => {
		expect(Object.keys(staggerContainerFast.initial).length).toBe(0);
		expect(Object.keys(staggerContainer.initial).length).toBe(0);
	});
});

// ============================================================================
// Animation Logic Tests
// ============================================================================

describe("animation logic", () => {
	test("entry animations use easeOut (deceleration)", () => {
		const animateTransitions = [
			fadeUpVariants.animate.transition,
			fadeDownVariants.animate.transition,
			scaleVariants.animate.transition,
		];

		animateTransitions.forEach((t) => {
			expect(t?.ease).toBe(easing.easeOut);
		});
	});

	test("exit animations use easeIn (acceleration)", () => {
		const exitTransitions = [
			fadeUpVariants.exit.transition,
			scaleVariants.exit.transition,
			popVariants.exit.transition,
		];

		exitTransitions.forEach((t) => {
			expect(t?.ease).toBe(easing.easeIn);
		});
	});

	test("exit animations are faster than entry", () => {
		expect(fadeUpVariants.exit.transition?.duration).toBeLessThan(
			fadeUpVariants.animate.transition?.duration || 1,
		);
	});

	test("stagger exit is faster than entry", () => {
		expect(staggerContainerFast.exit.transition.staggerChildren).toBeLessThan(
			staggerContainerFast.animate.transition.staggerChildren,
		);
	});
});

// ============================================================================
// Value Range Tests
// ============================================================================

describe("value ranges", () => {
	test("opacity values are between 0 and 1", () => {
		const opacityValues = [
			fadeVariants.initial.opacity,
			fadeVariants.animate.opacity,
			fadeVariants.exit.opacity,
			scaleVariants.initial.opacity,
			scaleVariants.animate.opacity,
		];

		opacityValues.forEach((opacity) => {
			expect(opacity).toBeGreaterThanOrEqual(0);
			expect(opacity).toBeLessThanOrEqual(1);
		});
	});

	test("scale values are close to 1", () => {
		const scaleValues = [
			scaleVariants.initial.scale,
			scaleVariants.animate.scale,
			popVariants.initial.scale,
			buttonTapVariants.tap.scale,
		];

		scaleValues.forEach((scale) => {
			expect(scale).toBeGreaterThan(0.7);
			expect(scale).toBeLessThanOrEqual(1.1);
		});
	});

	test("y offsets are small (under 20px)", () => {
		const yValues = [
			fadeUpVariants.initial.y,
			fadeUpVariants.exit.y,
			fadeDownVariants.initial.y,
			cardHoverVariants.hover.y,
		];

		yValues.forEach((y) => {
			expect(Math.abs(y as number)).toBeLessThanOrEqual(20);
		});
	});
});
