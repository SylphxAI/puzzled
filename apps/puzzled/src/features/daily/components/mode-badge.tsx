"use client";

import type { GameMode } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { Calendar, Target } from "lucide-react";
import { useTranslations } from "next-intl";

type ModeBadgeProps = {
	mode: GameMode;
	className?: string;
	size?: "sm" | "md";
};

const MODE_CONFIG: Record<
	GameMode,
	{
		icon: typeof Target;
		labelKey: string;
		bgColor: string;
		textColor: string;
	}
> = {
	daily: {
		icon: Target,
		labelKey: "daily",
		bgColor: "bg-emerald-500/10",
		textColor: "text-emerald-600 dark:text-emerald-400",
	},
	archive: {
		icon: Calendar,
		labelKey: "archive",
		bgColor: "bg-blue-500/10",
		textColor: "text-blue-600 dark:text-blue-400",
	},
};

/**
 * ModeBadge - Visual indicator for game mode
 *
 * Shows current mode with appropriate icon and color:
 * - Daily: Green target icon
 * - Archive: Blue calendar icon
 */
export function ModeBadge({ mode, className, size = "sm" }: ModeBadgeProps) {
	const t = useTranslations("modes");
	const config = MODE_CONFIG[mode];
	const Icon = config.icon;

	const sizeClasses = {
		sm: "px-2 py-0.5 text-xs gap-1",
		md: "px-2.5 py-1 text-xs gap-1.5",
	};

	const iconSizes = {
		sm: "h-3 w-3",
		md: "h-3.5 w-3.5",
	};

	return (
		<div
			className={cn(
				"inline-flex items-center rounded-full font-medium",
				config.bgColor,
				config.textColor,
				sizeClasses[size],
				className,
			)}
		>
			<Icon className={iconSizes[size]} />
			<span>{t(config.labelKey)}</span>
		</div>
	);
}
