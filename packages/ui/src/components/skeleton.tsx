"use client";

/**
 * @sylphx/ui - Skeleton Loading Components
 *
 * Comprehensive skeleton components for loading states.
 * Features shimmer animation with reduced-motion support.
 *
 * @example
 * ```tsx
 * // Base skeleton
 * <Skeleton className="h-4 w-32" />
 *
 * // Text placeholder
 * <SkeletonText lines={3} />
 *
 * // Table loading
 * <SkeletonTable rows={5} columns={4} />
 *
 * // Stats grid
 * <SkeletonStatCard />
 *
 * // OAuth provider list
 * <SkeletonProviderRow count={5} />
 * ```
 *
 * @module @sylphx/ui/skeleton
 */

import type { CSSProperties } from "react";
import { cn } from "../utils";

type SkeletonProps = {
	className?: string;
	style?: CSSProperties;
};

/**
 * Base Skeleton component with shimmer animation
 *
 * Features:
 * - Smooth shimmer effect using gradient animation
 * - Respects prefers-reduced-motion via motion-safe variant
 * - Rounded corners with theme colors
 * - Accepts className for custom sizing
 */
export function Skeleton({ className, style }: SkeletonProps) {
	return (
		<div
			className={cn(
				"relative overflow-hidden rounded-md bg-muted",
				// Shimmer animation - only active when motion is allowed
				"motion-safe:before:absolute motion-safe:before:inset-0",
				"motion-safe:before:-translate-x-full motion-safe:before:animate-[shimmer_2s_infinite]",
				"motion-safe:before:bg-gradient-to-r motion-safe:before:from-transparent motion-safe:before:via-white/10 motion-safe:before:to-transparent",
				// Reduced motion fallback - subtle pulse
				"motion-reduce:animate-pulse",
				className,
			)}
			style={style}
			aria-hidden="true"
		/>
	);
}

/**
 * SkeletonText - Single or multi-line text placeholder
 *
 * Usage:
 * - Single line: <SkeletonText />
 * - Multiple lines: <SkeletonText lines={3} />
 * - Last line is automatically shorter for natural appearance
 */
export function SkeletonText({
	className,
	lines = 1,
	lastLineWidth = "75%",
}: SkeletonProps & {
	lines?: number;
	/** Width of last line for natural text appearance */
	lastLineWidth?: string;
}) {
	return (
		<div className={cn("space-y-2", className)}>
			{Array.from({ length: lines }).map((_, i) => (
				<Skeleton
					key={i}
					className="h-4"
					style={{
						width: i === lines - 1 && lines > 1 ? lastLineWidth : "100%",
					}}
				/>
			))}
		</div>
	);
}

/**
 * SkeletonAvatar - Circular avatar placeholder
 *
 * Usage:
 * - Default (40x40): <SkeletonAvatar />
 * - Sizes: sm (32px), md (40px), lg (48px), xl (64px)
 * - Custom size: <SkeletonAvatar className="h-16 w-16" />
 */
export function SkeletonAvatar({
	className,
	size = "md",
}: SkeletonProps & {
	size?: "sm" | "md" | "lg" | "xl";
}) {
	const sizeClasses = {
		sm: "h-8 w-8",
		md: "h-10 w-10",
		lg: "h-12 w-12",
		xl: "h-16 w-16",
	};

	return (
		<Skeleton className={cn(sizeClasses[size], "rounded-full", className)} />
	);
}

/**
 * SkeletonButton - Button-shaped placeholder
 *
 * Matches Button component sizes:
 * - default: h-11
 * - sm: h-10
 * - lg: h-12
 */
export function SkeletonButton({
	className,
	size = "default",
}: SkeletonProps & { size?: "default" | "sm" | "lg" }) {
	return (
		<Skeleton
			className={cn(
				"rounded-lg",
				size === "default" && "h-11 w-24",
				size === "sm" && "h-10 w-20",
				size === "lg" && "h-12 w-28",
				className,
			)}
		/>
	);
}

/**
 * SkeletonCard - Generic card placeholder with header and content
 *
 * Features:
 * - Optional header with avatar + text
 * - Configurable content lines
 * - Border and padding matching Card component
 */
