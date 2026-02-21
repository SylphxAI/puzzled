"use client";

import { cn } from "@/lib/utils";
import { memo } from "react";
import type { LetterStatus, TileState } from "../types";
import { MAX_GUESSES, WORD_LENGTH } from "../types";

type TileProps = {
	letter: string;
	status: LetterStatus;
	delay?: number;
	isCurrentRow?: boolean;
	position?: number;
};

// Human-readable status descriptions for screen readers
const STATUS_LABELS: Record<LetterStatus, string> = {
	correct: "correct position",
	present: "wrong position",
	absent: "not in word",
	empty: "empty",
	pending: "entered",
};

/**
 * Memoized tile component - only re-renders when its props change
 */
const Tile = memo(function Tile({
	letter,
	status,
	delay = 0,
	isCurrentRow,
	position,
}: TileProps) {
	// Enhanced tile colors with brand-tinted shadows and playful roundness (Puzzled signature look)
	// Uses violet-tinted shadows instead of NYT's neutral gray shadows
	const statusColors: Record<LetterStatus, string> = {
		correct:
			"bg-gradient-to-br from-correct via-correct to-correct/80 text-white border-correct shadow-[0_4px_12px_-2px_rgb(124_58_237/0.4)] ring-2 ring-correct/30",
		present:
			"bg-gradient-to-br from-present via-present to-present/80 text-white border-present shadow-[0_4px_12px_-2px_rgb(249_115_22/0.4)] ring-2 ring-present/30",
		absent:
			"bg-gradient-to-b from-absent to-absent/90 text-white border-absent shadow-md",
		empty: "bg-muted/40 border-border/60 shadow-[var(--shadow-tile)]",
		pending:
			"bg-muted/60 border-muted-foreground/50 shadow-[var(--shadow-tile)]",
	};

	// Generate accessible label
	const ariaLabel = letter
		? `Letter ${position !== undefined ? position + 1 : ""}: ${letter.toUpperCase()}, ${STATUS_LABELS[status]}`
		: `Empty tile${position !== undefined ? ` ${position + 1}` : ""}`;

	return (
		/* biome-ignore lint/a11y/useFocusableInteractive: Grid cell is display-only, user types via keyboard */
		/* biome-ignore lint/a11y/useSemanticElements: No native HTML element for game tile grid - ARIA grid pattern is WAI-ARIA recommended */
		<div
			className={cn(
				// Responsive tile sizes with playful roundness (12-16px)
				// Mobile-first: min 44px touch target, scales up to max 64px on desktop
				"flex aspect-square min-h-[44px] min-w-[44px] w-[calc((100vw-48px)/5)] max-w-[52px] items-center justify-center rounded-lg border-2 text-lg font-bold uppercase transition-all",
				"sm:min-h-[52px] sm:min-w-[52px] sm:w-14 sm:max-w-[56px] sm:rounded-xl sm:text-xl md:min-h-[56px] md:min-w-[56px] md:w-16 md:max-w-[64px] md:text-2xl",
				statusColors[status],
				status !== "empty" && status !== "pending" && "animate-flip",
				isCurrentRow && letter && "animate-bounce-pop",
			)}
			style={{
				animationDelay:
					status !== "empty" && status !== "pending"
						? `${delay * 100}ms`
						: "0ms",
			}}
			role="gridcell"
			aria-label={ariaLabel}
			aria-live={isCurrentRow ? "polite" : undefined}
		>
			{letter}
		</div>
	);
});

type RowProps = {
	guess: string;
	evaluation?: TileState[];
	isCurrentRow?: boolean;
	rowIndex?: number;
};

/**
 * Memoized row component - only re-renders when its props change
 */
const Row = memo(function Row({
	guess,
	evaluation,
	isCurrentRow,
	rowIndex,
}: RowProps) {
	const tiles: TileState[] = [];

	for (let i = 0; i < WORD_LENGTH; i++) {
		if (evaluation?.[i]) {
			tiles.push(evaluation[i]);
		} else if (guess[i]) {
			tiles.push({ letter: guess[i], status: "pending" });
		} else {
			tiles.push({ letter: "", status: "empty" });
		}
	}

	// Create row label for screen readers
	const rowLabel = evaluation
		? `Row ${(rowIndex ?? 0) + 1}: ${guess.toUpperCase()}`
		: isCurrentRow
			? `Row ${(rowIndex ?? 0) + 1}: Current guess`
			: `Row ${(rowIndex ?? 0) + 1}: Empty`;

	return (
		/* biome-ignore lint/a11y/useFocusableInteractive: Row container is display-only, not interactive */
		/* biome-ignore lint/a11y/useSemanticElements: No native HTML element for game row - ARIA grid pattern is WAI-ARIA recommended */
		<div className="flex gap-1 sm:gap-2" role="row" aria-label={rowLabel}>
			{tiles.map((tile, i) => (
				<Tile
					key={i}
					letter={tile.letter}
					status={tile.status}
					delay={i}
					isCurrentRow={isCurrentRow}
					position={i}
				/>
			))}
		</div>
	);
});

type GameBoardProps = {
	guesses: string[];
	evaluations: TileState[][];
	currentGuess: string;
	currentRow: number;
	gameStatus?: "playing" | "won" | "lost";
	/** Trigger shake animation on current row (for invalid input) */
	shake?: boolean;
};

export function GameBoard({
	guesses,
	evaluations,
	currentGuess,
	currentRow,
	gameStatus = "playing",
	shake = false,
}: GameBoardProps) {
	const rows = [];

	for (let i = 0; i < MAX_GUESSES; i++) {
		if (i < guesses.length) {
			// Completed row
			rows.push(
				<Row
					key={i}
					guess={guesses[i]}
					evaluation={evaluations[i]}
					rowIndex={i}
				/>,
			);
		} else if (i === currentRow) {
			// Current row being typed (may have shake animation)
			rows.push(
				<div key={i} className={shake ? "animate-shake" : ""}>
					<Row guess={currentGuess} isCurrentRow rowIndex={i} />
				</div>,
			);
		} else {
			// Empty row
			rows.push(<Row key={i} guess="" rowIndex={i} />);
		}
	}

	// Create game status announcement for screen readers
	const statusAnnouncement =
		gameStatus === "won"
			? `Congratulations! You solved it in ${guesses.length} ${guesses.length === 1 ? "guess" : "guesses"}`
			: gameStatus === "lost"
				? `Game over. The word was ${guesses.length > 0 ? "" : "not revealed"}`
				: `${MAX_GUESSES - currentRow} guesses remaining`;

	return (
		/* biome-ignore lint/a11y/useSemanticElements: No native HTML element for game board - ARIA grid pattern is WAI-ARIA recommended */
		<div
			className="flex w-full max-w-[320px] flex-col items-center gap-1 px-2 sm:max-w-sm sm:gap-2 sm:px-0"
			role="grid"
			aria-label="Word Guess game board"
			aria-describedby="game-status"
		>
			{rows}
			{/* Hidden status announcer for screen readers */}
			<div
				id="game-status"
				className="sr-only"
				aria-live="polite"
				aria-atomic="true"
			>
				{statusAnnouncement}
			</div>
		</div>
	);
}
