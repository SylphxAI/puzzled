"use client";

/**
 * Motion Preferences
 *
 * Gates Framer Motion's JavaScript/WAAPI-driven animation behind the user's
 * `prefers-reduced-motion` setting (WCAG 2.3.3).
 *
 * `MotionConfig` with `reducedMotion="user"` disables transform and layout
 * animation for users who asked for reduced motion while leaving opacity and
 * colour animation intact. Users without the preference see identical motion.
 *
 * The provider renders no DOM. Every `motion.*` / `AnimatePresence` subtree
 * this package renders that animates transform or layout values wraps itself
 * in it, so consumers are covered without extra wiring. Consumers that render
 * the re-exported `motion` / `AnimatePresence` primitives directly can wrap
 * their own subtree the same way.
 *
 * @example
 * <MotionPreferences>
 *   <motion.div animate={{ y: 0 }} />
 * </MotionPreferences>
 */

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

interface MotionPreferencesProps {
	/** Motion subtree to gate */
	children: ReactNode;
}

export function MotionPreferences({ children }: MotionPreferencesProps) {
	return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
