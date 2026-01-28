'use client'

/**
 * Motion Components
 *
 * CSS-first animation system with Framer Motion reserved for
 * interactive/transient animations that CSS cannot handle
 * (AnimatePresence exits, springs, path drawing).
 *
 * Entrance animations use CSS transitions + IntersectionObserver
 * to avoid persistent `will-change` compositing layers that cause
 * subpixel rendering artifacts on card borders and shadows.
 */

import {
	AnimatePresence,
	type HTMLMotionProps,
	type MotionProps,
	motion,
	useInView,
} from 'motion/react'
import {
	Children,
	type HTMLAttributes,
	type ReactNode,
	type TableHTMLAttributes,
	createContext,
	forwardRef,
	useContext,
	useRef,
	useState,
} from 'react'
import { duration, easing, spring, stagger } from './config'
import {
	scaleSpringVariants,
	scaleVariants,
	sidebarContentVariants,
	slideDownVariants,
	slideLeftVariants,
	slideRightVariants,
	slideUpVariants,
} from './variants'

// ============================================================================
// Shared CSS Transition Helpers
// ============================================================================

/** Pre-computed cubic-bezier string for easeOut */
const EASE_OUT = `cubic-bezier(${easing.easeOut.join(',')})`

/** Build a CSS transition string for opacity + transform */
function cssTransition(dur: number) {
	return `opacity ${dur}s ${EASE_OUT}, transform ${dur}s ${EASE_OUT}`
}

/** CSS entrance style: hidden state or visible state */
function entranceStyle(
	inView: boolean,
	opts: {
		duration: number
		delay?: number
		translate?: string
	}
) {
	return {
		opacity: inView ? 1 : 0,
		transform: inView ? 'none' : (opts.translate ?? 'translateY(8px)'),
		transition: cssTransition(opts.duration),
		transitionDelay: inView ? `${opts.delay ?? 0}s` : '0s',
	} as const
}

// ============================================================================
// Types
// ============================================================================

type Direction = 'up' | 'down' | 'left' | 'right'
type StaggerSpeed = 'fast' | 'normal' | 'slow'

