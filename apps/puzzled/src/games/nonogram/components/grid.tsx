"use client";

/**
 * Nonogram Grid Component
 * Displays the puzzle grid with row/column clues
 */

import { cn } from "@/lib/utils";
import { memo, useCallback, useMemo } from "react";

import type { CellState, NonogramPuzzleData } from "../types";

type CellProps = {
	cell: CellState;
	row: number;
	col: number;
	isSelected: boolean;
	puzzleWidth: number;
	puzzleHeight: number;
	disabled: boolean;
	onClick: (row: number, col: number) => void;
	onRightClick: (row: number, col: number) => void;
};

/**
 * Memoized nonogram cell - only re-renders when its props change
 */
const NonogramCell = memo(function NonogramCell({
	cell,
	row,
	col,
	isSelected,
	puzzleWidth,
	puzzleHeight,
	disabled,
	onClick,
	onRightClick,
}: CellProps) {
	const handleClick = useCallback(() => onClick(row, col), [onClick, row, col]);
	const handleContextMenu = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			onRightClick(row, col);
		},
		[onRightClick, row, col],
	);

	return (
		<button
			type="button"
			onClick={handleClick}
			onContextMenu={handleContextMenu}
			disabled={disabled}
			className={cn(
				"w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8",
				"border border-border/50",
				"transition-colors duration-75",
				"flex items-center justify-center",
				"text-base sm:text-lg font-bold",
				// Grid lines every 5 cells
				col % 5 === 4 &&
					col < puzzleWidth - 1 &&
					"border-r-2 border-r-primary/30",
				row % 5 === 4 &&
					row < puzzleHeight - 1 &&
					"border-b-2 border-b-primary/30",
				// Cell states
				cell === "filled" && "bg-foreground",
				cell === "marked" && "bg-muted",
				cell === "empty" && "bg-background hover:bg-muted/50",
				// Selection
				isSelected && "ring-2 ring-primary ring-inset",
				// Disabled
				disabled && "cursor-not-allowed opacity-50",
			)}
		>
			{cell === "marked" && (
				<span className="text-muted-foreground text-sm">×</span>
			)}
		</button>
	);
});

type NonogramGridProps = {
	puzzle: NonogramPuzzleData;
	userGrid: CellState[][];
	selectedCell: { row: number; col: number } | null;
	completedRows: Set<number>;
	completedCols: Set<number>;
	fillMode: "fill" | "mark";
	onCellClick: (row: number, col: number) => void;
	onCellRightClick: (row: number, col: number) => void;
	disabled?: boolean;
};

export function NonogramGrid({
	puzzle,
	userGrid,
	selectedCell,
	completedRows,
	completedCols,
	fillMode,
	onCellClick,
	onCellRightClick,
	disabled = false,
}: NonogramGridProps) {
	// Calculate max clue length for sizing
	const maxRowClues = useMemo(
		() => Math.max(...puzzle.rowClues.map((c) => c.length)),
		[puzzle.rowClues],
	);
	const maxColClues = useMemo(
		() => Math.max(...puzzle.colClues.map((c) => c.length)),
		[puzzle.colClues],
	);

	// Memoize stable handlers
	const handleCellClick = useCallback(
		(row: number, col: number) => onCellClick(row, col),
		[onCellClick],
	);
	const handleCellRightClick = useCallback(
		(row: number, col: number) => onCellRightClick(row, col),
		[onCellRightClick],
	);

	return (
		<div className="flex flex-col items-center gap-0 overflow-x-auto max-w-full">
			{/* Column clues header */}
			<div className="flex">
				{/* Empty corner space */}
				<div
					style={{
						width: `${Math.min(maxRowClues * 1.25, 4)}rem`,
						minWidth: `${Math.min(maxRowClues * 1.25, 4)}rem`,
					}}
				/>

				{/* Column clues */}
				<div className="flex">
					{puzzle.colClues.map((clues, colIndex) => (
						<div
							key={colIndex}
							className={cn(
								"flex flex-col items-center justify-end",
								"w-6 sm:w-7 md:w-8",
								colIndex % 5 === 4 &&
									colIndex < puzzle.width - 1 &&
									"border-r-2 border-primary/30",
								completedCols.has(colIndex) && "opacity-40",
							)}
							style={{ height: `${Math.min(maxColClues * 0.875, 5)}rem` }}
						>
							{clues.map((clue, i) => (
								<span
									key={i}
									className={cn(
										"text-[10px] sm:text-xs font-medium leading-tight",
										completedCols.has(colIndex)
											? "text-muted-foreground"
											: "text-foreground",
									)}
								>
									{clue}
								</span>
							))}
						</div>
					))}
				</div>
			</div>

			{/* Grid rows with row clues */}
			<div className="flex flex-col">
				{userGrid.map((row, rowIndex) => (
					<div key={rowIndex} className="flex">
						{/* Row clues */}
						<div
							className={cn(
								"flex items-center justify-end gap-0.5 sm:gap-1 pr-0.5 sm:pr-1",
								rowIndex % 5 === 4 &&
									rowIndex < puzzle.height - 1 &&
									"border-b-2 border-primary/30",
								completedRows.has(rowIndex) && "opacity-40",
							)}
							style={{ width: `${Math.min(maxRowClues * 1.25, 4)}rem` }}
						>
							{puzzle.rowClues[rowIndex].map((clue, i) => (
								<span
									key={i}
									className={cn(
										"text-[10px] sm:text-xs font-medium",
										completedRows.has(rowIndex)
											? "text-muted-foreground"
											: "text-foreground",
									)}
								>
									{clue}
								</span>
							))}
						</div>

						{/* Grid cells */}
						{row.map((cell, colIndex) => (
							<NonogramCell
								key={colIndex}
								cell={cell}
								row={rowIndex}
								col={colIndex}
								isSelected={
									selectedCell?.row === rowIndex &&
									selectedCell?.col === colIndex
								}
								puzzleWidth={puzzle.width}
								puzzleHeight={puzzle.height}
								disabled={disabled}
								onClick={handleCellClick}
								onRightClick={handleCellRightClick}
							/>
						))}
					</div>
				))}
			</div>

			{/* Mode indicator */}
			<div className="mt-3 text-xs sm:text-sm text-muted-foreground text-center px-4">
				{fillMode === "fill" ? (
					<span>
						Tap to <strong>fill</strong> • Right-click to mark X
					</span>
				) : (
					<span>
						Tap to <strong>mark X</strong> • Right-click to fill
					</span>
				)}
			</div>
		</div>
	);
}
