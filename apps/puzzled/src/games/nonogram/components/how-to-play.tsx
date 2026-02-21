"use client";

import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

/**
 * Nonogram How-to-Play content
 * Self-contained component for game rules and examples
 */
export function NonogramHowToPlay() {
	const t = useTranslations("games.nonogram");

	return (
		<div className="space-y-4">
			{/* Basic rules */}
			<div className="space-y-2">
				<p className="font-medium">{t("rules.title")}</p>
				<ul className="space-y-1.5 text-sm text-muted-foreground">
					<li>• {t("rules.rule1")}</li>
					<li>• {t("rules.rule2")}</li>
					<li>• {t("rules.rule3")}</li>
				</ul>
			</div>

			{/* Visual example - Mini grid */}
			<div className="space-y-3">
				<p className="text-sm font-medium">Example</p>

				<div className="flex items-start gap-2">
					{/* Row clues */}
					<div className="flex flex-col items-end pt-6">
						<div className="flex h-6 items-center text-xs font-medium">1 1</div>
						<div className="flex h-6 items-center text-xs font-medium">3</div>
						<div className="flex h-6 items-center text-xs font-medium">1 1</div>
					</div>

					<div className="flex flex-col">
						{/* Column clues */}
						<div className="flex">
							<div className="flex w-6 flex-col items-center text-xs font-medium">
								<span>3</span>
							</div>
							<div className="flex w-6 flex-col items-center text-xs font-medium">
								<span>1</span>
							</div>
							<div className="flex w-6 flex-col items-center text-xs font-medium">
								<span>3</span>
							</div>
						</div>

						{/* Grid: Row0=■□■, Row1=■■■, Row2=■□■ */}
						<div className="grid grid-cols-3 gap-0.5 rounded border border-border bg-border p-0.5">
							<NonogramCell filled />
							<NonogramCell />
							<NonogramCell filled />
							<NonogramCell filled />
							<NonogramCell filled />
							<NonogramCell filled />
							<NonogramCell filled />
							<NonogramCell />
							<NonogramCell filled />
						</div>
					</div>
				</div>

				<p className="text-center text-xs text-muted-foreground">
					&quot;1 1&quot; means two separate groups of 1 filled cell each
				</p>
			</div>

			{/* Controls */}
			<div className="space-y-2">
				<p className="text-sm font-medium">Controls</p>
				<ul className="space-y-1 text-xs text-muted-foreground">
					<li>• Click to fill a cell</li>
					<li>• Right-click or toggle mode to mark empty cells (×)</li>
					<li>• Complete all cells to reveal the hidden picture</li>
				</ul>
			</div>
		</div>
	);
}

function _NonogramHowToPlayTitle() {
	const t = useTranslations("games.nonogram");
	return <>{t("howToPlay")}</>;
}

function NonogramCell({ filled = false }: { filled?: boolean }) {
	return (
		<div
			className={cn(
				"flex h-6 w-6 items-center justify-center",
				filled ? "bg-foreground" : "bg-background",
			)}
		/>
	);
}