interface FadeProps {
	/** Direction of movement during fade */
	direction?: Direction
	/** Custom duration override */
	duration?: number
	/** Custom delay */
	delay?: number
	/** Children to animate */
	children: ReactNode
	/** Additional class name */
	className?: string
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

interface StaggerListProps {
	/** Stagger speed */
	speed?: StaggerSpeed
	/** Children to animate */
	children: ReactNode
	/** Additional class name */
	className?: string
}

interface StaggerItemProps {
	/** Animation type */
	type?: 'fade' | 'fadeUp' | 'scale'
	/** Children to animate */
	children: ReactNode
	/** Additional class name */
	className?: string
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
// Fade Component — CSS First
// ============================================================================

const fadeTranslates: Record<Direction | 'none', string> = {
	up: 'translateY(10px)',
	down: 'translateY(-10px)',
	left: 'translateX(20px)',
	right: 'translateX(-20px)',
	none: 'none',
}

/**
 * Fade - CSS transition fade with optional direction
 *
 * Uses IntersectionObserver for viewport-triggered animation.
 * No persistent compositing layers after animation completes.
 *
 * @example
 * <Fade direction="up">Content fades up</Fade>
 * <Fade delay={0.1}>Delayed fade</Fade>
 */
export function Fade({
	direction,
	duration: customDuration,
	delay,
	children,
	className,
}: FadeProps) {
	const ref = useRef<HTMLDivElement>(null)
	const inView = useInView(ref, { once: true, margin: '-32px' })
	const dir = direction ?? 'none'

	return (
		<div
			ref={ref}
			className={className}
			style={entranceStyle(inView, {
				duration: customDuration ?? duration.medium,
				delay,
				translate: fadeTranslates[dir],
			})}
		>
			{children}
		</div>
	)
}

// ============================================================================
// Scale Component — Framer Motion (AnimatePresence compatible)
// ============================================================================

/**
 * Scale - Animated scale in/out
 *
 * Kept as Framer Motion for AnimatePresence exit animations.
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
// Slide Component — Framer Motion (AnimatePresence compatible)
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
 * Kept as Framer Motion for AnimatePresence exit animations.
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
// Stagger Components — CSS First
// ============================================================================

/**
 * Context for passing viewport state and stagger timing from
 * StaggerList/AnimatedList to their child items.
 */
interface StaggerContextValue {
	inView: boolean
	step: number
	nextIndex: () => number
}

const StaggerContext = createContext<StaggerContextValue>({
	inView: true,
	step: 0,
	nextIndex: () => 0,
})

function resolveStep(speed: StaggerSpeed) {
	return speed === 'fast' ? stagger.fast : speed === 'normal' ? stagger.normal : stagger.slow
}

/**
 * StaggerList - CSS transition container for staggered child animations
 *
 * Uses IntersectionObserver + React context to coordinate
 * stagger timing across StaggerItem children.
 *
 * @example
 * <StaggerList speed="fast">
 *   <StaggerItem>Item 1</StaggerItem>
 *   <StaggerItem>Item 2</StaggerItem>
 * </StaggerList>
 */
export function StaggerList({ speed = 'normal', children, className }: StaggerListProps) {
	const ref = useRef<HTMLDivElement>(null)
	const inView = useInView(ref, { once: true, margin: '-32px' })
	const step = resolveStep(speed)
	const indexRef = useRef(0)
	// Reset counter on each render so items get consistent indices
	indexRef.current = 0

	return (
		<StaggerContext.Provider value={{ inView, step, nextIndex: () => indexRef.current++ }}>
			<div ref={ref} className={className}>
				{children}
			</div>
		</StaggerContext.Provider>
	)
}

const staggerItemTranslates = {
	fade: 'none',
	fadeUp: 'translateY(10px)',
	scale: 'scale(0.9)',
}

/**
 * StaggerItem - CSS transition child for StaggerList
 *
 * Captures its stagger index on mount and applies
 * a progressive delay via CSS transition-delay.
 *
 * @example
 * <StaggerItem type="fadeUp">List item</StaggerItem>
 */
export function StaggerItem({ type = 'fadeUp', children, className }: StaggerItemProps) {
	const { inView, step, nextIndex } = useContext(StaggerContext)
	const [index] = useState(() => nextIndex())
	const dur = type === 'fade' ? duration.normal : duration.medium

	return (
		<div
			className={className}
			style={entranceStyle(inView, {
				duration: dur,
				delay: index * step,
				translate: staggerItemTranslates[type],
			})}
		>
			{children}
		</div>
	)
}

// ============================================================================
// Presence Wrapper — Framer Motion
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
// Sidebar Animation Component — Framer Motion (AnimatePresence)
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
 * Kept as Framer Motion for AnimatePresence exit animations.
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
// Loading/Skeleton Transition — Framer Motion (AnimatePresence)
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
 * Kept as Framer Motion for AnimatePresence exit animations.
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
// Animated List for Data Tables — CSS First
// ============================================================================

interface AnimatedListProps {
	/** Children to animate */
	children: ReactNode
	/** Stagger speed */
	speed?: StaggerSpeed
	/** Additional class name */
	className?: string
}

/**
 * AnimatedList - CSS transition container for animated list items
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
export function AnimatedList({ speed = 'fast', children, className }: AnimatedListProps) {
	const ref = useRef<HTMLDivElement>(null)
	const inView = useInView(ref, { once: true, margin: '-32px' })
	const step = resolveStep(speed)
	const indexRef = useRef(0)
	indexRef.current = 0

	return (
		<StaggerContext.Provider value={{ inView, step, nextIndex: () => indexRef.current++ }}>
			<div ref={ref} className={className}>
				{children}
			</div>
		</StaggerContext.Provider>
	)
}

interface AnimatedListItemProps {
	/** Children to animate */
	children: ReactNode
	/** Additional class name */
	className?: string
}

/**
 * AnimatedListItem - CSS transition list item with stagger animation
 *
 * @example
 * <AnimatedListItem>
 *   <div className="p-4 border-b">Row content</div>
 * </AnimatedListItem>
 */
export function AnimatedListItem({ children, className }: AnimatedListItemProps) {
	const { inView, step, nextIndex } = useContext(StaggerContext)
	const [index] = useState(() => nextIndex())

	return (
		<div
			className={className}
			style={entranceStyle(inView, {
				duration: duration.normal,
				delay: index * step,
				translate: 'none',
			})}
		>
			{children}
		</div>
	)
}

// ============================================================================
// Interactive Card — CSS First
// ============================================================================

interface InteractiveCardProps extends HTMLAttributes<HTMLDivElement> {
	/** Children to render */
	children: ReactNode
	/** Enable tap/press animation */
	pressable?: boolean
}

/**
 * InteractiveCard - Card with CSS hover lift and optional press effect
 *
 * Uses CSS transitions for hover/active states instead of Framer Motion.
 * No persistent compositing layers.
 *
 * @example
 * <InteractiveCard pressable className="p-6 rounded-xl border bg-card">
 *   <h3>Clickable Card</h3>
 * </InteractiveCard>
 */
export function InteractiveCard({
	pressable = false,
	children,
	className,
	style,
	...props
}: InteractiveCardProps) {
	return (
		<div
			className={className}
			style={{
				transition: `transform ${duration.fast}s ${EASE_OUT}`,
				...style,
			}}
			onMouseEnter={(e) => {
				e.currentTarget.style.transform = 'translateY(-2px)'
			}}
			onMouseLeave={(e) => {
				// Use translateY(0) instead of 'none' to ensure smooth transition back
				e.currentTarget.style.transform = 'translateY(0)'
			}}
			onMouseDown={
				pressable
					? (e) => {
							e.currentTarget.style.transform = 'scale(0.98)'
						}
					: undefined
			}
			onMouseUp={
				pressable
					? (e) => {
							e.currentTarget.style.transform = 'translateY(-2px)'
						}
					: undefined
			}
			{...props}
		>
			{children}
		</div>
	)
}

// ============================================================================
// Collapse Animation — Framer Motion (AnimatePresence)
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
 * Kept as Framer Motion for AnimatePresence height animation.
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
// Page-Level Wrappers for Server Component Content — CSS First
// ============================================================================

interface AnimatedPageProps {
	/** Children to animate */
	children: ReactNode
	/** Additional class name */
	className?: string
}

/**
 * AnimatedPage - CSS transition page entrance animation
 *
 * Uses IntersectionObserver for viewport-triggered fade-up.
 * No persistent compositing layers after animation completes.
 *
 * @example
 * <AnimatedPage>
 *   {serverRenderedContent}
 * </AnimatedPage>
 */
export function AnimatedPage({ children, className }: AnimatedPageProps) {
	const ref = useRef<HTMLDivElement>(null)
	const inView = useInView(ref, { once: true })

	return (
		<div
			ref={ref}
			className={className}
			style={entranceStyle(inView, {
				duration: duration.medium,
				translate: 'translateY(8px)',
			})}
		>
			{children}
		</div>
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
 * AnimatedGrid - Staggers grid/list children with viewport-triggered animations
 *
 * Uses CSS transitions instead of Framer Motion wrappers to avoid
 * `will-change` compositing layers that cause subpixel rendering
 * artifacts on card borders and shadows.
 *
 * Each child gets a staggered fade-up entrance when the grid
 * enters the viewport. After animation, `transform: none` ensures
 * no persistent stacking context.
 *
 * @example
 * <AnimatedGrid className="grid grid-cols-3 gap-4" speed="fast">
 *   <Card>1</Card>
 *   <Card>2</Card>
 *   <Card>3</Card>
 * </AnimatedGrid>
 */
export function AnimatedGrid({ children, speed = 'fast', className }: AnimatedGridProps) {
	const ref = useRef<HTMLDivElement>(null)
	const inView = useInView(ref, { once: true, margin: '-32px' })
	const step = resolveStep(speed)

	return (
		<div ref={ref} className={className}>
			{Children.map(children, (child, i) =>
				child != null ? (
					<div
						style={entranceStyle(inView, {
							duration: duration.slower,
							delay: i * step,
							translate: 'translateY(8px)',
						})}
					>
						{child}
					</div>
				) : null
			)}
		</div>
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
 * AnimatedSection - CSS transition section with optional delay
 *
 * Uses IntersectionObserver for viewport-triggered fade-up.
 * No persistent compositing layers after animation completes.
 *
 * @example
 * <AnimatedSection delay={0.1}>
 *   <h2>Section Title</h2>
 *   <p>Content...</p>
 * </AnimatedSection>
 */
export function AnimatedSection({ children, delay = 0, className }: AnimatedSectionProps) {
	const ref = useRef<HTMLElement>(null)
	const inView = useInView(ref, { once: true, margin: '-32px' })

	return (
		<section
			ref={ref}
			className={className}
			style={entranceStyle(inView, {
				duration: duration.medium,
				delay,
				translate: 'translateY(12px)',
			})}
		>
			{children}
		</section>
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
 * AnimatedEmptyState - CSS transition empty state with staggered entrance
 *
 * Each child element (icon, title, description, action) enters
 * with a progressive delay for a staggered reveal effect.
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
	const ref = useRef<HTMLDivElement>(null)
	const inView = useInView(ref, { once: true, margin: '-32px' })
	const step = stagger.fast

	const itemStyle = (i: number) =>
		entranceStyle(inView, {
			duration: duration.medium,
			delay: i * step,
			translate: 'translateY(10px)',
		})

	let idx = 0
	return (
		<div ref={ref} className={className}>
			<div style={itemStyle(idx++)}>{icon}</div>
			<h3 style={itemStyle(idx++)}>{title}</h3>
			{description && <p style={itemStyle(idx++)}>{description}</p>}
			{action && <div style={itemStyle(idx++)}>{action}</div>}
		</div>
	)
}

// ============================================================================
// Animated Button States — Framer Motion (AnimatePresence)
// ============================================================================

type ButtonState = 'idle' | 'loading' | 'success' | 'error'

interface AnimatedButtonContentProps {
	/** Current button state */
	state: ButtonState
	/** Default content (shown in idle state) */
	children: ReactNode
	/** Loading text (optional, defaults to "Loading...") */
	loadingText?: string
	/** Success text (optional, defaults to "Done!") */
	successText?: string
	/** Error text (optional, defaults to "Error") */
	errorText?: string
	/** Class name for the container */
	className?: string
}

/**
 * AnimatedButtonContent - Smooth state transitions for button content
 *
 * Kept as Framer Motion for AnimatePresence state switching
 * and SVG path drawing animations.
 *
 * @example
 * <Button disabled={isPending}>
 *   <AnimatedButtonContent
 *     state={isPending ? 'loading' : success ? 'success' : 'idle'}
 *   >
 *     Save Changes
 *   </AnimatedButtonContent>
 * </Button>
 */
export function AnimatedButtonContent({
	state,
	children,
	loadingText = 'Loading...',
	successText = 'Done!',
	errorText = 'Error',
	className,
}: AnimatedButtonContentProps) {
	return (
		<span className={`relative inline-flex items-center justify-center gap-2 ${className ?? ''}`}>
			<AnimatePresence mode="wait">
				{state === 'idle' && (
					<motion.span
						key="idle"
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -8 }}
						transition={{ duration: duration.fast, ease: easing.easeOut }}
						className="inline-flex items-center gap-2"
					>
						{children}
					</motion.span>
				)}
				{state === 'loading' && (
					<motion.span
						key="loading"
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -8 }}
						transition={{ duration: duration.fast, ease: easing.easeOut }}
						className="inline-flex items-center gap-2"
					>
						<motion.span
							animate={{ rotate: 360 }}
							transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
							className="inline-block"
						>
							<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" strokeLinecap="round" />
							</svg>
						</motion.span>
						{loadingText}
					</motion.span>
				)}
				{state === 'success' && (
					<motion.span
						key="success"
						initial={{ opacity: 0, scale: 0.8 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.8 }}
						transition={{ duration: duration.fast, ease: easing.easeOut }}
						className="inline-flex items-center gap-2"
					>
						<motion.span
							initial={{ scale: 0 }}
							animate={{ scale: 1 }}
							transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.1 }}
						>
							<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
								<motion.path
									d="M5 13l4 4L19 7"
									strokeLinecap="round"
									strokeLinejoin="round"
									initial={{ pathLength: 0 }}
									animate={{ pathLength: 1 }}
									transition={{ duration: 0.3, delay: 0.1 }}
								/>
							</svg>
						</motion.span>
						{successText}
					</motion.span>
				)}
				{state === 'error' && (
					<motion.span
						key="error"
						initial={{ opacity: 0, x: -8 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: 8 }}
						transition={{ duration: duration.fast, ease: easing.easeOut }}
						className="inline-flex items-center gap-2"
					>
						<motion.span
							animate={{ x: [0, -3, 3, -3, 3, 0] }}
							transition={{ duration: 0.4 }}
						>
							<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
								<path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
							</svg>
						</motion.span>
						{errorText}
					</motion.span>
				)}
			</AnimatePresence>
		</span>
	)
}

