'use client'

/**
 * Motion Components
 *
 * Pre-configured motion components for common animation patterns.
 * These wrap Framer Motion primitives with sensible defaults.
 */

import {
	AnimatePresence,
	type HTMLMotionProps,
	type MotionProps,
	motion,
} from 'framer-motion'
import { Children, type ReactNode, forwardRef } from 'react'
import { duration, easing, spring, stagger } from './config'
import {
	fadeDownVariants,
	fadeLeftVariants,
	fadeRightVariants,
	fadeUpVariants,
	fadeVariants,
	scaleSpringVariants,
	scaleVariants,
	sidebarContentVariants,
	slideDownVariants,
	slideLeftVariants,
	slideRightVariants,
	slideUpVariants,
	staggerContainer,
	staggerContainerFast,
	staggerContainerSlow,
	staggerItemFadeVariants,
	staggerItemScaleVariants,
	staggerItemVariants,
} from './variants'

// ============================================================================
// Types
// ============================================================================

type Direction = 'up' | 'down' | 'left' | 'right'
type StaggerSpeed = 'fast' | 'normal' | 'slow'

interface FadeProps extends Omit<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'exit'> {
	/** Direction of movement during fade */
	direction?: Direction
	/** Custom duration override */
	duration?: number
	/** Custom delay */
	delay?: number
	/** Children to animate */
	children: ReactNode
}

interface ScaleProps extends Omit<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'exit'> {
	/** Use spring physics */
	spring?: boolean
	/** Children to animate */
	children: ReactNode
}

interface SlideProps extends Omit<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'exit'> {
	/** Direction to slide from */
	direction: Direction
	/** Children to animate */
	children: ReactNode
}

interface StaggerListProps extends Omit<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'exit'> {
	/** Stagger speed */
	speed?: StaggerSpeed
	/** Children to animate */
	children: ReactNode
}

interface StaggerItemProps extends Omit<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'exit'> {
	/** Animation type */
	type?: 'fade' | 'fadeUp' | 'scale'
	/** Children to animate */
	children: ReactNode
}

interface PresenceProps {
	/** Unique key for the current child */
	id?: string | number
	/** Animation mode */
	mode?: 'sync' | 'wait' | 'popLayout'
	/** Children to animate */
	children: ReactNode
	/** Initial animation on first render */
	initial?: boolean
}

// ============================================================================
// Fade Component
// ============================================================================

const fadeDirectionVariants = {
	up: fadeUpVariants,
	down: fadeDownVariants,
	left: fadeLeftVariants,
	right: fadeRightVariants,
	none: fadeVariants,
}

/**
 * Fade - Animated fade in/out with optional direction
 *
 * @example
 * <Fade direction="up">Content fades up</Fade>
 * <Fade delay={0.1}>Delayed fade</Fade>
 */
export const Fade = forwardRef<HTMLDivElement, FadeProps>(
	({ direction, duration: customDuration, delay, children, ...props }, ref) => {
		const variants = fadeDirectionVariants[direction ?? 'none']

		return (
			<motion.div
				ref={ref}
				variants={variants}
				initial="initial"
				animate="animate"
				exit="exit"
				transition={
					customDuration || delay
						? {
								duration: customDuration,
								delay,
								ease: easing.easeOut,
							}
						: undefined
				}
				{...props}
			>
				{children}
			</motion.div>
		)
	}
)
Fade.displayName = 'Fade'

// ============================================================================
// Scale Component
// ============================================================================

/**
 * Scale - Animated scale in/out
 *
 * @example
 * <Scale>Modal content</Scale>
 * <Scale spring>Bouncy scale</Scale>
 */
export const Scale = forwardRef<HTMLDivElement, ScaleProps>(
	({ spring: useSpring, children, ...props }, ref) => {
		return (
			<motion.div
				ref={ref}
				variants={useSpring ? scaleSpringVariants : scaleVariants}
				initial="initial"
				animate="animate"
				exit="exit"
				{...props}
			>
				{children}
			</motion.div>
		)
	}
)
Scale.displayName = 'Scale'

// ============================================================================
// Slide Component
// ============================================================================

