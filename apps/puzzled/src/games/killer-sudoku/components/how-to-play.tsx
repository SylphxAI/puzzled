"use client";

import { useTranslations } from "next-intl";

/**
 * Killer Sudoku How-to-Play content
 * Self-contained component for game rules and examples
 */
export function KillerSudokuHowToPlay() {
	const t = useTranslations("games.killerSudoku");

	return (
		<div className="space-y-4">
			{/* Basic rules */}
			<div className="space-y-2">
				<ul className="space-y-1.5 text-sm text-muted-foreground">
					<li>• {t("rules.rule1")}</li>
					<li>• {t("rules.rule2")}</li>
					<li>• {t("rules.rule3")}</li>
				</ul>
			</div>

			{/* Visual example */}
			<div className="space-y-3">
				<p className="text-sm font-medium">Example</p>

				<div className="flex justify-center">
					{/* Mini 3x3 cage example */}
					<div className="relative">
						<div className="grid grid-cols-3 gap-0.5 rounded border-2 border-foreground/50 bg-border p-0.5">
							{/* Cage 1: Top-left 2 cells (sum: 7) */}
							<div className="relative flex h-8 w-8 items-center justify-center border-b border-r border-dashed border-muted-foreground bg-background text-sm font-bold">
								<span className="absolute left-0.5 top-0 text-[7px] font-normal text-muted-foreground">
									7
								</span>
								3
							</div>
							<div className="flex h-8 w-8 items-center justify-center border-b border-dashed border-muted-foreground bg-background text-sm font-bold">
								4
							</div>
							<div className="relative flex h-8 w-8 items-center justify-center border-l border-dashed border-muted-foreground bg-background text-sm font-bold">
								<span className="absolute left-0.5 top-0 text-[7px] font-normal text-muted-foreground">
									8
								</span>
								8
							</div>
							{/* Row 2 */}
							<div className="relative flex h-8 w-8 items-center justify-center border-r border-t border-dashed border-muted-foreground bg-background text-sm font-bold">
								<span className="absolute left-0.5 top-0 text-[7px] font-normal text-muted-foreground">
									11
								</span>
								5
							</div>
							<div className="flex h-8 w-8 items-center justify-center bg-background text-sm font-bold text-primary">
								?
							</div>
							<div className="flex h-8 w-8 items-center justify-center border-t border-dashed border-muted-foreground bg-background text-sm font-bold">
								7
							</div>
							{/* Row 3 */}
							<div className="flex h-8 w-8 items-center justify-center bg-background text-sm font-bold">
								6
							</div>
							<div className="relative flex h-8 w-8 items-center justify-center border-l border-t border-dashed border-muted-foreground bg-background text-sm font-bold">
								<span className="absolute left-0.5 top-0 text-[7px] font-normal text-muted-foreground">
									11
								</span>
								2
							</div>
							<div className="flex h-8 w-8 items-center justify-center border-t border-dashed border-muted-foreground bg-background text-sm font-bold">
								9
							</div>
						</div>
					</div>
				</div>

				<p className="text-center text-xs text-muted-foreground">
					Dashed borders show cages. Numbers in corners are cage sums.
				</p>
			</div>

			{/* Controls */}
			<div className="space-y-2">
				<p className="text-sm font-medium">Controls</p>
				<ul className="space-y-1 text-xs text-muted-foreground">
					<li>• Click a cell and use number keys or buttons</li>
					<li>• Press N to toggle notes mode</li>
					<li>• No duplicate numbers in cages</li>
				</ul>
			</div>
		</div>
	);
}

function _KillerSudokuHowToPlayTitle() {
	const t = useTranslations("games.killerSudoku");
	return <>{t("howToPlay")}</>;
}
