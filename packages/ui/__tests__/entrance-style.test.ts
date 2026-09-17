/**
 * Entrance Style Tests
 *
 * Tests for the pure CSS entrance style helper shared by the CSS-first motion
 * components, including its reduced-motion branch.
 *
 * @see motion/entrance-style.ts
 */

import { describe, expect, test } from "bun:test";
import { entranceStyle } from "../src/motion/entrance-style";

const EASE_OUT = "cubic-bezier(0,0,0.2,1)";

describe("entranceStyle", () => {
	test("hides and offsets the element before it is in view", () => {
		const style = entranceStyle(
			false,
			{ duration: 0.2, delay: 0.05, translate: "translateY(8px)" },
			false,
		);

		expect(style.opacity).toBe(0);
		expect(style.transform).toBe("translateY(8px)");
		expect(style.transition).toBe(
			`opacity 0.2s ${EASE_OUT}, transform 0.2s ${EASE_OUT}`,
		);
		expect(style.transitionDelay).toBe("0s");
	});

	test("settles the element in view with its stagger delay", () => {
		const style = entranceStyle(
			true,
			{ duration: 0.1, delay: 0.06 },
			false,
		);

		expect(style.opacity).toBe(1);
		expect(style.transform).toBe("none");
		expect(style.transition).toBe(
			`opacity 0.1s ${EASE_OUT}, transform 0.1s ${EASE_OUT}`,
		);
		expect(style.transitionDelay).toBe("0.06s");
	});

	test("defaults the hidden transform", () => {
		expect(entranceStyle(false, { duration: 0.2 }, false).transform).toBe(
			"translateY(8px)",
		);
	});

	test("renders statically, with no transition, for reduced motion", () => {
		for (const inView of [false, true]) {
			const style = entranceStyle(
				inView,
				{ duration: 0.2, delay: 0.05, translate: "translateY(8px)" },
				true,
			);

			expect(style).toEqual({
				opacity: 1,
				transform: "none",
				transition: "none",
			});
		}
	});
});
