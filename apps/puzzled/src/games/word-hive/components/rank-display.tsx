"use client";

import { cn } from "@/lib/utils";
import {
	RANK_THRESHOLDS,
	type SpellingBeeRank,
	getNextRankThreshold,
} from "../types";

type RankDisplayProps = {
	rank: SpellingBeeRank;
	score: number;
	maxScore: number;
};

const RANK_LABELS: Record<SpellingBeeRank, string> = {
	beginner: "Beginner",
	"good-start": "Good Start",
	"moving-up": "Moving Up",
	good: "Good",
	solid: "Solid",
	nice: "Nice",
	great: "Great",
	amazing: "Amazing",
	genius: "Genius",
	"queen-bee": "Queen Bee 👑",
};

/**
 * Display current rank and progress bar
 */
export function RankDisplay({ rank, score, maxScore }: RankDisplayProps) {
	const progressPercent = maxScore > 0 ? (score / maxScore) * 100 : 0;
	const nextRank = getNextRankThreshold(score, maxScore);

	return (
		<div className="w-full space-y-2">
			{/* Rank label and score */}
			<div className="flex items-center justify-between">
				<span
					className={cn(
						"text-sm font-semibold",
						rank === "queen-bee" && "text-amber-500",
						rank === "genius" && "text-purple-500",
					)}
				>
					{RANK_LABELS[rank]}
				</span>
				<span className="text-sm text-muted-foreground">{score} pts</span>
			</div>

			{/* Progress bar with rank markers */}
			<div className="relative h-2 overflow-hidden rounded-full bg-muted">
				{/* Progress fill */}
				<div
					className={cn(
						"absolute inset-y-0 left-0 transition-all duration-500",
						rank === "queen-bee"
							? "bg-gradient-to-r from-amber-400 to-amber-500"
							: "bg-primary",
					)}
					style={{ width: `${Math.min(progressPercent, 100)}%` }}
				/>

				{/* Rank markers */}
				{RANK_THRESHOLDS.slice(1).map(({ rank: r, percentage }) => (
					<div
						key={r}
						className="absolute top-0 h-full w-0.5 bg-background/50"
						style={{ left: `${percentage}%` }}
					/>
				))}
			</div>

			{/* Next rank info */}
			{nextRank && (
				<p className="text-xs text-muted-foreground">
					{nextRank.pointsNeeded} more point
					{nextRank.pointsNeeded !== 1 ? "s" : ""} to{" "}
					{RANK_LABELS[nextRank.rank]}
				</p>
			)}
		</div>
	);
}
