/**
 * Motion Preferences Tests
 *
 * Tests for the provider that gates Framer Motion's JavaScript/WAAPI-driven
 * animation behind `prefers-reduced-motion`.
 *
 * @see motion/motion-preferences.tsx
 */

import { describe, expect, test } from "bun:test";
import { MotionConfig } from "motion/react";
import { MotionPreferences } from "../src/motion/motion-preferences";

describe("MotionPreferences", () => {
	test("renders Framer's MotionConfig with reducedMotion set to user", () => {
		const element = MotionPreferences({ children: null });

		expect(element.type).toBe(MotionConfig);
		expect((element.props as { reducedMotion?: string }).reducedMotion).toBe(
			"user",
		);
	});

	test("passes the wrapped subtree through to the config", () => {
		const element = MotionPreferences({ children: "motion subtree" });

		expect((element.props as { children?: string }).children).toBe(
			"motion subtree",
		);
	});
});
