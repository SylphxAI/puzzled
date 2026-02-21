/**
 * Analytics Dashboard Components
 *
 * Event viewer, stats cards, and basic analytics visualization.
 */

"use client";

import { type CSSProperties, useEffect, useState } from "react";
import type { ThemeVariables } from "./styles";
import {
	baseStyles,
	defaultTheme,
	injectGlobalStyles,
	mergeStyles,
} from "./styles";

// ============================================
// Types
// ============================================

export interface AnalyticsEvent {
	id: string;
	name: string;
	timestamp: string;
	userId?: string;
	properties?: Record<string, unknown>;
	sessionId?: string;
}

export interface AnalyticsStat {
	label: string;
	value: number | string;
	change?: number; // percentage change
	changeLabel?: string;
	icon?: "users" | "pageviews" | "events" | "sessions" | "custom";
}

export interface TimeSeriesData {
	label: string;
	value: number;
}

// ============================================
// EventViewer
// ============================================

export interface EventViewerProps {
	/** Theme variables */
	theme?: ThemeVariables;
	/** Custom class name */
	className?: string;
	/** Events to display */
	events?: AnalyticsEvent[];
	/** Whether loading */
	isLoading?: boolean;
	/** Called when event is clicked */
	onEventClick?: (event: AnalyticsEvent) => void;
	/** Show search/filter */
	showSearch?: boolean;
	/** Show timestamps */
	showTimestamps?: boolean;
	/** Max events to show */
	maxEvents?: number;
	/** Empty state message */
	emptyMessage?: string;
	/** Title */
	title?: string;
}

/**
 * Real-time event viewer
 *
 * @example
 * ```tsx
 * <EventViewer
 *   events={events}
 *   onEventClick={(e) => console.log(e)}
 *   showSearch
 * />
 * ```
 */
export function EventViewer({
	theme = defaultTheme,
	className,
	events = [],
	isLoading = false,
	onEventClick,
	showSearch = true,
	showTimestamps = true,
	maxEvents = 100,
	emptyMessage = "No events recorded yet",
	title = "Recent Events",
}: EventViewerProps) {
	const [search, setSearch] = useState("");
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const styles = baseStyles(theme);

	useEffect(() => {
		injectGlobalStyles();
	}, []);

	const filteredEvents = events
		.filter(
			(e) => !search || e.name.toLowerCase().includes(search.toLowerCase()),
		)
		.slice(0, maxEvents);

	const containerStyle: CSSProperties = {
		fontFamily: theme.fontFamily,
		border: `1px solid ${theme.colorBorder}`,
		borderRadius: theme.borderRadius,
		overflow: "hidden",
	};

	const headerStyle: CSSProperties = {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		padding: "1rem",
		backgroundColor: theme.colorMuted,
		borderBottom: `1px solid ${theme.colorBorder}`,
	};

	const eventItemStyle: CSSProperties = {
		padding: "0.75rem 1rem",
		borderBottom: `1px solid ${theme.colorBorder}`,
		cursor: onEventClick ? "pointer" : "default",
		transition: "background-color 0.15s ease",
	};

	return (
		<div style={containerStyle} className={className}>
			<div style={headerStyle}>
				<h3
					style={{
						margin: 0,
						fontSize: theme.fontSizeLg,
						fontWeight: 600,
						display: "flex",
						alignItems: "center",
						gap: "0.5rem",
					}}
				>
					<EventIcon color={theme.colorPrimary} />
					{title}
				</h3>
				{showSearch && (
					<input
						type="text"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Filter events..."
						style={{
							padding: "0.5rem 0.75rem",
							fontSize: theme.fontSizeXs,
							border: `1px solid ${theme.colorBorder}`,
							borderRadius: theme.borderRadiusSm,
							backgroundColor: theme.colorBackground,
							color: theme.colorForeground,
							width: "200px",
						}}
					/>
				)}
			</div>

			<div style={{ maxHeight: "400px", overflowY: "auto" }}>
				{isLoading ? (
					<div style={{ padding: "2rem", textAlign: "center" }}>
						<span style={styles.spinner} />
					</div>
				) : filteredEvents.length === 0 ? (
					<div
						style={{
							padding: "3rem",
							textAlign: "center",
							color: theme.colorMutedForeground,
						}}
					>
						<EventIcon color={theme.colorMuted} size={48} />
						<p style={{ margin: "1rem 0 0" }}>{emptyMessage}</p>
					</div>
				) : (
					filteredEvents.map((event, i) => (
						<div
							key={event.id}
							onClick={() => {
								setExpandedId(expandedId === event.id ? null : event.id);
								onEventClick?.(event);
							}}
							style={{
								...eventItemStyle,
								borderBottom:
									i === filteredEvents.length - 1
										? "none"
										: eventItemStyle.borderBottom,
							}}
						>
							<div
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
								}}
							>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: "0.75rem",
									}}
								>
									<span
										style={{
											width: 8,
											height: 8,
											borderRadius: "50%",
											backgroundColor: theme.colorPrimary,
										}}
									/>
									<span style={{ fontWeight: 500, fontSize: theme.fontSizeSm }}>
										{event.name}
									</span>
								</div>
								{showTimestamps && (
									<span
										style={{
											fontSize: theme.fontSizeXs,
											color: theme.colorMutedForeground,
										}}
									>
										{new Date(event.timestamp).toLocaleString()}
									</span>
								)}
							</div>

							{/* Expanded details */}
							{expandedId === event.id &&
								event.properties &&
								Object.keys(event.properties).length > 0 && (
									<div
										style={{
											marginTop: "0.75rem",
											padding: "0.75rem",
											backgroundColor: theme.colorMuted,
											borderRadius: theme.borderRadiusSm,
											fontSize: theme.fontSizeXs,
										}}
									>
										<pre
											style={{
												margin: 0,
												fontFamily: "monospace",
												whiteSpace: "pre-wrap",
											}}
										>
											{JSON.stringify(event.properties, null, 2)}
										</pre>
									</div>
								)}
						</div>
					))
				)}
			</div>
		</div>
	);
}

