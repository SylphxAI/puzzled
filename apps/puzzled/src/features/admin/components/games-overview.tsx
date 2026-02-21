"use client";

import { useGamesOverview } from "@/lib/api";
import { MINUTE_MS } from "@/lib/constants/time";
import { GameIcon } from "@/shared/components/ui/game-icons";
import {
	AlertCircle,
	ArrowRight,
	CheckCircle2,
	Gamepad2,
	RefreshCw,
	TrendingUp,
	Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

/**
 * Games Overview
 *
 * Shows all games with basic stats from getGamesOverview.
 * The router returns: { slug, name, todayGamesPlayed, todayWins, allTimeGamesPlayed, allTimeWins }
 */
export function GamesOverview() {
	const t = useTranslations("admin.games");

	const {
		data: games,
		isLoading,
		refetch,
		isRefetching,
	} = useGamesOverview({
		refetchInterval: MINUTE_MS,
	});

	if (isLoading) {
		return <GamesOverviewSkeleton />;
	}

	if (!games || games.length === 0) {
		return (
			<div className="admin-card p-8 text-center">
				<AlertCircle className="mx-auto h-8 w-8 text-[var(--admin-error)]" />
				<p className="mt-2 text-[var(--admin-text-secondary)]">
					Failed to load games data
				</p>
			</div>
		);
	}

	// Calculate summary stats
	const totalPlaysToday = games.reduce((sum, g) => sum + g.todayGamesPlayed, 0);
	const totalPlaysAllTime = games.reduce(
		(sum, g) => sum + g.allTimeGamesPlayed,
		0,
	);
	const _totalWinsToday = games.reduce((sum, g) => sum + g.todayWins, 0);
	const avgWinRate =
		totalPlaysAllTime > 0
			? Math.round(
					(games.reduce((sum, g) => sum + g.allTimeWins, 0) /
						totalPlaysAllTime) *
						100,
				)
			: 0;

	return (
		<div className="space-y-6">
			{/* Header with refresh */}
			<div className="flex items-center justify-between">
				<p className="text-sm text-[var(--admin-text-muted)]">
					{t("totalGames", { count: games.length })}
				</p>
				<button
					type="button"
					onClick={() => refetch()}
					disabled={isRefetching}
					className="admin-btn admin-btn-ghost"
				>
					<RefreshCw
						className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`}
					/>
					{t("refresh")}
				</button>
			</div>

			{/* Summary Stats */}
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<SummaryCard
					icon={<Gamepad2 className="h-5 w-5" />}
					label="Total Games"
					value={games.length}
				/>
				<SummaryCard
					icon={<TrendingUp className="h-5 w-5" />}
					label="All Time Plays"
					value={totalPlaysAllTime.toLocaleString()}
				/>
				<SummaryCard
					icon={<Users className="h-5 w-5" />}
					label="Plays Today"
					value={totalPlaysToday.toLocaleString()}
				/>
				<SummaryCard
					icon={<CheckCircle2 className="h-5 w-5" />}
					label="Avg Win Rate"
					value={`${avgWinRate}%`}
				/>
			</div>

			{/* Games Grid */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{games.map((game, index) => (
					<GameCard key={game.slug} game={game} delay={index} />
				))}
			</div>
		</div>
	);
}

function SummaryCard({
	icon,
	label,
	value,
}: {
	icon: React.ReactNode;
	label: string;
	value: string | number;
}) {
	return (
		<div className="admin-card p-4">
			<div className="flex items-center gap-3">
				<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--admin-accent-subtle)] text-[var(--admin-accent)]">
					{icon}
				</div>
				<div>
					<p className="text-2xl font-semibold text-[var(--admin-text-primary)]">
						{value}
					</p>
					<p className="text-xs text-[var(--admin-text-muted)]">{label}</p>
				</div>
			</div>
		</div>
	);
}

type GameData = {
	slug: string;
	name: string;
	todayGamesPlayed: number;
	todayWins: number;
	allTimeGamesPlayed: number;
	allTimeWins: number;
};

function GameCard({ game, delay = 0 }: { game: GameData; delay?: number }) {
	const winRate =
		game.allTimeGamesPlayed > 0
			? Math.round((game.allTimeWins / game.allTimeGamesPlayed) * 100)
			: 0;

	return (
		<Link
			href={`/admin/games/${game.slug}`}
			className="admin-card admin-animate-in group block p-5 transition-all hover:border-[var(--admin-border-subtle)] hover:shadow-[var(--admin-shadow)]"
			style={{ animationDelay: `${delay * 0.03}s` }}
		>
			{/* Header */}
			<div className="flex items-start justify-between">
				<div className="flex items-center gap-3">
					<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--admin-bg-surface)]">
						<GameIcon
							slug={game.slug}
							size={24}
							className="text-[var(--admin-text-secondary)]"
						/>
					</div>
					<div>
						<h3 className="font-semibold text-[var(--admin-text-primary)] group-hover:text-[var(--admin-accent)]">
							{game.name}
						</h3>
					</div>
				</div>
				<ArrowRight className="h-4 w-4 text-[var(--admin-text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
			</div>

			{/* Stats */}
			<div className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--admin-border)] pt-4">
				<div>
					<p className="text-lg font-semibold text-[var(--admin-text-primary)]">
						{game.allTimeGamesPlayed.toLocaleString()}
					</p>
					<p className="text-xs text-[var(--admin-text-muted)]">All Time</p>
				</div>
				<div>
					<p className="text-lg font-semibold text-[var(--admin-text-primary)]">
						{winRate}%
					</p>
					<p className="text-xs text-[var(--admin-text-muted)]">Win Rate</p>
				</div>
				<div>
					<p className="text-lg font-semibold text-[var(--admin-text-primary)]">
						{game.todayGamesPlayed.toLocaleString()}
					</p>
					<p className="text-xs text-[var(--admin-text-muted)]">Today</p>
				</div>
			</div>
		</Link>
	);
}

function GamesOverviewSkeleton() {
	return (
		<div className="space-y-6">
			{/* Header skeleton */}
			<div className="flex items-center justify-between">
				<div className="h-5 w-32 animate-pulse rounded bg-[var(--admin-bg-surface)]" />
				<div className="h-9 w-24 animate-pulse rounded bg-[var(--admin-bg-surface)]" />
			</div>

			{/* Summary stats skeleton */}
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				{[1, 2, 3, 4].map((i) => (
					<div key={i} className="admin-card p-4">
						<div className="flex items-center gap-3">
							<div className="h-10 w-10 animate-pulse rounded-lg bg-[var(--admin-bg-surface)]" />
							<div className="space-y-2">
								<div className="h-6 w-16 animate-pulse rounded bg-[var(--admin-bg-surface)]" />
								<div className="h-3 w-20 animate-pulse rounded bg-[var(--admin-bg-surface)]" />
							</div>
						</div>
					</div>
				))}
			</div>

			{/* Cards skeleton */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{[1, 2, 3, 4, 5, 6].map((i) => (
					<div key={i} className="admin-card p-5">
						<div className="flex items-center gap-3">
							<div className="h-12 w-12 animate-pulse rounded-xl bg-[var(--admin-bg-surface)]" />
							<div className="space-y-2">
								<div className="h-5 w-24 animate-pulse rounded bg-[var(--admin-bg-surface)]" />
								<div className="h-3 w-16 animate-pulse rounded bg-[var(--admin-bg-surface)]" />
							</div>
						</div>
						<div className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--admin-border)] pt-4">
							{[1, 2, 3].map((j) => (
								<div key={j} className="space-y-1">
									<div className="h-6 w-12 animate-pulse rounded bg-[var(--admin-bg-surface)]" />
									<div className="h-3 w-16 animate-pulse rounded bg-[var(--admin-bg-surface)]" />
								</div>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