export function SkeletonCard({
	className,
	showHeader = true,
	contentLines = 2,
}: SkeletonProps & {
	showHeader?: boolean;
	contentLines?: number;
}) {
	return (
		<div className={cn("rounded-xl border bg-card p-4 sm:p-6", className)}>
			{showHeader && (
				<div className="flex items-center gap-4 mb-4">
					<SkeletonAvatar size="lg" />
					<div className="flex-1 space-y-2">
						<Skeleton className="h-4 w-1/2" />
						<Skeleton className="h-3 w-3/4" />
					</div>
				</div>
			)}
			{contentLines > 0 && <SkeletonText lines={contentLines} />}
		</div>
	);
}

/**
 * SkeletonTable - Table rows with columns placeholder
 *
 * Features:
 * - Configurable rows and columns
 * - Optional header row
 * - Varying column widths for natural appearance
 */
export function SkeletonTable({
	className,
	rows = 5,
	columns = 4,
	showHeader = true,
}: SkeletonProps & {
	rows?: number;
	columns?: number;
	showHeader?: boolean;
}) {
	// Generate column widths for variety
	const getColumnWidth = (colIndex: number, isHeader: boolean): string => {
		if (isHeader) {
			const headerWidths: string[] = ["w-24", "w-32", "w-28", "w-20", "w-24"];
			return headerWidths[colIndex % headerWidths.length] as string;
		}
		const bodyWidths: string[] = ["w-32", "w-48", "w-24", "w-16", "w-28"];
		return bodyWidths[colIndex % bodyWidths.length] as string;
	};

	return (
		<div className={cn("w-full", className)}>
			{/* Header */}
			{showHeader && (
				<div className="flex items-center gap-4 px-4 py-3 border-b bg-muted/30">
					{Array.from({ length: columns }).map((_, col) => (
						<Skeleton
							key={col}
							className={cn("h-4", getColumnWidth(col, true))}
						/>
					))}
				</div>
			)}

			{/* Body rows */}
			<div className="divide-y divide-border">
				{Array.from({ length: rows }).map((_, row) => (
					<div key={row} className="flex items-center gap-4 px-4 py-3">
						{Array.from({ length: columns }).map((_, col) => (
							<Skeleton
								key={col}
								className={cn("h-4", getColumnWidth(col, false))}
							/>
						))}
					</div>
				))}
			</div>
		</div>
	);
}

/**
 * SkeletonStatCard - Stats grid card placeholder (icon + value + label)
 *
 * Matches typical dashboard stat card layout:
 * - Icon box on left
 * - Large value number
 * - Smaller label text
 * - Optional trend indicator
 */
export function SkeletonStatCard({
	className,
	showTrend = false,
}: SkeletonProps & {
	showTrend?: boolean;
}) {
	return (
		<div className={cn("rounded-xl border bg-card p-4 sm:p-6", className)}>
			<div className="flex items-start justify-between">
				{/* Icon box */}
				<Skeleton className="h-10 w-10 rounded-lg" />
				{/* Trend indicator */}
				{showTrend && <Skeleton className="h-5 w-12 rounded-full" />}
			</div>
			<div className="mt-4 space-y-1">
				{/* Value */}
				<Skeleton className="h-7 w-20" />
				{/* Label */}
				<Skeleton className="h-4 w-28" />
			</div>
		</div>
	);
}

/**
 * SkeletonStatGrid - Grid of stat cards
 *
 * Renders multiple SkeletonStatCards in a responsive grid.
 */
export function SkeletonStatGrid({
	className,
	count = 4,
	showTrend = false,
}: SkeletonProps & {
	count?: number;
	showTrend?: boolean;
}) {
	return (
		<div
			className={cn(
				"grid gap-4",
				count <= 3 && "grid-cols-1 sm:grid-cols-3",
				count === 4 && "grid-cols-2 lg:grid-cols-4",
				count > 4 && "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
				className,
			)}
		>
			{Array.from({ length: count }).map((_, i) => (
				<SkeletonStatCard key={i} showTrend={showTrend} />
			))}
		</div>
	);
}

/**
 * SkeletonProviderRow - OAuth provider list item placeholder
 *
 * Matches the OAuthProvidersForm layout:
 * - Icon box (colored background)
 * - Provider name
 * - Toggle switch on right
 */
export function SkeletonProviderRow({ className }: SkeletonProps) {
	return (
		<div className={cn("flex items-center justify-between p-4", className)}>
			<div className="flex items-center gap-3">
				{/* Icon box */}
				<Skeleton className="h-8 w-8 rounded-lg" />
				{/* Provider name */}
				<Skeleton className="h-5 w-24" />
			</div>
			{/* Toggle switch */}
			<Skeleton className="h-6 w-11 rounded-full" />
		</div>
	);
}