// ============================================================================
// Animated Row (for lists, tables, activity feeds) — CSS First
// ============================================================================

interface AnimatedRowProps extends HTMLAttributes<HTMLDivElement> {
	/** Children to animate */
	children: ReactNode
	/** Index for stagger delay calculation */
	index?: number
	/** Base delay before animation starts */
	baseDelay?: number
}

/**
 * AnimatedRow - CSS transition row with staggered entrance
 *
 * Uses IntersectionObserver per row for viewport-triggered animation.
 * No persistent compositing layers after animation completes.
 *
 * @example
 * {items.map((item, i) => (
 *   <AnimatedRow key={item.id} index={i}>
 *     <TableRow data={item} />
 *   </AnimatedRow>
 * ))}
 */
export function AnimatedRow({
	children,
	index = 0,
	baseDelay = 0,
	className,
	style,
	...props
}: AnimatedRowProps) {
	const ref = useRef<HTMLDivElement>(null)
	const inView = useInView(ref, { once: true, margin: '-64px' })

	return (
		<div
			ref={ref}
			className={className}
			style={{
				...entranceStyle(inView, {
					duration: duration.fast,
					delay: baseDelay + index * stagger.fast,
					translate: 'translateY(8px)',
				}),
				...style,
			}}
			{...props}
		>
			{children}
		</div>
	)
}

