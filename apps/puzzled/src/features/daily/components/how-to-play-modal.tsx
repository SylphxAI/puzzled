"use client";

import {
	type GameSlug,
	getHowToPlayConfig,
} from "@/games/how-to-play-registry";
import { DEFAULT_GAME_COLORS, getGameColors } from "@/games/theme-colors";
import { cn } from "@/lib/utils";
import { GameIcon } from "@/shared/components/ui/game-icons";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@sylphx/ui";
import { useTranslations } from "next-intl";

type HowToPlayModalProps = {
	open: boolean;
	onClose: () => void;
	gameSlug: GameSlug;
};

/**
 * HowToPlayModal - Dynamic game instructions from client registry
 *
 * Each game provides its own HowToPlayContent component via client-registry.
 * This modal simply renders that component - no game-specific code here.
 *
 * NOTE: Uses client-registry.ts (not registry.ts) to avoid pulling in
 * server-only code (node:fs via puzzle generators).
 *
 * To add instructions for a new game:
 * 1. Create /src/games/[slug]/components/how-to-play.tsx
 * 2. Add HowToPlayContent to client-registry.ts
 * That's it - the modal will automatically render it.
 */
export function HowToPlayModal({
	open,
	onClose,
	gameSlug,
}: HowToPlayModalProps) {
	const t = useTranslations();
	const config = getHowToPlayConfig(gameSlug);
	const HowToPlayContent = config?.HowToPlayContent;
	const colors = config?.display?.theme
		? getGameColors(config.display.theme)
		: DEFAULT_GAME_COLORS;

	return (
		<Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
			<DialogContent>
				<DialogHeader className="pb-2">
					<DialogTitle className="flex items-center gap-3">
						{/* Game icon with accent color background */}
						<div
							className={cn(
								"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
								colors.bgLight,
							)}
						>
							<GameIcon slug={gameSlug} size={22} className={colors.text} />
						</div>
						{/* Game name and subtitle */}
						<div className="flex flex-col">
							<span className="text-base font-semibold leading-tight">
								{config?.name || "Game"}
							</span>
							<span className="text-xs font-normal text-muted-foreground">
								{t("common.howToPlay")}
							</span>
						</div>
					</DialogTitle>
				</DialogHeader>
				<DialogBody className="space-y-4 pt-2">
					{HowToPlayContent ? (
						<HowToPlayContent />
					) : (
						<p className="text-sm text-muted-foreground">
							Instructions not available for this game.
						</p>
					)}
				</DialogBody>
			</DialogContent>
		</Dialog>
	);
}