/**
 * SkeletonProviderList - List of OAuth provider rows
 *
 * Renders multiple provider rows with dividers.
 */
export function SkeletonProviderList({
	className,
	count = 5,
}: SkeletonProps & {
	count?: number;
}) {
	return (
		<div className={cn("divide-y divide-border", className)}>
			{Array.from({ length: count }).map((_, i) => (
				<SkeletonProviderRow key={i} />
			))}
		</div>
	);
}

// =============================================================================
// Game-Specific Skeletons (from puzzled)
// =============================================================================

/**
 * GameCardSkeleton - Matches DailyHero game card layout
 *
 * Structure:
 * - Large icon (56x56)
 * - Badge area (top right)
 * - Title + tagline
 * - Stats row
 * - Action button
 */
export function GameCardSkeleton({ className }: SkeletonProps) {
	return (
		<div className={cn("rounded-xl border bg-card p-4", className)}>
			{/* Header: Icon + Badge */}
			<div className="mb-3 flex items-start justify-between">
				<Skeleton className="h-14 w-14 rounded-2xl" />
				<Skeleton className="h-6 w-20 rounded-full" />
			</div>

			{/* Title */}
			<Skeleton className="h-5 w-2/3" />

			{/* Tagline */}
			<Skeleton className="mt-2 h-4 w-full" />

			{/* Stats row */}
			<div className="mt-3 flex items-center gap-3">
				<Skeleton className="h-4 w-16" />
				<Skeleton className="h-4 w-20" />
			</div>

			{/* Action button */}
			<Skeleton className="mt-4 h-10 w-full rounded-xl" />
		</div>
	);
}

/**
 * StatsRowSkeleton - Matches Quick Stats Row on home page
 *
 * Features:
 * - 3 stat cards in grid layout
 * - Icon + value + label per card
 * - Matches responsive sizing (2 cols mobile, 3 cols desktop)
 */
export function StatsRowSkeleton({ className }: SkeletonProps) {
	return (
		<div className={cn("grid grid-cols-3 gap-3", className)}>
			{Array.from({ length: 3 }).map((_, i) => (
				<div
					key={i}
					className="flex items-center gap-2 rounded-xl bg-muted/50 p-3"
				>
					<Skeleton className="h-8 w-8 rounded-lg" />
					<div className="flex-1 space-y-1">
						<Skeleton className="h-5 w-12" />
						<Skeleton className="h-3 w-16" />
					</div>
				</div>
			))}
		</div>
	);
}

/**
 * LeaderboardEntrySkeleton - Matches leaderboard row layout
 *
 * Structure:
 * - Rank number
 * - Avatar
 * - Name + subtitle
 * - Score/value
 */
export function LeaderboardEntrySkeleton({
	className,
	rows = 5,
}: SkeletonProps & { rows?: number }) {
	return (
		<div className={cn("space-y-3", className)}>
			{Array.from({ length: rows }).map((_, i) => (
				<div
					key={i}
					className="flex items-center gap-3 rounded-lg border bg-card p-3"
				>
					{/* Rank */}
					<Skeleton className="h-6 w-6 rounded" />

					{/* Avatar */}
					<SkeletonAvatar />

					{/* Name + subtitle */}
					<div className="flex-1 space-y-1">
						<Skeleton className="h-4 w-1/3" />
						<Skeleton className="h-3 w-1/4" />
					</div>

					{/* Score */}
					<Skeleton className="h-6 w-12 rounded" />
				</div>
			))}
		</div>
	);
}

// =============================================================================
// Console-Specific Skeletons
// =============================================================================

/**
 * SkeletonDataTableRow - Single row for DataTable loading states
 *
 * Features:
 * - Checkbox column
 * - Multiple data columns with varying widths
 * - Actions column
 */