// ============================================
// StatsCard
// ============================================

export interface StatsCardProps {
	/** Theme variables */
	theme?: ThemeVariables;
	/** Custom class name */
	className?: string;
	/** Stat label */
	label: string;
	/** Stat value */
	value: number | string;
	/** Percentage change */
	change?: number;
	/** Change label (e.g., "vs last week") */
	changeLabel?: string;
	/** Icon type */
	icon?: "users" | "pageviews" | "events" | "sessions" | "revenue" | "custom";
	/** Custom icon */
	customIcon?: React.ReactNode;
	/** Whether loading */
	isLoading?: boolean;
}

/**
 * Single stat card
 *
 * @example
 * ```tsx
 * <StatsCard
 *   label="Total Users"
 *   value={1234}
 *   change={12.5}
 *   changeLabel="vs last month"
 *   icon="users"
 * />
 * ```
 */
export function StatsCard({
	theme = defaultTheme,
	className,
	label,
	value,
	change,
	changeLabel = "vs last period",
	icon = "custom",
	customIcon,
	isLoading = false,
}: StatsCardProps) {
	const styles = baseStyles(theme);

	useEffect(() => {
		injectGlobalStyles();
	}, []);

	const containerStyle: CSSProperties = {
		fontFamily: theme.fontFamily,
		padding: "1.25rem",
		border: `1px solid ${theme.colorBorder}`,
		borderRadius: theme.borderRadius,
		backgroundColor: theme.colorBackground,
	};

	const getIcon = () => {
		if (customIcon) return customIcon;
		switch (icon) {
			case "users":
				return <UsersIcon color={theme.colorPrimary} />;
			case "pageviews":
				return <PageviewsIcon color={theme.colorPrimary} />;
			case "events":
				return <EventIcon color={theme.colorPrimary} />;
			case "sessions":
				return <SessionsIcon color={theme.colorPrimary} />;
			case "revenue":
				return <RevenueIcon color={theme.colorPrimary} />;
			default:
				return <ChartIcon color={theme.colorPrimary} />;
		}
	};

	const formatValue = (val: number | string) => {
		if (typeof val === "number") {
			if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
			if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
			return val.toLocaleString();
		}
		return val;
	};

	return (
		<div style={containerStyle} className={className}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					marginBottom: "0.75rem",
				}}
			>
				<span
					style={{
						fontSize: theme.fontSizeSm,
						color: theme.colorMutedForeground,
					}}
				>
					{label}
				</span>
				{getIcon()}
			</div>

			{isLoading ? (
				<div style={{ height: "2rem" }}>
					<span style={styles.spinner} />
				</div>
			) : (
				<>
					<div
						style={{
							fontSize: theme.fontSizeXl,
							fontWeight: 600,
							marginBottom: "0.5rem",
						}}
					>
						{formatValue(value)}
					</div>

					{change !== undefined && (
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: "0.25rem",
								fontSize: theme.fontSizeXs,
							}}
						>
							<span
								style={{
									color:
										change >= 0 ? theme.colorSuccess : theme.colorDestructive,
									fontWeight: 500,
								}}
							>
								{change >= 0 ? "↑" : "↓"} {Math.abs(change).toFixed(1)}%
							</span>
							<span style={{ color: theme.colorMutedForeground }}>
								{changeLabel}
							</span>
						</div>
					)}
				</>
			)}
		</div>
	);
}

