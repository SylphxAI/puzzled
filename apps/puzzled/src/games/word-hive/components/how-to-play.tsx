"use client";

import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

/**
 * Spelling Bee How-to-Play content
 * Self-contained component for game rules and examples
 */
export function SpellingBeeHowToPlay() {
	const t = useTranslations("games.wordHive");

	return (
		<div className="space-y-4">
			{/* Basic rules */}
			<div className="space-y-2">
				<ul className="space-y-1.5 text-sm text-muted-foreground">
					<li>• {t("rules.rule1")}</li>
					<li>• {t("rules.rule2")}</li>
					<li>• {t("rules.rule3")}</li>
					<li>• {t("rules.rule4")}</li>
				</ul>
			</div>

			{/* Visual example - Honeycomb */}
			<div className="space-y-3">
				<p className="text-sm font-medium">Example</p>

				<div className="flex items-center justify-center gap-1">
					<HexLetter letter="B" isCenter={false} />
					<HexLetter letter="A" isCenter={true} />
					<HexLetter letter="C" isCenter={false} />
				</div>

				<p className="text-center text-xs text-muted-foreground">
					The <span className="font-bold text-amber-500">center letter</span>{" "}
					must be in every word
				</p>
			</div>

			{/* Scoring */}
			<div className="space-y-2">
				<p className="text-sm font-medium">Scoring</p>
				<div className="space-y-1 text-xs text-muted-foreground">
					<p>• 4-letter words: 1 point</p>
					<p>• 5+ letter words: 1 point per letter</p>
					<p>
						• <span className="font-medium text-amber-500">{t("pangram")}</span>{" "}
						(uses all 7 letters): {t("pangramBonus")}
					</p>
				</div>
			</div>
		</div>
	);
}

function _SpellingBeeHowToPlayTitle() {
	const t = useTranslations("games.wordHive");
	return <>{t("howToPlay")}</>;
}

function HexLetter({
	letter,
	isCenter,
}: { letter: string; isCenter: boolean }) {
	return (
		<div
			className={cn(
				"flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold",
				isCenter ? "bg-amber-500 text-white" : "bg-muted text-foreground",
			)}
		>
			{letter}
		</div>
	);
}
