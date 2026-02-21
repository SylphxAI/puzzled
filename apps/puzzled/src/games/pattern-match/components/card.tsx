"use client";

import { cn } from "@/lib/utils";
import type { Card as CardType, Color, Fill, Shape } from "../types";

type CardProps = {
	card: CardType;
	isSelected: boolean;
	isFound: boolean;
	onClick: () => void;
};

// Color mappings
const COLOR_CLASSES: Record<Color, string> = {
	red: "text-red-500 stroke-red-500",
	green: "text-emerald-500 stroke-emerald-500",
	purple: "text-violet-500 stroke-violet-500",
};

const FILL_PATTERNS: Record<Fill, string> = {
	solid: "fill-current",
	striped: "fill-none stroke-[3]",
	empty: "fill-none stroke-[2]",
};

// SVG shapes
function DiamondShape({ fill, color }: { fill: Fill; color: Color }) {
	return (
		<svg
			viewBox="0 0 40 60"
			className={cn("h-8 w-5 sm:h-10 sm:w-6", COLOR_CLASSES[color])}
			aria-hidden="true"
		>
			<polygon
				points="20,5 35,30 20,55 5,30"
				className={cn(FILL_PATTERNS[fill])}
				strokeDasharray={fill === "striped" ? "3,3" : undefined}
			/>
		</svg>
	);
}

function OvalShape({ fill, color }: { fill: Fill; color: Color }) {
	return (
		<svg
			viewBox="0 0 40 60"
			className={cn("h-8 w-5 sm:h-10 sm:w-6", COLOR_CLASSES[color])}
			aria-hidden="true"
		>
			<ellipse
				cx="20"
				cy="30"
				rx="15"
				ry="24"
				className={cn(FILL_PATTERNS[fill])}
				strokeDasharray={fill === "striped" ? "3,3" : undefined}
			/>
		</svg>
	);
}

function SquiggleShape({ fill, color }: { fill: Fill; color: Color }) {
	return (
		<svg
			viewBox="0 0 40 60"
			className={cn("h-8 w-5 sm:h-10 sm:w-6", COLOR_CLASSES[color])}
			aria-hidden="true"
		>
			<path
				d="M 10 10 Q 5 20, 15 30 Q 25 40, 15 50 Q 10 55, 20 55 Q 35 55, 30 45 Q 25 35, 30 25 Q 35 15, 25 10 Q 15 5, 10 10 Z"
				className={cn(FILL_PATTERNS[fill])}
				strokeDasharray={fill === "striped" ? "3,3" : undefined}
			/>
		</svg>
	);
}

function ShapeComponent({
	shape,
	fill,
	color,
}: { shape: Shape; fill: Fill; color: Color }) {
	switch (shape) {
		case "diamond":
			return <DiamondShape fill={fill} color={color} />;
		case "oval":
			return <OvalShape fill={fill} color={color} />;
		case "squiggle":
			return <SquiggleShape fill={fill} color={color} />;
	}
}

export function PatternCard({ card, isSelected, isFound, onClick }: CardProps) {
	const shapes = Array.from({ length: card.count }, (_, i) => i);

	return (
		<button
			type="button"
			onClick={onClick}
			disabled={isFound}
			className={cn(
				"flex aspect-[3/4] w-full min-h-[80px] sm:min-h-[100px] items-center justify-center gap-0.5 sm:gap-1 rounded-lg sm:rounded-xl border-2 bg-card p-1.5 sm:p-2 transition-all",
				isSelected && "border-primary ring-2 ring-primary/30",
				isFound && "border-correct/50 bg-correct/10 opacity-60",
				!isSelected &&
					!isFound &&
					"border-border hover:border-muted-foreground/50",
				isFound && "cursor-default",
			)}
			aria-pressed={isSelected}
			aria-disabled={isFound}
		>
			<div className="flex items-center justify-center gap-0.5 sm:gap-1">
				{shapes.map((i) => (
					<ShapeComponent
						key={i}
						shape={card.shape}
						fill={card.fill}
						color={card.color}
					/>
				))}
			</div>
		</button>
	);
}