// ============================================
// StatsGrid
// ============================================

export interface StatsGridProps {
	/** Theme variables */
	theme?: ThemeVariables;
	/** Custom class name */
	className?: string;
	/** Stats to display */
	stats: AnalyticsStat[];
	/** Number of columns */
	columns?: 2 | 3 | 4;
	/** Whether loading */
	isLoading?: boolean;
}

/**
 * Grid of stat cards
 *
 * @example
 * ```tsx
 * <StatsGrid
 *   stats={[
 *     { label: 'Users', value: 1234, change: 12 },
 *     { label: 'Sessions', value: 5678, change: -5 },
 *   ]}
 *   columns={4}
 * />
 * ```
 */
export function StatsGrid({
	theme = defaultTheme,
	className,
	stats,
	columns = 4,
	isLoading = false,
}: StatsGridProps) {
	const gridStyle: CSSProperties = {
		display: "grid",
		gridTemplateColumns: `repeat(${columns}, 1fr)`,
		gap: "1rem",
	};

	return (
		<div style={gridStyle} className={className}>
			{stats.map((stat, i) => (
				<StatsCard
					key={i}
					theme={theme}
					label={stat.label}
					value={stat.value}
					change={stat.change}
					changeLabel={stat.changeLabel}
					icon={stat.icon}
					isLoading={isLoading}
				/>
			))}
		</div>
	);
}

// ============================================
// SimpleChart (Bar Chart)
// ============================================

export interface SimpleChartProps {
	/** Theme variables */
	theme?: ThemeVariables;
	/** Custom class name */
	className?: string;
	/** Data points */
	data: TimeSeriesData[];
	/** Chart title */
	title?: string;
	/** Y-axis label */
	yAxisLabel?: string;
	/** Bar color */
	barColor?: string;
	/** Height of chart area */
	height?: number;
	/** Whether loading */
	isLoading?: boolean;
}

/**
 * Simple bar chart for time series data
 *
 * @example
 * ```tsx
 * <SimpleChart
 *   title="Daily Active Users"
 *   data={[
 *     { label: 'Mon', value: 100 },
 *     { label: 'Tue', value: 150 },
 *     { label: 'Wed', value: 120 },
 *   ]}
 * />
 * ```
 */