const slideDirectionVariants = {
	up: slideUpVariants,
	down: slideDownVariants,
	left: slideLeftVariants,
	right: slideRightVariants,
}

/**
 * Slide - Full slide animation (100% translation)
 *
 * @example
 * <Slide direction="left">Drawer content</Slide>
 */
export const Slide = forwardRef<HTMLDivElement, SlideProps>(
	({ direction, children, ...props }, ref) => {
		return (
			<motion.div
				ref={ref}
				variants={slideDirectionVariants[direction]}
				initial="initial"
				animate="animate"
				exit="exit"
				{...props}
			>
				{children}
			</motion.div>
		)
	}
)
Slide.displayName = 'Slide'

// ============================================================================
// Stagger Components
// ============================================================================

const staggerSpeedVariants = {
	fast: staggerContainerFast,
	normal: staggerContainer,
	slow: staggerContainerSlow,
}

/**
 * StaggerList - Container for staggered child animations
 *
 * @example
 * <StaggerList speed="fast">
 *   <StaggerItem>Item 1</StaggerItem>
 *   <StaggerItem>Item 2</StaggerItem>
 * </StaggerList>
 */
export const StaggerList = forwardRef<HTMLDivElement, StaggerListProps>(
	({ speed = 'normal', children, ...props }, ref) => {
		return (
			<motion.div
				ref={ref}
				variants={staggerSpeedVariants[speed]}
				initial="initial"
				animate="animate"
				exit="exit"
				{...props}
			>
				{children}
			</motion.div>
		)
	}
)
StaggerList.displayName = 'StaggerList'

const staggerItemTypeVariants = {
	fade: staggerItemFadeVariants,
	fadeUp: staggerItemVariants,
	scale: staggerItemScaleVariants,
}

/**
 * StaggerItem - Child item for StaggerList
 *
 * @example
 * <StaggerItem type="fadeUp">List item</StaggerItem>
 */
export const StaggerItem = forwardRef<HTMLDivElement, StaggerItemProps>(
	({ type = 'fadeUp', children, ...props }, ref) => {
		return (
			<motion.div ref={ref} variants={staggerItemTypeVariants[type]} {...props}>
				{children}
			</motion.div>
		)
	}
)
StaggerItem.displayName = 'StaggerItem'

// ============================================================================
// Presence Wrapper
// ============================================================================

/**
 * Presence - Wrapper for AnimatePresence with sensible defaults
 *
 * @example
 * <Presence id={currentView}>
 *   {currentView === 'a' ? <ViewA /> : <ViewB />}
 * </Presence>
 */
export function Presence({ id, mode = 'wait', children, initial = false }: PresenceProps) {
	return (
		<AnimatePresence mode={mode} initial={initial}>
			{children}
		</AnimatePresence>
	)
}

// ============================================================================
// Sidebar Animation Component
// ============================================================================

interface SidebarContentProps extends Omit<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'exit'> {
	/** Unique key for content switching */
	contentKey: string
	/** Children to animate */
	children: ReactNode
}

/**
 * SidebarContent - Animated sidebar content with context switching
 *
 * @example
 * <AnimatePresence mode="wait">
 *   <SidebarContent key={currentService} contentKey={currentService}>
 *     {navItems}
 *   </SidebarContent>
 * </AnimatePresence>
 */
export const SidebarContent = forwardRef<HTMLDivElement, SidebarContentProps>(
	({ contentKey, children, ...props }, ref) => {
		return (
			<motion.div
				ref={ref}
				key={contentKey}
				variants={sidebarContentVariants}
				initial="initial"
				animate="animate"
				exit="exit"
				{...props}
			>
				{children}
			</motion.div>
		)
	}
)
SidebarContent.displayName = 'SidebarContent'

// ============================================================================
// Loading/Skeleton Transition
// ============================================================================

interface LoadingTransitionProps {
	/** Whether content is loading */
	isLoading: boolean
	/** Loading skeleton component */
	skeleton: ReactNode
	/** Actual content */
	children: ReactNode
	/** Additional class name */
	className?: string
}

/**
 * LoadingTransition - Smooth crossfade between skeleton and content
 *
 * @example
 * <LoadingTransition isLoading={isLoading} skeleton={<Skeleton />}>
 *   <ActualContent />
 * </LoadingTransition>
 */
