/**
 * Motion System
 *
 * Shared motion configuration, reduced-motion hooks and preferences used by
 * the UI components.
 */

// Configuration
export { duration, easing, spring, stagger, transition } from "./config";

// Hooks
export {
	useReducedMotion,
	getReducedMotionProps,
	getReducedMotionTransition,
} from "./use-reduced-motion";

// Preferences
export { MotionPreferences } from "./motion-preferences";
