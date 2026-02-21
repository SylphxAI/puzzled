"use client";

import { useGameAnalytics } from "@/lib/api";
import { MINUTE_MS } from "@/lib/constants/time";
import { GameIcon } from "@/shared/components/ui/game-icons";
import {
	AlertCircle,
	BarChart3,
	Gamepad2,
	RefreshCw,
	TrendingUp,
} from "lucide-react";
import { useState } from "react";

type DateRange = "7d" | "14d" | "30d" | "90d";

/**
 * Game Dashboard
 *
 * Shows detailed analytics for a single game.
 * Uses getSingleGameAnalytics which returns daily stats (date, gamesPlayed, wins, avgAttempts).
 */
export function GameDashboard({ slug }: { slug: string }) {
	const [dateRange, setDateRange] = useState<DateRange>("30d");
	const days =
		dateRange === "7d"
			? 7
			: dateRange === "14d"
				? 14
				: dateRange === "30d"
					? 30
					: 90;

	const {
		data: analytics,
		isLoading,
		refetch,
		isRefetching,
	} = useGameAnalytics(slug, days, { refetchInterval: MINUTE_MS });

	if (isLoading) {
		return <GameDashboardSkeleton />;
	}

	if (!analytics) {
		return (
			<div className="admin-card p-8 text-center">
				<AlertCircle className="mx-auto h-8 w-8 text-[var(--admin-error)]" />
				<p className="mt-2 text-[var(--admin-text-secondary)]">
					Failed to load game analytics
				</p>
			</div>
		);
	}

	const { dailyStats } = analytics;

	// Calculate overview stats from daily data
	const totalPlays = dailyStats.reduce((sum, d) => sum + d.gamesPlayed, 0);
	const totalWins = dailyStats.reduce((sum, d) => sum + (d.wins ?? 0), 0);
	const avgAttempts =
		dailyStats.length > 0
			? Math.round(
					(dailyStats.reduce((sum, d) => sum + (d.avgAttempts ?? 0), 0) /
						dailyStats.length) *
						10,
				) / 10
			: 0;
	const winRate =
		totalPlays > 0 ? Math.round((totalWins / totalPlays) * 100) : 0;

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="admin-card p-6">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-4">
						<div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--admin-bg-surface)]">
							<GameIcon
								slug={slug}
								size={32}
								className="text-[var(--admin-text-primary)]"
							/>
						</div>
						<div>
							<h1 className="text-2xl font-bold capitalize text-[var(--admin-text-primary)]">
								{slug.replace(/-/g, " ")}
							</h1>
							<p className="mt-1 text-sm text-[var(--admin-text-muted)]">
								Showing data for the last {days} days
							</p>
						</div>
					</div>

					<div className="flex items-center gap-3">
						{/* Date Range Selector */}
						<div className="admin-segment-control">
							{(["7d", "14d", "30d", "90d"] as DateRange[]).map((range) => (
								<button
									key={range}
									type="button"
									onClick={() => setDateRange(range)}
									className={`admin-segment-btn ${dateRange === range ? "active" : ""}`}
								>
									{range}
								</button>
							))}
						</div>

						<button
							type="button"
							onClick={() => refetch()}
							disabled={isRefetching}
							className="admin-btn admin-btn-ghost"
						>
							<RefreshCw
								className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`}
							/>
						</button>
					</div>
				</div>
			</div>

			{/* Overview Stats */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatCard
					icon={<Gamepad2 className="h-5 w-5" />}
					label="Total Plays"
					value={totalPlays.toLocaleString()}
					color="var(--admin-info)"
				/>
				<StatCard
					icon={<TrendingUp className="h-5 w-5" />}
					label="Win Rate"
					value={`${winRate}%`}
					color="var(--admin-success)"
					subtext={`${totalWins.toLocaleString()} wins`}
				/>
				<StatCard
					icon={<BarChart3 className="h-5 w-5" />}
					label="Avg Attempts"
					value={avgAttempts.toString()}
					color="var(--admin-accent)"
				/>
				<StatCard
					icon={<BarChart3 className="h-5 w-5" />}
					label="Days with Data"
					value={dailyStats.length.toString()}
					color="var(--admin-warning)"
				/>
			</div>

			{/* Plays Trend Chart */}
			<div className="admin-card p-6">
				<h3 className="mb-4 flex items-center gap-2 font-semibold text-[var(--admin-text-primary)]">
					<TrendingUp className="h-5 w-5 text-[var(--admin-accent)]" />
					Daily Plays Trend
				</h3>
				{dailyStats.length === 0 ? (
					<div className="py-12 text-center text-[var(--admin-text-muted)]">
						No data available for this period
					</div>
				) : (
					<PlaysChart data={dailyStats} />
				)}
			</div>

			{/* Daily Stats Table */}
			<div className="admin-card">
				<div className="border-b border-[var(--admin-border)] p-4">
					<h3 className="flex items-center gap-2 font-semibold text-[var(--admin-text-primary)]">
						<BarChart3 className="h-5 w-5 text-[var(--admin-accent)]" />
						Daily Breakdown
					</h3>
				</div>
				{dailyStats.length === 0 ? (
					<div className="p-8 text-center text-[var(--admin-text-muted)]">
						No data available
					</div>
				) : (
					<div className="max-h-96 overflow-y-auto">
						<table className="admin-table">
							<thead>
								<tr>
									<th>Date</th>
									<th>Plays</th>
									<th>Wins</th>
									<th>Win Rate</th>
									<th>Avg Attempts</th>
								</tr>
							</thead>
							<tbody>
								{dailyStats.map((day) => {
									const dayWinRate =
										day.gamesPlayed > 0
											? Math.round(((day.wins ?? 0) / day.gamesPlayed) * 100)
											: 0;
									return (
										<tr key={day.date}>
											<td className="font-medium">{day.date}</td>
											<td>{day.gamesPlayed}</td>
											<td>{day.wins ?? 0}</td>
											<td>
												<span
													className={`font-medium ${
														dayWinRate >= 70
															? "text-[var(--admin-success)]"
															: dayWinRate >= 40
																? "text-[var(--admin-warning)]"
																: "text-[var(--admin-error)]"
													}`}
												>
													{dayWinRate}%
												</span>
											</td>
											<td>{day.avgAttempts?.toFixed(1) ?? "N/A"}</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}

function StatCard({
	icon,
	label,
	value,
	color,
	subtext,
}: {
	icon: React.ReactNode;
	label: string;
	value: string;
	color: string;
	subtext?: string;
}) {
	return (
		<div className="admin-card p-5">
			<div className="flex items-start justify-between">
				<div
					className="flex h-10 w-10 items-center justify-center rounded-lg"
					style={{
						background: `color-mix(in srgb, ${color} 15%, transparent)`,
						color,
					}}
				>
					{icon}
				</div>
			</div>
			<p className="mt-3 text-2xl font-bold text-[var(--admin-text-primary)]">
				{value}
			</p>
			<p className="text-sm text-[var(--admin-text-muted)]">{label}</p>
			{subtext && (
				<p className="mt-1 text-xs text-[var(--admin-text-muted)]">{subtext}</p>
			)}
		</div>
	);
}

function PlaysChart({
	data,
}: {
	data: {
		date: string;
		gamesPlayed: number;
		wins: number | null;
		avgAttempts: number | null;
	}[];
}) {
	const maxPlays = Math.max(...data.map((d) => d.gamesPlayed), 1);

	return (
		<div className="space-y-2">
			<div className="flex h-48 items-end gap-1">
				{data.map((day) => {
					const height = (day.gamesPlayed / maxPlays) * 100;
					const winRate =
						day.gamesPlayed > 0
							? Math.round(((day.wins ?? 0) / day.gamesPlayed) * 100)
							: 0;

					return (
						<div
							key={day.date}
							className="group relative flex-1"
							title={`${day.date}: ${day.gamesPlayed} plays, ${winRate}% win rate`}
						>
							<div
								className="w-full rounded-t bg-[var(--admin-accent)] transition-all hover:bg-[var(--admin-accent-muted)]"
								style={{ height: `${Math.max(height, 2)}%` }}
							/>
							{/* Tooltip */}
							<div className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-[var(--admin-bg-elevated)] px-2 py-1 text-xs shadow-lg group-hover:block">
								<p className="font-medium">{day.gamesPlayed} plays</p>
								<p className="text-[var(--admin-text-muted)]">
									{winRate}% win rate
								</p>
							</div>
						</div>
					);
				})}
			</div>
			{/* X-axis labels (show first, middle, last) */}
			<div className="flex justify-between text-xs text-[var(--admin-text-muted)]">
				<span>{data[0]?.date.slice(5)}</span>
				<span>{data[Math.floor(data.length / 2)]?.date.slice(5)}</span>
				<span>{data[data.length - 1]?.date.slice(5)}</span>
			</div>
		</div>
	);
}

function GameDashboardSkeleton() {
	return (
		<div className="space-y-6">
			{/* Header skeleton */}
			<div className="admin-card p-6">
				<div className="flex items-center gap-4">
					<div className="h-16 w-16 animate-pulse rounded-2xl bg-[var(--admin-bg-surface)]" />
					<div className="space-y-2">
						<div className="h-8 w-48 animate-pulse rounded bg-[var(--admin-bg-surface)]" />
						<div className="h-5 w-32 animate-pulse rounded bg-[var(--admin-bg-surface)]" />
					</div>
				</div>
			</div>

			{/* Stats skeleton */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{[1, 2, 3, 4].map((i) => (
					<div key={i} className="admin-card p-5">
						<div className="h-10 w-10 animate-pulse rounded-lg bg-[var(--admin-bg-surface)]" />
						<div className="mt-3 h-8 w-20 animate-pulse rounded bg-[var(--admin-bg-surface)]" />
						<div className="mt-1 h-4 w-24 animate-pulse rounded bg-[var(--admin-bg-surface)]" />
					</div>
				))}
			</div>

			{/* Chart skeleton */}
			<div className="admin-card p-6">
				<div className="mb-4 h-6 w-32 animate-pulse rounded bg-[var(--admin-bg-surface)]" />
				<div className="h-48 animate-pulse rounded bg-[var(--admin-bg-surface)]" />
			</div>
		</div>
	);
}