export function LoadingTransition({
	isLoading,
	skeleton,
	children,
	className,
}: LoadingTransitionProps) {
	return (
		<div className={className}>
			<AnimatePresence mode="wait">
				{isLoading ? (
					<motion.div
						key="skeleton"
						initial={{ opacity: 1 }}
						exit={{ opacity: 0, transition: { duration: duration.normal, ease: easing.easeIn } }}
					>
						{skeleton}
					</motion.div>
				) : (
					<motion.div
						key="content"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1, transition: { duration: duration.medium, ease: easing.easeOut } }}
					>
						{children}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

// ============================================================================
// Animated List for Data Tables
// ============================================================================

interface AnimatedListProps extends Omit<HTMLMotionProps<'div'>, 'initial' | 'animate'> {
	/** Children to animate */
	children: ReactNode
	/** Stagger speed */
	speed?: StaggerSpeed
}

/**
 * AnimatedList - Container for animated list items
 *
 * Use with AnimatedListItem for staggered reveal of list contents.
 * Perfect for data tables, search results, etc.
 *
 * @example
 * <AnimatedList>
 *   {items.map((item) => (
 *     <AnimatedListItem key={item.id}>
 *       <TableRow data={item} />
 *     </AnimatedListItem>
 *   ))}
 * </AnimatedList>
 */
export const AnimatedList = forwardRef<HTMLDivElement, AnimatedListProps>(
	({ speed = 'fast', children, ...props }, ref) => {
		return (
			<motion.div
				ref={ref}
				variants={staggerSpeedVariants[speed]}
				initial="initial"
				animate="animate"
				{...props}
			>
				{children}
			</motion.div>
		)
	}
)
AnimatedList.displayName = 'AnimatedList'

interface AnimatedListItemProps extends Omit<HTMLMotionProps<'div'>, 'initial' | 'animate'> {
	/** Children to animate */
	children: ReactNode
}

/**
 * AnimatedListItem - Individual list item with stagger animation
 *
 * @example
 * <AnimatedListItem>
 *   <div className="p-4 border-b">Row content</div>
 * </AnimatedListItem>
 */
export const AnimatedListItem = forwardRef<HTMLDivElement, AnimatedListItemProps>(
	({ children, ...props }, ref) => {
		return (
			<motion.div ref={ref} variants={staggerItemFadeVariants} {...props}>
				{children}
			</motion.div>
		)
	}
)
AnimatedListItem.displayName = 'AnimatedListItem'

// ============================================================================
// Interactive Card
// ============================================================================

interface InteractiveCardProps extends Omit<HTMLMotionProps<'div'>, 'whileHover' | 'whileTap'> {
	/** Children to render */
	children: ReactNode
	/** Enable tap/press animation */
	pressable?: boolean
}

/**
 * InteractiveCard - Card with hover lift and optional press effect
 *
 * @example
 * <InteractiveCard pressable className="p-6 rounded-xl border bg-card">
 *   <h3>Clickable Card</h3>
 * </InteractiveCard>
 */
export const InteractiveCard = forwardRef<HTMLDivElement, InteractiveCardProps>(
	({ pressable = false, children, ...props }, ref) => {
		return (
			<motion.div
				ref={ref}
				whileHover={{ y: -2, transition: { duration: duration.fast, ease: easing.easeOut } }}
				whileTap={pressable ? { scale: 0.98 } : undefined}
				{...props}
			>
				{children}
			</motion.div>
		)
	}
)
InteractiveCard.displayName = 'InteractiveCard'

// ============================================================================
// Collapse Animation
// ============================================================================

interface CollapseProps {
	/** Whether the content is visible */
	isOpen: boolean
	/** Children to animate */
	children: ReactNode
	/** Additional class name */
	className?: string
}

/**
 * Collapse - Animated height transition for expandable content
 *
 * @example
 * <Collapse isOpen={expanded}>
 *   <div className="p-4">Collapsible content</div>
 * </Collapse>
 */
export function Collapse({ isOpen, children, className }: CollapseProps) {
	return (
		<AnimatePresence initial={false}>
			{isOpen && (
				<motion.div
					initial={{ height: 0, opacity: 0 }}
					animate={{ height: 'auto', opacity: 1 }}
					exit={{ height: 0, opacity: 0 }}
					transition={{ duration: duration.medium, ease: easing.easeInOut }}
					className={className}
					style={{ overflow: 'hidden' }}
				>
					{children}
				</motion.div>
			)}
		</AnimatePresence>
	)
}

// ============================================================================
// Page-Level Wrappers for Server Component Content
// ============================================================================

interface AnimatedPageProps {
	/** Children to animate */
	children: ReactNode
	/** Additional class name */
	className?: string
}

/**
 * AnimatedPage - Wraps server component content with fade animation
 *
 * Use at the top level of page content for entrance animation.
 *
 * @example
 * // In a client component wrapper
 * <AnimatedPage>
 *   {serverRenderedContent}
 * </AnimatedPage>
 */
export function AnimatedPage({ children, className }: AnimatedPageProps) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: duration.medium, ease: easing.easeOut }}
			className={className}
		>
			{children}
		</motion.div>
	)
}