export function SimpleChart({
	theme = defaultTheme,
	className,
	data,
	title,
	yAxisLabel,
	barColor,
	height = 200,
	isLoading = false,
}: SimpleChartProps) {
	const styles = baseStyles(theme);

	useEffect(() => {
		injectGlobalStyles();
	}, []);

	const maxValue = Math.max(...data.map((d) => d.value), 1);
	const color = barColor ?? theme.colorPrimary;

	const containerStyle: CSSProperties = {
		fontFamily: theme.fontFamily,
		padding: "1.25rem",
		border: `1px solid ${theme.colorBorder}`,
		borderRadius: theme.borderRadius,
		backgroundColor: theme.colorBackground,
	};

	return (
		<div style={containerStyle} className={className}>
			{title && (
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						marginBottom: "1rem",
					}}
				>
					<h3
						style={{ margin: 0, fontSize: theme.fontSizeLg, fontWeight: 600 }}
					>
						{title}
					</h3>
					{yAxisLabel && (
						<span
							style={{
								fontSize: theme.fontSizeXs,
								color: theme.colorMutedForeground,
							}}
						>
							{yAxisLabel}
						</span>
					)}
				</div>
			)}

			{isLoading ? (
				<div
					style={{
						height,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<span style={styles.spinner} />
				</div>
			) : data.length === 0 ? (
				<div
					style={{
						height,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						color: theme.colorMutedForeground,
					}}
				>
					No data available
				</div>
			) : (
				<div style={{ height }}>
					<div
						style={{
							display: "flex",
							alignItems: "flex-end",
							justifyContent: "space-between",
							height: "100%",
							gap: "4px",
						}}
					>
						{data.map((d, i) => {
							const barHeight = (d.value / maxValue) * 100;

							return (
								<div
									key={i}
									style={{
										flex: 1,
										display: "flex",
										flexDirection: "column",
										alignItems: "center",
										height: "100%",
									}}
								>
									<div
										style={{
											flex: 1,
											width: "100%",
											display: "flex",
											alignItems: "flex-end",
										}}
									>
										<div
											style={{
												width: "100%",
												height: `${barHeight}%`,
												backgroundColor: color,
												borderRadius: "4px 4px 0 0",
												minHeight: "4px",
												transition: "height 0.3s ease",
											}}
											title={`${d.label}: ${d.value.toLocaleString()}`}
										/>
									</div>
									<span
										style={{
											marginTop: "0.5rem",
											fontSize: "0.625rem",
											color: theme.colorMutedForeground,
											whiteSpace: "nowrap",
										}}
									>
										{d.label}
									</span>
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}

// ============================================
// AnalyticsDashboard (Combined)
// ============================================

export interface AnalyticsDashboardProps {
	/** Theme variables */
	theme?: ThemeVariables;
	/** Custom class name */
	className?: string;
	/** Stats to display */
	stats?: AnalyticsStat[];
	/** Chart data */
	chartData?: TimeSeriesData[];
	/** Chart title */
	chartTitle?: string;
	/** Recent events */
	events?: AnalyticsEvent[];
	/** Whether loading */
	isLoading?: boolean;
	/** Time period label */
	period?: string;
}

/**
 * Complete analytics dashboard
 *
 * @example
 * ```tsx
 * <AnalyticsDashboard
 *   stats={stats}
 *   chartData={dailyData}
 *   chartTitle="Daily Active Users"
 *   events={recentEvents}
 *   period="Last 7 days"
 * />
 * ```
 */
export function AnalyticsDashboard({
	theme = defaultTheme,
	className,
	stats = [],
	chartData = [],
	chartTitle = "Activity",
	events = [],
	isLoading = false,
	period,
}: AnalyticsDashboardProps) {
	const containerStyle: CSSProperties = {
		fontFamily: theme.fontFamily,
		display: "flex",
		flexDirection: "column",
		gap: "1.5rem",
	};

	return (
		<div style={containerStyle} className={className}>
			{period && (
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
					}}
				>
					<h2
						style={{ margin: 0, fontSize: theme.fontSizeXl, fontWeight: 600 }}
					>
						Analytics
					</h2>
					<span
						style={{
							fontSize: theme.fontSizeSm,
							color: theme.colorMutedForeground,
						}}
					>
						{period}
					</span>
				</div>
			)}

			{stats.length > 0 && (
				<StatsGrid
					theme={theme}
					stats={stats}
					columns={Math.min(stats.length, 4) as 2 | 3 | 4}
					isLoading={isLoading}
				/>
			)}

			{chartData.length > 0 && (
				<SimpleChart
					theme={theme}
					data={chartData}
					title={chartTitle}
					isLoading={isLoading}
				/>
			)}

			{events.length > 0 && (
				<EventViewer
					theme={theme}
					events={events}
					isLoading={isLoading}
					maxEvents={10}
				/>
			)}
		</div>
	);
}

// ============================================
// Icons
// ============================================

function EventIcon({ color, size = 20 }: { color: string; size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<circle cx="12" cy="12" r="10" />
			<polyline points="12 6 12 12 16 14" />
		</svg>
	);
}

function UsersIcon({ color }: { color: string }) {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
			<circle cx="9" cy="7" r="4" />
			<path d="M23 21v-2a4 4 0 0 0-3-3.87" />
			<path d="M16 3.13a4 4 0 0 1 0 7.75" />
		</svg>
	);
}

function PageviewsIcon({ color }: { color: string }) {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
			<circle cx="12" cy="12" r="3" />
		</svg>
	);
}

function SessionsIcon({ color }: { color: string }) {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
			<line x1="9" y1="3" x2="9" y2="21" />
		</svg>
	);
}

function RevenueIcon({ color }: { color: string }) {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<line x1="12" y1="1" x2="12" y2="23" />
			<path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
		</svg>
	);
}

function ChartIcon({ color }: { color: string }) {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<line x1="18" y1="20" x2="18" y2="10" />
			<line x1="12" y1="20" x2="12" y2="4" />
			<line x1="6" y1="20" x2="6" y2="14" />
		</svg>
	);
}
