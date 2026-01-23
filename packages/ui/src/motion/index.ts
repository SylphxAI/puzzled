/**
 * Motion System
 *
 * Centralized animation system built on Framer Motion.
 * Provides consistent, reusable animations across the application.
 *
 * @example
 * // Use pre-built components
 * import { Fade, Scale, StaggerList, StaggerItem } from '@sylphx/ui/motion'
 *
 * // Use configuration values
 * import { duration, easing, spring } from '@sylphx/ui/motion'
 *
 * // Use variants directly
 * import { fadeUpVariants, staggerContainer } from '@sylphx/ui/motion'
 */

// Configuration
export { duration, easing, spring, stagger, transition } from './config'

// Variants
export {
	// Fade
	fadeVariants,
	fadeUpVariants,
	fadeDownVariants,
	fadeLeftVariants,
	fadeRightVariants,
	// Scale
	scaleVariants,
	scaleSpringVariants,
	popVariants,
	// Slide
	slideLeftVariants,
	slideRightVariants,
	slideUpVariants,
	slideDownVariants,
	// Stagger
	staggerContainer,
	staggerContainerFast,
	staggerContainerSlow,
	staggerItemVariants,
	staggerItemFadeVariants,
	staggerItemScaleVariants,
	// Sidebar
	sidebarContentVariants,
	backButtonVariants,
	// Loading
	skeletonVariants,
	contentVariants,
	// Interactive
	buttonTapVariants,
	cardHoverVariants,
	hoverScaleVariants,
} from './variants'

// Components
export {
	// Wrappers
	Fade,
	Scale,
	Slide,
	StaggerList,
	StaggerItem,
	Presence,
	SidebarContent,
	LoadingTransition,
	// List animations
	AnimatedList,
	AnimatedListItem,
	AnimatedRow,
	// Interactive elements
	InteractiveCard,
	Collapse,
	// Page-level wrappers (for server component content)
	AnimatedPage,
	AnimatedGrid,
	AnimatedSection,
	AnimatedEmptyState,
	// Button/Form animations
	AnimatedButtonContent,
	SuccessCheck,
	Shake,
	Pulse,
	// Framer Motion re-exports
	AnimatePresence,
	motion,
	// Types
	type HTMLMotionProps,
	type MotionProps,
} from './components'
