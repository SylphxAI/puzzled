/**
 * @sylphx/ui - Badge Components
 *
 * Small status indicators and labels for categorization.
 * Includes Badge, StatusDot, and CountBadge variants.
 *
 * @example
 * ```tsx
 * import { Badge, StatusDot, CountBadge } from '@sylphx/ui'
 *
 * // Basic badge
 * <Badge>New</Badge>
 *
 * // With variant
 * <Badge variant="success">Active</Badge>
 * <Badge variant="warning">Pending</Badge>
 * <Badge variant="error">Failed</Badge>
 *
 * // Status indicator
 * <StatusDot status="online" />
 *
 * // Notification count
 * <CountBadge count={5} />
 * ```
 *
 * @module @sylphx/ui/badge
 */

import { cn } from "../utils";

/**
 * Badge variant type for different visual styles.
 * - `default`: Primary colored badge
 * - `secondary`: Muted/subtle badge
 * - `success`: Green success indicator
 * - `warning`: Yellow/amber warning indicator
 * - `error`: Red error/danger indicator
 * - `outline`: Bordered badge with transparent background
 */
type BadgeVariant =
	| "default"
	| "secondary"
	| "success"
	| "warning"
	| "error"
	| "outline";

/**
 * Badge size type.
 * - `sm`: Extra small badge
 * - `md`: Default size
 * - `lg`: Larger badge
 */
type BadgeSize = "sm" | "md" | "lg";

/**
 * Props for the Badge component.
 */
type BadgeProps = {
	/** Visual variant of the badge */
	variant?: BadgeVariant;
	/** Size of the badge */
	size?: BadgeSize;
	/** Badge content */
	children: React.ReactNode;
	/** Additional CSS classes */
	className?: string;
};

const variantStyles: Record<BadgeVariant, string> = {
	default: "bg-primary text-primary-foreground",
	secondary: "bg-muted text-muted-foreground",
	success: "bg-success/10 text-success",
	warning: "bg-warning/10 text-warning",
	error: "bg-error/10 text-error",
	outline: "border bg-transparent text-foreground",
};

const sizeStyles: Record<BadgeSize, string> = {
	sm: "px-1.5 py-0.5 text-xs",
	md: "px-2 py-0.5 text-xs",
	lg: "px-2.5 py-1 text-sm",
};

/**
 * Badge component for displaying status, categories, or labels.
 *
 * Features:
 * - Six visual variants for different contexts
 * - Three size options
 * - Pill-shaped (fully rounded) design
 * - Icon support (can include icons as children)
 *
 * @example
 * ```tsx
 * // Status badges
 * <Badge variant="success">Active</Badge>
 * <Badge variant="error">Error</Badge>
 *
 * // With icon
 * <Badge variant="warning">
 *   <AlertIcon className="w-3 h-3" />
 *   Warning
 * </Badge>
 * ```
 */
export function Badge({
	variant = "default",
	size = "md",
	children,
	className,
}: BadgeProps) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded-full font-medium",
				variantStyles[variant],
				sizeStyles[size],
				className,
			)}
		>
			{children}
		</span>
	);
}

/**
 * Props for the StatusDot component.
 */
type StatusDotProps = {
	/** Status type that determines the color */
	status: "online" | "offline" | "away" | "busy";
	/** Whether to show pulse animation for online/busy status */
	pulse?: boolean;
	/** Additional CSS classes */
	className?: string;
};

/**
 * Small colored dot for indicating status.
 * Supports optional pulse animation for active states.
 *
 * Colors:
 * - `online`: Green (with optional pulse)
 * - `offline`: Gray
 * - `away`: Yellow
 * - `busy`: Red (with optional pulse)
 *
 * @example
 * ```tsx
 * // User status indicator
 * <div className="flex items-center gap-2">
 *   <StatusDot status="online" />
 *   <span>John Doe</span>
 * </div>
 *
 * // With pulse animation
 * <StatusDot status="online" pulse />
 * ```
 */
export function StatusDot({
	status,
	pulse = false,
	className,
}: StatusDotProps) {
	const statusColors = {
		online: "bg-success text-success/40",
		offline: "bg-muted-foreground text-muted-foreground/40",
		away: "bg-warning text-warning/40",
		busy: "bg-error text-error/40",
	};

	// Only pulse for online and busy statuses by default
	const shouldPulse = pulse && (status === "online" || status === "busy");

	return (
		<span
			className={cn(
				"relative inline-block h-2 w-2 rounded-full",
				statusColors[status],
				shouldPulse && "animate-status-pulse motion-reduce:after:hidden",
				className,
			)}
			role="img"
			aria-label={status}
		/>
	);
}

/**
 * Props for the CountBadge component.
 */
type CountBadgeProps = {
	/** Number to display */
	count: number;
	/** Maximum number before showing "99+" (default: 99) */
	max?: number;
	/** Additional CSS classes */
	className?: string;
};

/**
 * Notification count badge.
 * Displays a number, or "99+" if count exceeds max.
 * Returns null if count is 0.
 *
 * @example
 * ```tsx
 * // Notification icon with badge
 * <div className="relative">
 *   <BellIcon />
 *   <CountBadge count={5} className="absolute -top-1 -right-1" />
 * </div>
 *
 * // With custom max
 * <CountBadge count={150} max={99} /> // Shows "99+"
 * ```
 */
export function CountBadge({ count, max = 99, className }: CountBadgeProps) {
	if (count === 0) return null;

	const displayCount = count > max ? `${max}+` : count;

	return (
		<span
			className={cn(
				"inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1.5 text-xs font-bold text-error-foreground",
				className,
			)}
		>
			{displayCount}
		</span>
	);
}