// ============================================================================
// Animated Table Row (for data tables) — CSS First
// ============================================================================

interface AnimatedTableRowProps extends HTMLAttributes<HTMLTableRowElement> {
	/** Children to animate */
	children: ReactNode
	/** Index for stagger delay calculation */
	index?: number
	/** Base delay before animation starts */
	baseDelay?: number
}

/**
 * AnimatedTableRow - CSS transition table row with staggered entrance
 *
 * Uses IntersectionObserver per row for viewport-triggered animation.
 * No persistent compositing layers after animation completes.
 *
 * @example
 * <tbody>
 *   {items.map((item, i) => (
 *     <AnimatedTableRow key={item.id} index={i}>
 *       <td>Content</td>
 *     </AnimatedTableRow>
 *   ))}
 * </tbody>
 */
export function AnimatedTableRow({
	children,
	index = 0,
	baseDelay = 0,
	className,
	style,
	...props
}: AnimatedTableRowProps) {
	const ref = useRef<HTMLTableRowElement>(null)
	const inView = useInView(ref, { once: true, margin: '-64px' })

	return (
		<tr
			ref={ref}
			className={className}
			style={{
				...entranceStyle(inView, {
					duration: duration.fast,
					delay: baseDelay + index * stagger.fast,
					translate: 'translateY(8px)',
				}),
				...style,
			}}
			{...props}
		>
			{children}
		</tr>
	)
}

