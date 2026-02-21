"use client";

import type { Card } from "../types";
import { PatternCard } from "./card";

type BoardProps = {
	cards: Card[];
	selectedIds: number[];
	foundSets: [number, number, number][];
	onCardClick: (id: number) => void;
};

export function PatternBoard({
	cards,
	selectedIds,
	foundSets,
	onCardClick,
}: BoardProps) {
	// Get IDs of all cards that are in found sets
	const foundCardIds = new Set(foundSets.flat());

	return (
		<div className="grid grid-cols-3 gap-1.5 sm:gap-2 md:gap-3">
			{cards.map((card) => (
				<PatternCard
					key={card.id}
					card={card}
					isSelected={selectedIds.includes(card.id)}
					isFound={foundCardIds.has(card.id)}
					onClick={() => onCardClick(card.id)}
				/>
			))}
		</div>
	);
}
