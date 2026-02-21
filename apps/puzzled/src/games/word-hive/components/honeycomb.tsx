"use client";

import { cn } from "@/lib/utils";
import { memo, useCallback } from "react";

type HexButtonProps = {
	letter: string;
	onClick: () => void;
	isCenter?: boolean;
	disabled?: boolean;
	style?: React.CSSProperties;
};

/**
 * Memoized hex button - only re-renders when its props change
 */
const HexButton = memo(function HexButton({
	letter,
	onClick,
	isCenter,
	disabled,
	style,
}: HexButtonProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			style={style}
			className={cn(
				// Mobile-first: min 58px for 44px+ touch target in hex shape
				"flex min-h-[58px] min-w-[58px] h-[58px] w-[58px] items-center justify-center sm:h-16 sm:w-16 md:h-[72px] md:w-[72px]",
				"text-xl font-bold uppercase transition-all sm:text-2xl md:text-3xl",
				"clip-hexagon",
				isCenter
					? "bg-amber-400 text-amber-950 hover:bg-amber-300 dark:bg-amber-500 dark:hover:bg-amber-400"
					: "bg-muted hover:bg-muted/80 dark:hover:bg-muted/60",
				disabled && "pointer-events-none opacity-50",
				"active:scale-95",
			)}
		>
			{letter}
		</button>
	);
});

// Hexagon positions for outer letters (arranged around center)
// Using a simplified 2-3-2 layout for 6 outer letters + 1 center
const POSITIONS = [
	{ x: 0, y: -1 }, // top
	{ x: 0.866, y: -0.5 }, // top-right
	{ x: 0.866, y: 0.5 }, // bottom-right
	{ x: 0, y: 1 }, // bottom
	{ x: -0.866, y: 0.5 }, // bottom-left
	{ x: -0.866, y: -0.5 }, // top-left
];

type HoneycombProps = {
	centerLetter: string;
	outerLetters: string[];
	onLetterClick: (letter: string) => void;
	disabled?: boolean;
};

/**
 * Hexagonal honeycomb letter grid for Spelling Bee
 * Center letter is highlighted, outer letters arranged around it
 */
export function Honeycomb({
	centerLetter,
	outerLetters,
	onLetterClick,
	disabled,
}: HoneycombProps) {
	// Memoize click handler to avoid creating new functions on each render
	const handleCenterClick = useCallback(
		() => onLetterClick(centerLetter),
		[onLetterClick, centerLetter],
	);

	return (
		<div className="relative mx-auto h-[260px] w-[260px] sm:h-[300px] sm:w-[300px] md:h-[320px] md:w-[320px]">
			{/* Center hexagon */}
			<HexButton
				letter={centerLetter}
				onClick={handleCenterClick}
				isCenter
				disabled={disabled}
				style={{
					position: "absolute",
					left: "50%",
					top: "50%",
					transform: "translate(-50%, -50%)",
				}}
			/>

			{/* Outer hexagons */}
			{outerLetters.map((letter, index) => {
				const pos = POSITIONS[index];
				const offsetX = pos.x * 65; // Adjust spacing for mobile
				const offsetY = pos.y * 65;

				return (
					<HexButton
						key={`${letter}-${index}`}
						letter={letter}
						onClick={() => onLetterClick(letter)}
						disabled={disabled}
						style={{
							position: "absolute",
							left: `calc(50% + ${offsetX}px)`,
							top: `calc(50% + ${offsetY}px)`,
							transform: "translate(-50%, -50%)",
						}}
					/>
				);
			})}
		</div>
	);
}
