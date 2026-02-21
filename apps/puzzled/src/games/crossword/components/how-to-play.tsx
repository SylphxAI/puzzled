"use client";

import { useTranslations } from "next-intl";

/**
 * Crossword How-to-Play content
 * Self-contained component for game rules and examples
 */
export function CrosswordHowToPlay() {
	const t = useTranslations("games.crossword");

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

			{/* Visual example - Valid 3x3 crossword */}
			{/* Grid: TAB / ORE / PET - All 6 words valid */}
			{/* Across: TAB, ORE, PET | Down: TOP, ARE, BET */}
			<div className="space-y-3">
				<p className="text-sm font-medium">Example</p>

				<div className="mx-auto grid w-fit grid-cols-3 gap-0.5 rounded border border-border bg-border p-0.5">
					<CrosswordCell letter="T" number={1} />
					<CrosswordCell letter="A" number={2} />
					<CrosswordCell letter="B" number={3} />
					<CrosswordCell letter="O" />
					<CrosswordCell letter="R" />
					<CrosswordCell letter="E" />
					<CrosswordCell letter="P" number={4} />
					<CrosswordCell letter="E" />
					<CrosswordCell letter="T" />
				</div>

				<div className="text-xs text-muted-foreground">
					<p>
						<strong>Across:</strong> 1. Browser marker (TAB), 4. Furry companion
						(PET)
					</p>
					<p>
						<strong>Down:</strong> 1. Summit (TOP), 3. Wager (BET)
					</p>
				</div>
			</div>
		</div>
	);
}

function _CrosswordHowToPlayTitle() {
	const t = useTranslations("games.crossword");
	return <>{t("howToPlay")}</>;
}

function CrosswordCell({
	letter,
	number,
}: { letter: string; number?: number }) {
	return (
		<div className="relative flex h-8 w-8 items-center justify-center bg-background text-sm font-bold">
			{number && (
				<span className="absolute left-0.5 top-0 text-[8px] font-normal text-muted-foreground">
					{number}
				</span>
			)}
			{letter}
		</div>
	);
}