export function SkeletonDataTableRow({
	className,
	columns = 4,
	showCheckbox = true,
	showActions = true,
}: SkeletonProps & {
	columns?: number;
	showCheckbox?: boolean;
	showActions?: boolean;
}) {
	return (
		<div
			className={cn("flex items-center gap-4 px-4 py-3 border-b", className)}
		>
			{showCheckbox && <Skeleton className="h-4 w-4 rounded" />}
			{Array.from({ length: columns }).map((_, col) => {
				// First column often has avatar + text
				if (col === 0) {
					return (
						<div key={col} className="flex items-center gap-3 flex-1 min-w-0">
							<SkeletonAvatar size="sm" />
							<div className="space-y-1">
								<Skeleton className="h-4 w-32" />
								<Skeleton className="h-3 w-24" />
							</div>
						</div>
					);
				}
				return (
					<Skeleton
						key={col}
						className={cn("h-4", col === columns - 1 ? "w-16" : "w-24")}
					/>
				);
			})}
			{showActions && <Skeleton className="h-8 w-8 rounded" />}
		</div>
	);
}

/**
 * SkeletonDataTable - Full DataTable loading state
 *
 * Includes header, rows, and optional pagination area.
 */
export function SkeletonDataTable({
	className,
	rows = 5,
	columns = 4,
	showCheckbox = true,
	showActions = true,
	showPagination = true,
}: SkeletonProps & {
	rows?: number;
	columns?: number;
	showCheckbox?: boolean;
	showActions?: boolean;
	showPagination?: boolean;
}) {
	return (
		<div className={cn("rounded-lg border bg-card overflow-hidden", className)}>
			{/* Header */}
			<div className="flex items-center gap-4 px-4 py-3 bg-muted/30 border-b">
				{showCheckbox && <Skeleton className="h-4 w-4 rounded" />}
				{Array.from({ length: columns }).map((_, col) => (
					<Skeleton
						key={col}
						className={cn(
							"h-4",
							col === 0 ? "w-40" : col === columns - 1 ? "w-16" : "w-24",
						)}
					/>
				))}
				{showActions && <div className="w-8" />}
			</div>

			{/* Rows */}
			{Array.from({ length: rows }).map((_, row) => (
				<SkeletonDataTableRow
					key={row}
					columns={columns}
					showCheckbox={showCheckbox}
					showActions={showActions}
				/>
			))}

			{/* Pagination */}
			{showPagination && (
				<div className="flex items-center justify-between px-4 py-3 border-t">
					<Skeleton className="h-4 w-32" />
					<div className="flex items-center gap-2">
						<Skeleton className="h-8 w-8 rounded" />
						<Skeleton className="h-4 w-16" />
						<Skeleton className="h-8 w-8 rounded" />
					</div>
				</div>
			)}
		</div>
	);
}

/**
 * SkeletonForm - Form loading state
 *
 * Renders labeled input field placeholders.
 */
export function SkeletonForm({
	className,
	fields = 3,
	showSubmitButton = true,
}: SkeletonProps & {
	fields?: number;
	showSubmitButton?: boolean;
}) {
	return (
		<div className={cn("space-y-6", className)}>
			{Array.from({ length: fields }).map((_, i) => (
				<div key={i} className="space-y-2">
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-11 w-full rounded-lg" />
				</div>
			))}
			{showSubmitButton && (
				<div className="flex justify-end pt-2">
					<SkeletonButton />
				</div>
			)}
		</div>
	);
}

/**
 * SkeletonBreadcrumb - Breadcrumb loading state
 */
export function SkeletonBreadcrumb({
	className,
	items = 3,
}: SkeletonProps & {
	items?: number;
}) {
	return (
		<div className={cn("flex items-center gap-2", className)}>
			{Array.from({ length: items }).map((_, i) => (
				<div key={i} className="flex items-center gap-2">
					<Skeleton className={cn("h-4", i === items - 1 ? "w-32" : "w-16")} />
					{i < items - 1 && <Skeleton className="h-4 w-2" />}
				</div>
			))}
		</div>
	);
}

/**
 * SkeletonPageHeader - Page header with title and actions
 */
export function SkeletonPageHeader({
	className,
	showDescription = true,
	showActions = true,
}: SkeletonProps & {
	showDescription?: boolean;
	showActions?: boolean;
}) {
	return (
		<div className={cn("flex items-start justify-between gap-4", className)}>
			<div className="space-y-2">
				<Skeleton className="h-8 w-48" />
				{showDescription && <Skeleton className="h-4 w-72" />}
			</div>
			{showActions && (
				<div className="flex items-center gap-2">
					<SkeletonButton size="sm" />
					<SkeletonButton />
				</div>
			)}
		</div>
	);
}
