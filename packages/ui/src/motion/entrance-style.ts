/**
 * CSS Entrance Styles
 *
 * Pure style helpers for the CSS-first entrance animations.
 *
 * They return the unsettled (hidden) style until the element scrolls into
 * view, and the settled style — visible, untransformed, no transition — for
 * users who requested reduced motion, so the JavaScript-driven entrance is
 * skipped instead of played out with a shortened duration.
 *
 * @see use-reduced-motion.ts for the hook reading the media query.
 */

import type { CSSProperties } from "react";
import { easing } from "./config";

/** Pre-computed cubic-bezier string for easeOut */
const EASE_OUT = `cubic-bezier(${easing.easeOut.join(",")})`;

/** Build a CSS transition string for opacity + transform */
function cssTransition(dur: number) {
	return `opacity ${dur}s ${EASE_OUT}, transform ${dur}s ${EASE_OUT}`;
}

export interface EntranceStyleOptions {
	/** Duration in seconds */
	duration: number;
	/** Delay before the transition starts, in seconds */
	delay?: number;
	/** Hidden-state transform, defaults to `translateY(8px)` */
	translate?: string;
}

/**
 * CSS entrance style. When `prefersReduced` is true the settled style is
 * returned with no transition, so no movement reaches the user.
 */
export function entranceStyle(
	inView: boolean,
	opts: EntranceStyleOptions,
	prefersReduced: boolean,
): CSSProperties {
	if (prefersReduced) {
		return { opacity: 1, transform: "none", transition: "none" };
	}

	return {
		opacity: inView ? 1 : 0,
		transform: inView ? "none" : (opts.translate ?? "translateY(8px)"),
		transition: cssTransition(opts.duration),
		transitionDelay: inView ? `${opts.delay ?? 0}s` : "0s",
	};
}
