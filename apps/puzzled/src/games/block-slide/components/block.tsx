/**
 * Block Component
 *
 * Renders a single draggable block in the puzzle.
 */

"use client";

import { cn } from "@/lib/utils";
import { useCallback, useRef } from "react";
import type { Block as BlockType, Direction } from "../types";

type Props = {
	block: BlockType;
	cellSize: number;
	isSelected: boolean;
	onClick: () => void;
	onDrag: (direction: Direction) => void;
};

export function Block({ block, cellSize, isSelected, onClick, onDrag }: Props) {
	const startPosRef = useRef<{ x: number; y: number } | null>(null);
	const hasDraggedRef = useRef(false);

	const handlePointerDown = useCallback((e: React.PointerEvent) => {
		e.preventDefault();
		startPosRef.current = { x: e.clientX, y: e.clientY };
		hasDraggedRef.current = false;
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
	}, []);

	const handlePointerMove = useCallback(
		(e: React.PointerEvent) => {
			if (!startPosRef.current) return;

			const dx = e.clientX - startPosRef.current.x;
			const dy = e.clientY - startPosRef.current.y;
			const threshold = cellSize * 0.4;

			// Determine direction based on dominant axis
			if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
				let direction: Direction;
				if (Math.abs(dx) > Math.abs(dy)) {
					direction = dx > 0 ? "right" : "left";
				} else {
					direction = dy > 0 ? "down" : "up";
				}

				onDrag(direction);
				startPosRef.current = { x: e.clientX, y: e.clientY };
				hasDraggedRef.current = true;
			}
		},
		[cellSize, onDrag],
	);

	const handlePointerUp = useCallback(
		(e: React.PointerEvent) => {
			(e.target as HTMLElement).releasePointerCapture(e.pointerId);

			if (!hasDraggedRef.current) {
				onClick();
			}

			startPosRef.current = null;
			hasDraggedRef.current = false;
		},
		[onClick],
	);

	const width = block.width * cellSize - 4;
	const height = block.height * cellSize - 4;
	const left = block.x * cellSize + 2;
	const top = block.y * cellSize + 2;

	return (
		<div
			className={cn(
				"absolute flex cursor-pointer items-center justify-center rounded border-2 sm:rounded-lg font-bold transition-all duration-150 select-none touch-none",
				block.isTarget
					? "border-red-400 bg-red-500 text-white shadow-lg"
					: "border-slate-400 bg-slate-200 text-slate-600 dark:border-slate-500 dark:bg-slate-600 dark:text-slate-200",
				isSelected &&
					!block.isTarget &&
					"ring-1 sm:ring-2 ring-primary ring-offset-1 sm:ring-offset-2",
				isSelected &&
					block.isTarget &&
					"ring-1 sm:ring-2 ring-yellow-400 ring-offset-1 sm:ring-offset-2",
			)}
			style={{
				width,
				height,
				left,
				top,
				fontSize: Math.max(Math.min(width, height) * 0.3, 14),
			}}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerUp}
		>
			{block.isTarget ? "★" : ""}
		</div>
	);
}
