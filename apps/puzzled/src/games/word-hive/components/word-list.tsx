"use client";

import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

type WordListProps = {
	foundWords: string[];
	totalWords: number;
	pangrams: string[];
};

/**
 * Display list of found words with expandable view
 */
export function WordList({ foundWords, totalWords, pangrams }: WordListProps) {
	const [expanded, setExpanded] = useState(false);

	// Sort words alphabetically
	const sortedWords = [...foundWords].sort();

	// Show first few words when collapsed
	const displayWords = expanded ? sortedWords : sortedWords.slice(0, 5);
	const hasMore = sortedWords.length > 5;

	return (
		<div className="w-full rounded-lg border bg-card p-3 sm:p-4">
			{/* Header */}
			<div className="mb-2 flex items-center justify-between">
				<span className="text-sm font-medium text-muted-foreground">
					You have found {foundWords.length} of {totalWords} words
				</span>
			</div>

			{/* Word pills */}
			{foundWords.length === 0 ? (
				<p className="py-4 text-center text-sm text-muted-foreground">
					Words you find will appear here
				</p>
			) : (
				<>
					<div className="flex flex-wrap gap-1.5">
						{displayWords.map((word) => (
							<span
								key={word}
								className={cn(
									"rounded-full px-2.5 py-1 text-xs font-medium",
									pangrams.includes(word)
										? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
										: "bg-muted text-muted-foreground",
								)}
							>
								{word.toLowerCase()}
								{pangrams.includes(word) && " ✨"}
							</span>
						))}
					</div>

					{/* Expand/collapse button */}
					{hasMore && (
						<button
							type="button"
							onClick={() => setExpanded(!expanded)}
							className="mt-2 flex w-full items-center justify-center gap-1 py-1 text-xs text-muted-foreground hover:text-foreground"
						>
							{expanded ? (
								<>
									Show less <ChevronUp className="h-3 w-3" />
								</>
							) : (
								<>
									Show all {sortedWords.length} words{" "}
									<ChevronDown className="h-3 w-3" />
								</>
							)}
						</button>
					)}
				</>
			)}
		</div>
	);
}
