/**
 * Crossword Grid Component
 * 5x5 grid with selectable cells
 */

import { cn } from '@/lib/utils'
import type { CrosswordPuzzleClientData } from '../config'
import { GRID_SIZE, getClueNumbers } from '../types'

type CrosswordGridProps = {
	puzzleData: CrosswordPuzzleClientData
	userGrid: (string | null)[][]
	selectedCell: { row: number; col: number } | null
	highlightedCells: Set<string>
	solvedClues: { across: number[]; down: number[] }
	onCellClick: (row: number, col: number) => void
}

export function CrosswordGrid({
	puzzleData,
	userGrid,
	selectedCell,
	highlightedCells,
	solvedClues: _solvedClues,
	onCellClick,
}: CrosswordGridProps) {
	const clueNumbers = getClueNumbers(puzzleData.grid)

	return (
		<div className="relative aspect-square w-full max-w-[320px] px-2 sm:max-w-[360px] sm:px-0">
			<div className="grid grid-cols-5 gap-0.5 rounded-lg border-2 border-border bg-border p-0.5">
				{Array.from({ length: GRID_SIZE }).map((_, row) =>
					Array.from({ length: GRID_SIZE }).map((_, col) => {
						const isBlack = puzzleData.grid[row][col] === null
						const isSelected = selectedCell?.row === row && selectedCell?.col === col
						const isHighlighted = highlightedCells.has(`${row},${col}`)
						const cellNumber = clueNumbers.get(`${row},${col}`)
						const userLetter = userGrid[row]?.[col] ?? ''

						if (isBlack) {
							return <div key={`${row}-${col}`} className="aspect-square bg-foreground" />
						}

						return (
							<button
								key={`${row}-${col}`}
								type="button"
								onClick={() => onCellClick(row, col)}
								className={cn(
									'relative flex aspect-square items-center justify-center',
									'bg-background text-foreground transition-colors',
									'text-base font-bold sm:text-lg md:text-xl',
									'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset',
									'min-h-[44px] min-w-[44px]',
									isSelected && 'bg-primary text-primary-foreground',
									isHighlighted && !isSelected && 'bg-primary/20',
								)}
							>
								{cellNumber && (
									<span className="absolute left-0.5 top-0 text-[8px] font-normal text-muted-foreground sm:text-[9px] md:text-[10px]">
										{cellNumber}
									</span>
								)}
								{userLetter}
							</button>
						)
					}),
				)}
			</div>
		</div>
	)
}
