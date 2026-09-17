import { cn } from '@/lib/utils'

type ProgressRingProps = {
	/** Completed units. */
	value: number
	/** Total units; zero renders an empty ring without dividing by zero. */
	max: number
	/** Outer diameter in CSS pixels. */
	size?: number
	strokeWidth?: number
	className?: string
	/** Rendered in the centre; defaults to the "done/total" count. */
	label?: React.ReactNode
	/** Accessible description of the ring. */
	title: string
}

/**
 * Small SVG progress ring used by the home hero and the stats console.
 *
 * It carries a real accessible value rather than a decorative arc, and the
 * visual fill follows the brand gradient.
 */
export function ProgressRing({
	value,
	max,
	size = 92,
	strokeWidth = 8,
	className,
	label,
	title,
}: ProgressRingProps) {
	const safeMax = Math.max(max, 1)
	const ratio = Math.min(Math.max(value / safeMax, 0), 1)
	const radius = (size - strokeWidth) / 2
	const circumference = 2 * Math.PI * radius
	const dash = circumference * ratio
	const gradientId = `progress-ring-${size}-${Math.round(ratio * 100)}`

	return (
		<div
			className={cn('relative inline-flex items-center justify-center', className)}
			style={{ width: size, height: size }}
			role="img"
			aria-label={title}
		>
			<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
				<defs>
					<linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
						{/* Brand tokens, so the ring follows the theme instead of a frozen hex. */}
						<stop offset="0%" stopColor="var(--color-primary)" />
						<stop offset="100%" stopColor="var(--color-secondary)" />
					</linearGradient>
				</defs>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					strokeWidth={strokeWidth}
					className="stroke-muted"
				/>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					strokeWidth={strokeWidth}
					strokeLinecap="round"
					stroke={`url(#${gradientId})`}
					strokeDasharray={`${dash} ${circumference - dash}`}
					transform={`rotate(-90 ${size / 2} ${size / 2})`}
					// Class-based so `motion-reduce` can switch the fill animation off.
					className="transition-[stroke-dasharray] duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
				/>
			</svg>
			<span className="absolute inset-0 flex flex-col items-center justify-center">
				{label ?? (
					<span className="font-display text-lg font-extrabold tnum">
						{value}
						<span className="text-muted-foreground">/{max}</span>
					</span>
				)}
			</span>
		</div>
	)
}
