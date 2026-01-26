'use client'

/**
 * Game-Inspired UI Components
 *
 * "Users should feel like they're 'playing' a polished product,
 * not 'filling out' a form."
 *
 * These components bring game-inspired interactions:
 * - Celebration effects (confetti, particles)
 * - XP/Level progression rings
 * - Quest-style cards
 * - Haptic feedback patterns
 * - Direct manipulation affordances
 */

import { AnimatePresence, motion, useSpring, useTransform } from 'motion/react'
import {
	type CSSProperties,
	type ReactNode,
	forwardRef,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react'
import { cn } from '../utils'

// ============================================================================
// CELEBRATION SYSTEM
// ============================================================================

interface ConfettiPiece {
	id: number
	x: number
	color: string
	delay: number
	rotation: number
	scale: number
}

interface ConfettiProps {
	/** Whether to show confetti */
	active: boolean
	/** Number of confetti pieces */
	count?: number
	/** Duration in ms before cleanup */
	duration?: number
	/** Custom colors */
	colors?: string[]
	/** Callback when animation completes */
	onComplete?: () => void
	className?: string
}

const DEFAULT_CONFETTI_COLORS = [
	'#FFD700', // Gold
	'#FF6B6B', // Coral
	'#4ECDC4', // Teal
	'#A855F7', // Purple
	'#F59E0B', // Amber
	'#10B981', // Emerald
	'#3B82F6', // Blue
	'#EC4899', // Pink
]

/**
 * Confetti celebration effect
 *
 * @example
 * ```tsx
 * const [celebrate, setCelebrate] = useState(false)
 * <Confetti active={celebrate} onComplete={() => setCelebrate(false)} />
 * <button onClick={() => setCelebrate(true)}>🎉</button>
 * ```
 */
function Confetti({
	active,
	count = 50,
	duration = 3000,
	colors = DEFAULT_CONFETTI_COLORS,
	onComplete,
	className,
}: ConfettiProps) {
	const [pieces, setPieces] = useState<ConfettiPiece[]>([])

	useEffect(() => {
		if (active) {
			const newPieces: ConfettiPiece[] = Array.from({ length: count }, (_, i) => {
				const colorIndex = Math.floor(Math.random() * colors.length)
				return {
					id: i,
					x: Math.random() * 100,
					color: colors[colorIndex] as string,
					delay: Math.random() * 0.3,
					rotation: Math.random() * 360,
					scale: 0.5 + Math.random() * 0.5,
				}
			})
			setPieces(newPieces)

			const timer = setTimeout(() => {
				setPieces([])
				onComplete?.()
			}, duration)

			return () => clearTimeout(timer)
		}
		return undefined
	}, [active, count, colors, duration, onComplete])

	return (
		<div
			className={cn('pointer-events-none fixed inset-0 z-[9999] overflow-hidden', className)}
			aria-hidden="true"
		>
			<AnimatePresence>
				{pieces.map((piece) => (
					<motion.div
						key={piece.id}
						initial={{
							x: `${piece.x}vw`,
							y: '-10%',
							rotate: piece.rotation,
							scale: piece.scale,
						}}
						animate={{
							y: '110vh',
							rotate: piece.rotation + 720,
						}}
						exit={{ opacity: 0 }}
						transition={{
							duration: 2.5 + Math.random(),
							delay: piece.delay,
							ease: [0.25, 0.46, 0.45, 0.94],
						}}
						style={{
							position: 'absolute',
							width: 10,
							height: 10,
							backgroundColor: piece.color,
							borderRadius: Math.random() > 0.5 ? '50%' : '2px',
						}}
					/>
				))}
			</AnimatePresence>
		</div>
	)
}

// ============================================================================
// PARTICLE BURST
// ============================================================================

interface ParticleBurstProps {
	/** Whether to trigger burst */
	active: boolean
	/** Number of particles */
	count?: number
	/** Particle color */
	color?: string
	/** Burst origin (center of element) */
	origin?: { x: number; y: number }
	/** Callback when complete */
	onComplete?: () => void
}

/**
 * Particle burst effect for micro-celebrations
 * Great for button clicks, form submissions, achievements
 */
function ParticleBurst({
	active,
	count = 12,
	color = '#FFD700',
	origin = { x: 50, y: 50 },
	onComplete,
}: ParticleBurstProps) {
	const [particles, setParticles] = useState<
		Array<{
			id: number
			angle: number
			distance: number
			size: number
		}>
	>([])

	useEffect(() => {
		if (active) {
			const newParticles = Array.from({ length: count }, (_, i) => ({
				id: i,
				angle: (360 / count) * i + Math.random() * 30,
				distance: 40 + Math.random() * 60,
				size: 4 + Math.random() * 4,
			}))
			setParticles(newParticles)

			const timer = setTimeout(() => {
				setParticles([])
				onComplete?.()
			}, 600)

			return () => clearTimeout(timer)
		}
		return undefined
	}, [active, count, onComplete])

	return (
		<div
			className="pointer-events-none absolute inset-0 overflow-visible"
			style={{ left: `${origin.x}%`, top: `${origin.y}%` }}
			aria-hidden="true"
		>
			<AnimatePresence>
				{particles.map((particle) => {
					const rad = (particle.angle * Math.PI) / 180
					const x = Math.cos(rad) * particle.distance
					const y = Math.sin(rad) * particle.distance

					return (
						<motion.div
							key={particle.id}
							initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
							animate={{ x, y, scale: 0, opacity: 0 }}
							transition={{
								duration: 0.5,
								ease: [0.25, 0.46, 0.45, 0.94],
							}}
							style={{
								position: 'absolute',
								width: particle.size,
								height: particle.size,
								backgroundColor: color,
								borderRadius: '50%',
								transform: 'translate(-50%, -50%)',
							}}
						/>
					)
				})}
			</AnimatePresence>
		</div>
	)
}

// ============================================================================
// XP RING (Level/Progress Indicator)
// ============================================================================

interface XPRingProps {
	/** Current XP value */
	value: number
	/** XP needed for next level */
	max: number
	/** Current level */
	level?: number
	/** Ring size in pixels */
	size?: number
	/** Stroke width */
	strokeWidth?: number
	/** Primary color (gradient start) */
	colorFrom?: string
	/** Secondary color (gradient end) */
	colorTo?: string
	/** Show level in center */
	showLevel?: boolean
	/** Show XP text */
	showXP?: boolean
	/** Animate on mount */
	animate?: boolean
	/** Custom center content */
	children?: ReactNode
	className?: string
}

/**
 * XP Ring - Game-style circular progress with level display
 *
 * @example
 * ```tsx
 * <XPRing value={750} max={1000} level={5} />
 * ```
 */
function XPRing({
	value,
	max,
	level,
	size = 120,
	strokeWidth = 8,
	colorFrom = '#F59E0B',
	colorTo = '#EF4444',
	showLevel = true,
	showXP = true,
	animate = true,
	children,
	className,
}: XPRingProps) {
	const radius = (size - strokeWidth) / 2
	const circumference = radius * 2 * Math.PI
	const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

	// Animated progress value
	const springValue = useSpring(0, { stiffness: 100, damping: 30 })
	const animatedOffset = useTransform(
		springValue,
		(v) => circumference - (v / 100) * circumference
	)

	useEffect(() => {
		if (animate) {
			springValue.set(percentage)
		}
	}, [animate, percentage, springValue])

	const gradientId = useMemo(() => `xp-gradient-${Math.random().toString(36).slice(2)}`, [])

	return (
		<div
			className={cn('relative inline-flex items-center justify-center', className)}
			style={{ width: size, height: size }}
			role="progressbar"
			aria-valuenow={value}
			aria-valuemin={0}
			aria-valuemax={max}
			aria-label={level !== undefined ? `Level ${level}` : undefined}
		>
			<svg width={size} height={size} className="transform -rotate-90">
				<defs>
					<linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
						<stop offset="0%" stopColor={colorFrom} />
						<stop offset="100%" stopColor={colorTo} />
					</linearGradient>
				</defs>

				{/* Background ring */}
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke="currentColor"
					strokeWidth={strokeWidth}
					className="text-muted/30"
				/>

				{/* Progress ring */}
				<motion.circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke={`url(#${gradientId})`}
					strokeWidth={strokeWidth}
					strokeLinecap="round"
					strokeDasharray={circumference}
					style={{ strokeDashoffset: animate ? animatedOffset : circumference * (1 - percentage / 100) }}
					className="drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]"
				/>
			</svg>

			{/* Center content */}
			<div className="absolute inset-0 flex flex-col items-center justify-center">
				{children ?? (
					<>
						{showLevel && level !== undefined && (
							<span className="text-2xl font-bold tracking-tight">{level}</span>
						)}
						{showXP && (
							<span className="text-xs text-muted-foreground">
								{value.toLocaleString()} / {max.toLocaleString()}
							</span>
						)}
					</>
				)}
			</div>
		</div>
	)
}

// ============================================================================
// QUEST CARD
// ============================================================================

type QuestStatus = 'locked' | 'available' | 'in-progress' | 'completed'

interface QuestCardProps {
	/** Quest title */
	title: string
	/** Quest description */
	description?: string
	/** Quest status */
	status?: QuestStatus
	/** Progress (0-100) for in-progress quests */
	progress?: number
	/** XP reward */
	reward?: number
	/** Icon or emoji */
	icon?: ReactNode
	/** Click handler */
	onClick?: () => void
	/** Additional class names */
	className?: string
}

const statusConfig: Record<
	QuestStatus,
	{ bg: string; border: string; badge: string; badgeText: string }
> = {
	locked: {
		bg: 'bg-muted/50',
		border: 'border-muted',
		badge: 'bg-muted text-muted-foreground',
		badgeText: '🔒 Locked',
	},
	available: {
		bg: 'bg-card hover:bg-accent/50',
		border: 'border-primary/30 hover:border-primary',
		badge: 'bg-primary/10 text-primary',
		badgeText: '✨ Available',
	},
	'in-progress': {
		bg: 'bg-card',
		border: 'border-warning/50',
		badge: 'bg-warning/10 text-warning',
		badgeText: '⚡ In Progress',
	},
	completed: {
		bg: 'bg-success/5',
		border: 'border-success/50',
		badge: 'bg-success/10 text-success',
		badgeText: '✓ Completed',
	},
}

/**
 * Quest Card - Game-style objective card
 *
 * Transforms boring task cards into engaging quest objectives.
 */
const QuestCard = forwardRef<HTMLDivElement, QuestCardProps>(
	(
		{
			title,
			description,
			status = 'available',
			progress,
			reward,
			icon,
			onClick,
			className,
		},
		ref
	) => {
		const config = statusConfig[status]
		const isInteractive = status === 'available' || status === 'in-progress'
		const [showBurst, setShowBurst] = useState(false)

		const handleClick = useCallback(() => {
			if (isInteractive && onClick) {
				setShowBurst(true)
				onClick()
			}
		}, [isInteractive, onClick])

		return (
			<motion.div
				ref={ref}
				className={cn(
					'relative overflow-hidden rounded-xl border-2 p-4 transition-colors',
					config.bg,
					config.border,
					isInteractive && 'cursor-pointer',
					status === 'locked' && 'opacity-60 grayscale',
					className
				)}
				onClick={handleClick}
				whileHover={isInteractive ? { scale: 1.02, y: -2 } : undefined}
				whileTap={isInteractive ? { scale: 0.98 } : undefined}
				transition={{ type: 'spring', stiffness: 400, damping: 25 }}
			>
				{/* Particle burst on click */}
				<ParticleBurst
					active={showBurst}
					color={status === 'completed' ? '#10B981' : '#F59E0B'}
					onComplete={() => setShowBurst(false)}
				/>

				{/* Glow effect for available quests */}
				{status === 'available' && (
					<motion.div
						className="absolute inset-0 -z-10 bg-gradient-to-r from-primary/20 via-transparent to-primary/20"
						animate={{ x: ['-100%', '100%'] }}
						transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
					/>
				)}

				<div className="flex items-start gap-3">
					{/* Icon */}
					{icon && (
						<div
							className={cn(
								'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl',
								status === 'completed' ? 'bg-success/20' : 'bg-primary/10'
							)}
						>
							{icon}
						</div>
					)}

					<div className="flex-1 space-y-1">
						{/* Status badge */}
						<span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium', config.badge)}>
							{config.badgeText}
						</span>

						{/* Title */}
						<h3 className="font-semibold leading-tight">{title}</h3>

						{/* Description */}
						{description && (
							<p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
						)}

						{/* Progress bar for in-progress */}
						{status === 'in-progress' && progress !== undefined && (
							<div className="mt-2">
								<div className="flex justify-between text-xs text-muted-foreground">
									<span>Progress</span>
									<span>{progress}%</span>
								</div>
								<div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
									<motion.div
										className="h-full rounded-full bg-gradient-to-r from-warning to-amber-400"
										initial={{ width: 0 }}
										animate={{ width: `${progress}%` }}
										transition={{ duration: 0.5, ease: 'easeOut' }}
									/>
								</div>
							</div>
						)}
					</div>

					{/* Reward */}
					{reward !== undefined && (
						<div className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-sm font-medium text-amber-500">
							<span>+{reward}</span>
							<span className="text-xs">XP</span>
						</div>
					)}
				</div>
			</motion.div>
		)
	}
)
QuestCard.displayName = 'QuestCard'

// ============================================================================
// INTERACTIVE PRESS BUTTON
// ============================================================================

interface PressButtonProps {
	/** Visual variant */
	variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger'
	/** Size */
	size?: 'sm' | 'md' | 'lg'
	/** Show press animation */
	haptic?: boolean
	/** Show ripple effect */
	ripple?: boolean
	/** Button content */
	children: ReactNode
	/** Click handler */
	onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
	/** Disabled state */
	disabled?: boolean
	/** Button type */
	type?: 'button' | 'submit' | 'reset'
	/** Additional class names */
	className?: string
}

const variantStyles = {
	primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
	secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
	success: 'bg-success text-success-foreground hover:bg-success/90',
	warning: 'bg-warning text-warning-foreground hover:bg-warning/90',
	danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
}

const sizeStyles = {
	sm: 'h-8 px-3 text-sm',
	md: 'h-10 px-4 text-sm',
	lg: 'h-12 px-6 text-base',
}

/**
 * Press Button - Game-style button with satisfying press feedback
 */
const PressButton = forwardRef<HTMLButtonElement, PressButtonProps>(
	(
		{
			variant = 'primary',
			size = 'md',
			haptic = true,
			ripple = true,
			className,
			children,
			onClick,
			disabled,
			type = 'button',
		},
		ref
	) => {
		const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([])
		const buttonRef = useRef<HTMLButtonElement>(null)

		const handleClick = useCallback(
			(e: React.MouseEvent<HTMLButtonElement>) => {
				if (ripple && buttonRef.current) {
					const rect = buttonRef.current.getBoundingClientRect()
					const x = e.clientX - rect.left
					const y = e.clientY - rect.top
					const id = Date.now()

					setRipples((prev) => [...prev, { id, x, y }])
					setTimeout(() => {
						setRipples((prev) => prev.filter((r) => r.id !== id))
					}, 600)
				}

				onClick?.(e)
			},
			[ripple, onClick]
		)

		return (
			<motion.button
				ref={(node) => {
					// Handle both refs
					if (typeof ref === 'function') ref(node)
					else if (ref) ref.current = node
					;(buttonRef as React.MutableRefObject<HTMLButtonElement | null>).current = node
				}}
				type={type}
				disabled={disabled}
				className={cn(
					'relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-lg font-medium transition-colors',
					'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
					'disabled:pointer-events-none disabled:opacity-50',
					variantStyles[variant],
					sizeStyles[size],
					className
				)}
				onClick={handleClick}
				whileHover={{ scale: haptic ? 1.02 : 1 }}
				whileTap={{ scale: haptic ? 0.95 : 1 }}
				transition={{ type: 'spring', stiffness: 400, damping: 17 }}
			>
				{/* Ripple effects */}
				{ripples.map((r) => (
					<motion.span
						key={r.id}
						className="absolute rounded-full bg-white/30"
						style={{ left: r.x, top: r.y }}
						initial={{ width: 0, height: 0, x: 0, y: 0, opacity: 1 }}
						animate={{ width: 200, height: 200, x: -100, y: -100, opacity: 0 }}
						transition={{ duration: 0.6, ease: 'easeOut' }}
					/>
				))}

				{children}
			</motion.button>
		)
	}
)
PressButton.displayName = 'PressButton'

// ============================================================================
// ACHIEVEMENT UNLOCK
// ============================================================================

interface AchievementUnlockProps {
	/** Achievement title */
	title: string
	/** Achievement description */
	description?: string
	/** Achievement icon/emoji */
	icon?: ReactNode
	/** Tier color */
	tier?: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
	/** Points/XP earned */
	points?: number
	/** Whether to show */
	show: boolean
	/** Callback when dismissed */
	onDismiss?: () => void
	/** Auto-dismiss duration (ms) */
	duration?: number
}

const tierColors = {
	bronze: 'from-amber-700 to-amber-900',
	silver: 'from-slate-400 to-slate-600',
	gold: 'from-yellow-400 to-amber-500',
	platinum: 'from-cyan-400 to-blue-500',
	diamond: 'from-violet-400 to-purple-600',
}

const tierGlow = {
	bronze: 'shadow-amber-500/50',
	silver: 'shadow-slate-400/50',
	gold: 'shadow-yellow-400/50',
	platinum: 'shadow-cyan-400/50',
	diamond: 'shadow-violet-400/50',
}

/**
 * Achievement Unlock - Celebratory notification for unlocking achievements
 */
function AchievementUnlock({
	title,
	description,
	icon = '🏆',
	tier = 'bronze',
	points,
	show,
	onDismiss,
	duration = 5000,
}: AchievementUnlockProps) {
	const [showConfetti, setShowConfetti] = useState(false)

	useEffect(() => {
		if (show) {
			setShowConfetti(true)

			if (duration > 0) {
				const timer = setTimeout(() => {
					onDismiss?.()
				}, duration)
				return () => clearTimeout(timer)
			}
		}
		return undefined
	}, [show, duration, onDismiss])

	return (
		<>
			<Confetti
				active={showConfetti}
				count={30}
				duration={2000}
				onComplete={() => setShowConfetti(false)}
			/>

			<AnimatePresence>
				{show && (
					<motion.div
						className="fixed inset-x-0 top-8 z-[100] flex justify-center px-4"
						initial={{ y: -100, opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						exit={{ y: -100, opacity: 0 }}
						transition={{ type: 'spring', stiffness: 300, damping: 25 }}
					>
						<motion.div
							className={cn(
								'relative flex items-center gap-4 rounded-2xl bg-gradient-to-r p-4 pr-6 shadow-2xl',
								tierColors[tier],
								tierGlow[tier]
							)}
							initial={{ scale: 0.8 }}
							animate={{ scale: 1 }}
							transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
							onClick={onDismiss}
						>
							{/* Icon with glow */}
							<motion.div
								className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 text-3xl backdrop-blur-sm"
								animate={{ rotate: [0, -10, 10, -10, 0] }}
								transition={{ duration: 0.5, delay: 0.3 }}
							>
								{icon}
							</motion.div>

							<div className="text-white">
								<motion.div
									className="text-xs font-medium uppercase tracking-wider opacity-80"
									initial={{ opacity: 0, y: 5 }}
									animate={{ opacity: 0.8, y: 0 }}
									transition={{ delay: 0.2 }}
								>
									Achievement Unlocked!
								</motion.div>
								<motion.div
									className="text-lg font-bold"
									initial={{ opacity: 0, y: 5 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.3 }}
								>
									{title}
								</motion.div>
								{description && (
									<motion.div
										className="text-sm opacity-80"
										initial={{ opacity: 0 }}
										animate={{ opacity: 0.8 }}
										transition={{ delay: 0.4 }}
									>
										{description}
									</motion.div>
								)}
							</div>

							{/* Points badge */}
							{points !== undefined && (
								<motion.div
									className="absolute -right-2 -top-2 flex h-8 items-center rounded-full bg-white px-3 text-sm font-bold text-black shadow-lg"
									initial={{ scale: 0, rotate: -20 }}
									animate={{ scale: 1, rotate: 0 }}
									transition={{ type: 'spring', delay: 0.5 }}
								>
									+{points} XP
								</motion.div>
							)}
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	)
}

// ============================================================================
// STREAK FLAME
// ============================================================================

interface StreakFlameProps {
	/** Current streak count */
	streak: number
	/** Whether streak is active today */
	isActive?: boolean
	/** Size */
	size?: 'sm' | 'md' | 'lg'
	className?: string
}

const flameSizes = {
	sm: { container: 'h-8 w-8', text: 'text-xs', flame: 'text-lg' },
	md: { container: 'h-12 w-12', text: 'text-sm', flame: 'text-2xl' },
	lg: { container: 'h-16 w-16', text: 'text-base', flame: 'text-3xl' },
}

/**
 * Streak Flame - Visual indicator for daily streaks
 */
function StreakFlame({ streak, isActive = true, size = 'md', className }: StreakFlameProps) {
	const sizeConfig = flameSizes[size]

	return (
		<div className={cn('relative inline-flex flex-col items-center', className)}>
			<motion.div
				className={cn(
					'relative flex items-center justify-center rounded-full',
					sizeConfig.container,
					isActive ? 'bg-orange-500/20' : 'bg-muted'
				)}
				animate={
					isActive
						? {
								scale: [1, 1.1, 1],
								boxShadow: [
									'0 0 0 0 rgba(249, 115, 22, 0)',
									'0 0 20px 10px rgba(249, 115, 22, 0.3)',
									'0 0 0 0 rgba(249, 115, 22, 0)',
								],
							}
						: {}
				}
				transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
			>
				<motion.span
					className={sizeConfig.flame}
					animate={isActive ? { y: [0, -2, 0] } : {}}
					transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}
				>
					{isActive ? '🔥' : '💨'}
				</motion.span>
			</motion.div>

			<motion.span
				className={cn('mt-1 font-bold tabular-nums', sizeConfig.text)}
				key={streak}
				initial={{ scale: 1.5, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				transition={{ type: 'spring', stiffness: 500, damping: 25 }}
			>
				{streak}
			</motion.span>
		</div>
	)
}

// ============================================================================
// LEVEL BADGE
// ============================================================================

interface LevelBadgeProps {
	level: number
	size?: 'sm' | 'md' | 'lg'
	showGlow?: boolean
	className?: string
}

const levelSizes = {
	sm: 'h-6 w-6 text-xs',
	md: 'h-8 w-8 text-sm',
	lg: 'h-10 w-10 text-base',
}

/**
 * Level Badge - Compact level indicator
 */
function LevelBadge({ level, size = 'md', showGlow = true, className }: LevelBadgeProps) {
	// Color based on level tier
	const tierColor = useMemo(() => {
		if (level >= 50) return 'from-violet-500 to-purple-600' // Diamond
		if (level >= 30) return 'from-cyan-400 to-blue-500' // Platinum
		if (level >= 20) return 'from-yellow-400 to-amber-500' // Gold
		if (level >= 10) return 'from-slate-400 to-slate-500' // Silver
		return 'from-amber-600 to-amber-700' // Bronze
	}, [level])

	return (
		<motion.div
			className={cn(
				'relative inline-flex items-center justify-center rounded-full bg-gradient-to-br font-bold text-white',
				levelSizes[size],
				tierColor,
				showGlow && 'shadow-lg',
				className
			)}
			whileHover={{ scale: 1.1 }}
			transition={{ type: 'spring', stiffness: 400, damping: 17 }}
		>
			{level}
		</motion.div>
	)
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
	// Celebrations
	Confetti,
	ParticleBurst,
	AchievementUnlock,
	// Progress
	XPRing,
	StreakFlame,
	LevelBadge,
	// Interactive
	QuestCard,
	PressButton,
	// Types
	type ConfettiProps,
	type ParticleBurstProps,
	type XPRingProps,
	type QuestCardProps,
	type QuestStatus,
	type PressButtonProps,
	type AchievementUnlockProps,
	type StreakFlameProps,
	type LevelBadgeProps,
}
