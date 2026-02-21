"use client";

import { useTranslations } from "next-intl";

/**
 * Block Slide How-to-Play content
 * Self-contained component for game rules and examples
 */
export function BlockSlideHowToPlay() {
	const t = useTranslations("games.blockSlide");

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

				<div className="flex flex-col items-center">
					{/* Mini board representation */}
					<div className="relative h-32 w-24 rounded-lg border-2 border-slate-500 bg-slate-100 dark:bg-slate-800">
						{/* Grid lines */}
						<div className="absolute inset-0 grid grid-cols-4 grid-rows-5">
							{Array.from({ length: 20 }).map((_, i) => (
								<div
									key={i}
									className="border border-slate-200/50 dark:border-slate-700/50"
								/>
							))}
						</div>
						{/* Target block (red 2x2) */}
						<div className="absolute left-[25%] top-[5%] flex h-[36%] w-[50%] items-center justify-center rounded bg-red-500 text-xs font-bold text-white">
							★
						</div>
						{/* Other blocks */}
						<div className="absolute left-[2%] top-[5%] h-[36%] w-[23%] rounded bg-slate-300 dark:bg-slate-600" />
						<div className="absolute right-[2%] top-[5%] h-[36%] w-[23%] rounded bg-slate-300 dark:bg-slate-600" />
						<div className="absolute bottom-[25%] left-[2%] h-[32%] w-[23%] rounded bg-slate-300 dark:bg-slate-600" />
						<div className="absolute bottom-[25%] right-[2%] h-[32%] w-[23%] rounded bg-slate-300 dark:bg-slate-600" />
					</div>
					{/* Exit */}
					<div className="mt-1 rounded-b bg-green-500 px-3 py-0.5 text-xs font-bold text-white">
						EXIT
					</div>
				</div>

				<p className="text-center text-xs text-muted-foreground">
					Slide blocks to move the{" "}
					<span className="font-bold text-red-500">★ block</span> to the exit
				</p>
			</div>

			{/* Controls */}
			<div className="space-y-2">
				<p className="text-sm font-medium">Controls</p>
				<ul className="space-y-1 text-xs text-muted-foreground">
					<li>• Click/tap a block to select it</li>
					<li>• Use arrow keys or swipe to move</li>
					<li>• Drag blocks directly to slide them</li>
				</ul>
			</div>
		</div>
	);
}

function _BlockSlideHowToPlayTitle() {
	const t = useTranslations("games.blockSlide");
	return <>{t("howToPlay")}</>;
}
