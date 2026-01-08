/**
 * Crossword Clue List Component
 * Shows across and down clues with highlighting
 */

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { CrosswordClue, CrosswordDirection } from '../types'

type ClueListProps = {
	clues: {
		across: CrosswordClue[]
		down: CrosswordClue[]
	}
	currentClue: CrosswordClue | null
	direction: CrosswordDirection
	solvedClues: { across: number[]; down: number[] }
	onClueClick: (clue: CrosswordClue, direction: CrosswordDirection) => void
}

export function ClueList({
	clues,
	currentClue,
	direction,
	solvedClues,
	onClueClick,
}: ClueListProps) {
	const t = useTranslations('games.crossword')

	return (
		<div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
			{/* Across clues */}
			<div className="flex-1">
				<h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
					{t('across')}
				</h3>
				<ul className="space-y-1">
					{clues.across.map((clue) => (
						<ClueItem
							key={`across-${clue.number}`}
							clue={clue}
							isActive={currentClue?.number === clue.number && direction === 'across'}
							isSolved={solvedClues.across.includes(clue.number)}
							onClick={() => onClueClick(clue, 'across')}
						/>
					))}
				</ul>
			</div>

			{/* Down clues */}
			<div className="flex-1">
				<h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
					{t('down')}
				</h3>
				<ul className="space-y-1">
					{clues.down.map((clue) => (
						<ClueItem
							key={`down-${clue.number}`}
							clue={clue}
							isActive={currentClue?.number === clue.number && direction === 'down'}
							isSolved={solvedClues.down.includes(clue.number)}
							onClick={() => onClueClick(clue, 'down')}
						/>
					))}
				</ul>
			</div>
		</div>
	)
}

type ClueItemProps = {
	clue: CrosswordClue
	isActive: boolean
	isSolved: boolean
	onClick: () => void
}

function ClueItem({ clue, isActive, isSolved, onClick }: ClueItemProps) {
	return (
		<li>
			<button
				type="button"
				onClick={onClick}
				className={cn(
					'w-full rounded px-2 py-1 text-left text-sm transition-colors',
					'hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary',
					isActive && 'bg-primary/20 font-medium',
					isSolved && 'text-muted-foreground line-through',
				)}
			>
				<span className="mr-1.5 font-semibold">{clue.number}.</span>
				{clue.clue}
			</button>
		</li>
	)
}

/**
 * Current Clue Display
 * Shows the active clue prominently above the grid
 */
type CurrentClueDisplayProps = {
	clue: CrosswordClue | null
	direction: CrosswordDirection
}

export function CurrentClueDisplay({ clue, direction }: CurrentClueDisplayProps) {
	const t = useTranslations('games.crossword')

	if (!clue) {
		return (
			<div className="rounded-lg bg-muted p-3 text-center text-sm text-muted-foreground">
				{t('selectCell')}
			</div>
		)
	}

	return (
		<div className="rounded-lg bg-primary/10 p-3">
			<div className="flex items-center gap-2">
				<span className="rounded bg-primary px-1.5 py-0.5 text-xs font-bold text-primary-foreground">
					{clue.number} {direction === 'across' ? t('across') : t('down')}
				</span>
				<span className="text-sm font-medium">{clue.clue}</span>
			</div>
		</div>
	)
}