// ============================================================================
// Pulse Animation (for notifications, badges) — Framer Motion
// ============================================================================

interface PulseProps extends Omit<HTMLMotionProps<'span'>, 'animate'> {
	/** Children to wrap with pulse */
	children: ReactNode
	/** Whether to show the pulse animation */
	active?: boolean
}

/**
 * Pulse - Attention-grabbing pulse animation
 *
 * Kept as Framer Motion for continuous keyframe animation.
 *
 * @example
 * <Pulse active={hasUnread}>
 *   <Badge>3</Badge>
 * </Pulse>
 */
export const Pulse = forwardRef<HTMLSpanElement, PulseProps>(
	({ children, active = true, ...props }, ref) => {
		return (
			<motion.span
				ref={ref}
				animate={active ? {
					scale: [1, 1.05, 1],
					opacity: [1, 0.8, 1],
				} : undefined}
				transition={{
					duration: 2,
					repeat: Infinity,
					ease: 'easeInOut',
				}}
				{...props}
			>
				{children}
			</motion.span>
		)
	}
)
Pulse.displayName = 'Pulse'

// ============================================================================
// Shake Animation (for errors, validation) — Framer Motion
// ============================================================================

interface ShakeProps extends Omit<HTMLMotionProps<'div'>, 'animate'> {
	/** Children to wrap */
	children: ReactNode
	/** Trigger shake animation */
	shake?: boolean
	/** Callback when shake completes */
	onShakeComplete?: () => void
}

/**
 * Shake - Error shake animation for form validation
 *
 * Kept as Framer Motion for keyframe animation + completion callback.
 *
 * @example
 * <Shake shake={hasError} onShakeComplete={() => setHasError(false)}>
 *   <Input error={hasError} />
 * </Shake>
 */
