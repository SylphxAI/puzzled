"use client";

import { cn } from "@/lib/utils";

type CurrentWordProps = {
	word: string;
	centerLetter: string;
	shake?: boolean;
};

/**
 * Display the currently typed word with highlighted center letter
 */
export function CurrentWord({ word, centerLetter, shake }: CurrentWordProps) {
	return (
		<div
			className={cn(
				"flex min-h-[56px] w-full max-w-sm items-center justify-center px-4 py-2",
				shake && "animate-shake",
			)}
		>
			{word.length === 0 ? (
				<span className="text-lg font-light text-muted-foreground/50 sm:text-2xl">
					Type or click
				</span>
			) : (
				<div className="flex items-center overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
					{word.split("").map((letter, index) => (
						<span
							key={`${letter}-${index}`}
							className={cn(
								"text-2xl font-bold uppercase sm:text-3xl md:text-4xl",
								letter === centerLetter
									? "text-amber-500 dark:text-amber-400"
									: "text-foreground",
							)}
						>
							{letter}
						</span>
					))}
					{/* Blinking cursor */}
					<span className="ml-0.5 animate-pulse text-2xl font-light text-muted-foreground sm:text-3xl md:text-4xl">
						|
					</span>
				</div>
			)}
		</div>
	);
}
