"use client";

import { cn } from "@/lib/utils";
import { triggerHaptic, triggerSound } from "@/shared/hooks";
import { useEffect, useRef } from "react";
import type { Category } from "../types";
import { CATEGORY_COLORS } from "../types";

type SolvedCategoryProps = {
	category: Category;
	animate?: boolean;
};

export function SolvedCategory({ category, animate }: SolvedCategoryProps) {
	const colors = CATEGORY_COLORS[category.level];
	const soundPlayedRef = useRef(false);

	// Play sound once when a new category is revealed with animation
	useEffect(() => {
		if (animate && !soundPlayedRef.current) {
			soundPlayedRef.current = true;
			triggerSound("categoryFound");
			triggerHaptic("success");
		}
	}, [animate]);

	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center gap-0.5 rounded-lg py-3 transition-all duration-300 min-[400px]:rounded-xl min-[400px]:py-4 sm:py-5",
				colors.bg,
				colors.text,
				animate && "animate-bounce-once",
			)}
		>
			<span className="text-xs font-bold uppercase tracking-wide min-[400px]:text-sm">
				{category.name}
			</span>
			<span className="text-[10px] font-medium opacity-80 min-[400px]:text-xs">
				{category.words.join(", ")}
			</span>
		</div>
	);
}