export const Shake = forwardRef<HTMLDivElement, ShakeProps>(
	({ children, shake = false, onShakeComplete, ...props }, ref) => {
		return (
			<motion.div
				ref={ref}
				animate={shake ? { x: [0, -10, 10, -10, 10, 0] } : { x: 0 }}
				transition={{ duration: 0.4, ease: 'easeInOut' }}
				onAnimationComplete={() => {
					if (shake && onShakeComplete) {
						onShakeComplete()
					}
				}}
				{...props}
			>
				{children}
			</motion.div>
		)
	}
)
Shake.displayName = 'Shake'

// ============================================================================
// Success Checkmark Animation — Framer Motion
// ============================================================================

interface SuccessCheckProps {
	/** Whether to show the check animation */
	show: boolean
	/** Size in pixels */
	size?: number
	/** Additional class name */
	className?: string
}

/**
 * SuccessCheck - Animated checkmark for success states
 *
 * Kept as Framer Motion for SVG path drawing + spring animations.
 *
 * @example
 * <SuccessCheck show={formSubmitted} />
 */
export function SuccessCheck({ show, size = 24, className }: SuccessCheckProps) {
	return (
		<AnimatePresence>
			{show && (
				<motion.svg
					initial={{ opacity: 0, scale: 0.5 }}
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0, scale: 0.5 }}
					transition={{ type: 'spring', stiffness: 400, damping: 15 }}
					className={className}
					width={size}
					height={size}
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2.5"
				>
					<motion.circle
						cx="12"
						cy="12"
						r="10"
						initial={{ pathLength: 0 }}
						animate={{ pathLength: 1 }}
						transition={{ duration: 0.4, ease: 'easeOut' }}
					/>
					<motion.path
						d="M8 12l3 3 5-6"
						strokeLinecap="round"
						strokeLinejoin="round"
						initial={{ pathLength: 0 }}
						animate={{ pathLength: 1 }}
						transition={{ duration: 0.3, delay: 0.3 }}
					/>
				</motion.svg>
			)}
		</AnimatePresence>
	)
}

// ============================================================================
// Interactive List Item — CSS First (Animated Row + Hover States)
// ============================================================================

interface InteractiveListItemProps extends HTMLAttributes<HTMLDivElement> {
	/** Children to animate */
	children: ReactNode
	/** Index for stagger delay calculation */
	index?: number
	/** Base delay before animation starts */
	baseDelay?: number
	/** Whether item is selected/active */
	selected?: boolean
	/** Disable hover effects */
	disableHover?: boolean
}

/**
 * InteractiveListItem - Animated list item with hover/active states
 *
 * Combines AnimatedRow entrance animation with consistent hover states.
 * Use this for list items that are clickable or interactive.
 *
 * @example
 * {items.map((item, i) => (
 *   <InteractiveListItem
 *     key={item.id}
 *     index={i}
 *     selected={selectedId === item.id}
 *     onClick={() => onSelect(item.id)}
 *   >
 *     <ListItemContent data={item} />
 *   </InteractiveListItem>
 * ))}
 */
export function InteractiveListItem({
	children,
	index = 0,
	baseDelay = 0,
	selected = false,
	disableHover = false,
	className,
	style,
	...props
}: InteractiveListItemProps) {
	const ref = useRef<HTMLDivElement>(null)
	const inView = useInView(ref, { once: true, margin: '-64px' })

	return (
		<div
			ref={ref}
			className={className}
			data-selected={selected || undefined}
			style={{
				...entranceStyle(inView, {
					duration: duration.fast,
					delay: baseDelay + index * stagger.fast,
					translate: 'translateY(8px)',
				}),
				// Hover/active transitions
				transition: `opacity ${duration.fast}s ${EASE_OUT}, transform ${duration.fast}s ${EASE_OUT}, background-color 0.15s ease-out`,
				...(selected && { backgroundColor: 'var(--color-muted)' }),
				...style,
			}}
			onMouseEnter={
				disableHover
					? undefined
					: (e) => {
							if (!selected) {
								e.currentTarget.style.backgroundColor = 'oklch(from var(--color-muted) l c h / 0.5)'
							}
						}
			}
			onMouseLeave={
				disableHover
					? undefined
					: (e) => {
							if (!selected) {
								e.currentTarget.style.backgroundColor = ''
							}
						}
			}
			{...props}
		>
			{children}
		</div>
	)
}

// ============================================================================
// Re-export Framer Motion primitives
// ============================================================================

export { AnimatePresence, motion }
export type { HTMLMotionProps, MotionProps }
