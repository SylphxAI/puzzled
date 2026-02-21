"use client";

import { Link } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";
import { AlertTriangle, Flame, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

type StreakWarningProps = {
	currentStreak: number;
	hasPlayedToday: boolean;
	game?: string; // Optional: specific game with streak at risk
};

export function StreakWarning({
	currentStreak,
	hasPlayedToday,
	game,
}: StreakWarningProps) {
	const t = useTranslations("streak");
	const [dismissed, setDismissed] = useState(false);

	// Only show if user has a streak and hasn't played today
	if (currentStreak === 0 || hasPlayedToday || dismissed) {
		return null;
	}

	// Determine urgency based on streak length
	const isHighStreak = currentStreak >= 7;
	const isLegendaryStreak = currentStreak >= 30;

	return (
		<div
			role="alert"
			aria-live="polite"
			className={cn(
				"relative flex items-center gap-3 rounded-xl p-4",
				isLegendaryStreak
					? "bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30"
					: isHighStreak
						? "bg-orange-500/10 border border-orange-500/20"
						: "bg-yellow-500/10 border border-yellow-500/20",
			)}
		>
			<button
				type="button"
				onClick={() => setDismissed(true)}
				className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
				aria-label={t("dismiss")}
			>
				<X className="h-3 w-3" aria-hidden="true" />
			</button>

			<div
				className={cn(
					"flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
					isLegendaryStreak
						? "bg-orange-500/20"
						: isHighStreak
							? "bg-orange-500/15"
							: "bg-yellow-500/15",
				)}
				aria-hidden="true"
			>
				{isLegendaryStreak ? (
					<AlertTriangle className="h-6 w-6 text-orange-500" />
				) : (
					<Flame
						className={cn(
							"h-6 w-6",
							isHighStreak ? "text-orange-500" : "text-yellow-500",
						)}
					/>
				)}
			</div>

			<div className="min-w-0 flex-1 pr-6">
				<p className="font-semibold">
					{isLegendaryStreak
						? t("legendaryAtRisk")
						: isHighStreak
							? t("streakAtRisk")
							: t("keepStreak")}
				</p>
				<p className="mt-0.5 text-sm text-muted-foreground">
					{t("playToMaintain", { streak: currentStreak })}
				</p>
			</div>

			<Link
				href={game ? `/games/${game}` : "/games"}
				className={cn(
					"shrink-0 rounded-lg px-4 py-2 text-sm font-medium text-white",
					isLegendaryStreak
						? "bg-gradient-to-r from-orange-500 to-red-500"
						: isHighStreak
							? "bg-orange-500"
							: "bg-yellow-500",
				)}
			>
				{t("playNow")}
			</Link>
		</div>
	);
}

// Compact inline version for game cards
function _StreakBadge({
	streak,
	hasPlayedToday,
}: { streak: number; hasPlayedToday: boolean }) {
	const _t = useTranslations("streak");

	if (streak === 0) return null;

	return (
		<output
			aria-label={`${streak} day streak${!hasPlayedToday ? " - play today to keep it" : ""}`}
			className={cn(
				"flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
				hasPlayedToday
					? "bg-green-500/10 text-green-600"
					: "bg-orange-500/10 text-orange-600",
			)}
		>
			<Flame className="h-3 w-3" aria-hidden="true" />
			{streak}
			{!hasPlayedToday && (
				<span className="text-xs" aria-hidden="true">
					!
				</span>
			)}
		</output>
	);
}