interface AnimatedGridProps {
	/** Children to animate (should be direct child elements) */
	children: ReactNode
	/** Stagger speed */
	speed?: StaggerSpeed
	/** Additional class name for the grid container */
	className?: string
}

/**
 * AnimatedGrid - Staggers grid/list children with animations
 *
 * Wraps each direct child in a staggered animation.
 * Perfect for card grids, lists, etc.
 *
 * @example
 * <AnimatedGrid className="grid grid-cols-3 gap-4" speed="fast">
 *   <Card>1</Card>
 *   <Card>2</Card>
 *   <Card>3</Card>
 * </AnimatedGrid>
 */
export function AnimatedGrid({ children, speed = 'fast', className }: AnimatedGridProps) {
	return (
		<motion.div
			variants={staggerSpeedVariants[speed]}
			initial="initial"
			animate="animate"
			className={className}
		>
			{Children.map(children, (child) => (
				<motion.div variants={staggerItemFadeVariants}>{child}</motion.div>
			))}
		</motion.div>
	)
}

interface AnimatedSectionProps {
	/** Children to animate */
	children: ReactNode
	/** Delay before animation starts (in seconds) */
	delay?: number
	/** Additional class name */
	className?: string
}

/**
 * AnimatedSection - Fades in a section with optional delay
 *
 * @example
 * <AnimatedSection delay={0.1}>
 *   <h2>Section Title</h2>
 *   <p>Content...</p>
 * </AnimatedSection>
 */
export function AnimatedSection({ children, delay = 0, className }: AnimatedSectionProps) {
	return (
		<motion.section
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{
				duration: duration.medium,
				ease: easing.easeOut,
				delay,
			}}
			className={className}
		>
			{children}
		</motion.section>
	)
}

interface AnimatedEmptyStateProps {
	/** Icon component */
	icon: ReactNode
	/** Title text or element */
	title: ReactNode
	/** Description text or element */
	description?: ReactNode
	/** Action button/link */
	action?: ReactNode
	/** Additional class name */
	className?: string
}

/**
 * AnimatedEmptyState - Empty state with staggered entrance
 *
 * @example
 * <AnimatedEmptyState
 *   icon={<FolderIcon />}
 *   title="No items yet"
 *   description="Create your first item to get started."
 *   action={<Button>Create Item</Button>}
 * />
 */
export function AnimatedEmptyState({
	icon,
	title,
	description,
	action,
	className,
}: AnimatedEmptyStateProps) {
	return (
		<motion.div
			variants={staggerContainerFast}
			initial="initial"
			animate="animate"
			className={className}
		>
			<motion.div variants={staggerItemVariants}>{icon}</motion.div>
			<motion.h3 variants={staggerItemVariants}>{title}</motion.h3>
			{description && <motion.p variants={staggerItemVariants}>{description}</motion.p>}
			{action && <motion.div variants={staggerItemVariants}>{action}</motion.div>}
		</motion.div>
	)
}

// ============================================================================
// Re-export Framer Motion primitives
// ============================================================================

export { AnimatePresence, motion }
export type { HTMLMotionProps, MotionProps }
