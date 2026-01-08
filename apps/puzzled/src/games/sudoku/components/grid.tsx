/**
 * Sudoku Grid Component
 * Nested 3x3 grids with gap-based borders (symmetric, no offset)
 */

'use client'

import { cn } from '@/lib/utils'
import type { SudokuCell } from '../types'
import { BOX_SIZE } from '../types'

type Props = {
	userGrid: SudokuCell[][]
	selectedCell: { row: number; col: number } | null
	conflictingCells: Set<string>
	onCellClick: (row: number, col: number) => void
}

export function SudokuGrid({ userGrid, selectedCell, conflictingCells, onCellClick }: Props) {
	const selectedValue = selectedCell ? userGrid[selectedCell.row]?.[selectedCell.col]?.value : null

	const renderCell = (row: number, col: number) => {
		const cell = userGrid[row]?.[col]
		if (!cell) return null

		const key = `${row},${col}`
		const isSelected = selectedCell?.row === row && selectedCell?.col === col
		const isHighlighted =
			selectedCell &&
			(selectedCell.row === row ||
				selectedCell.col === col ||
				(Math.floor(selectedCell.row / BOX_SIZE) === Math.floor(row / BOX_SIZE) &&
					Math.floor(selectedCell.col / BOX_SIZE) === Math.floor(col / BOX_SIZE)))
		const isSameValue = selectedValue !== null && cell.value === selectedValue
		const hasConflict = conflictingCells.has(key)

		let bgColor = '#ffffff'
		if (isSelected) bgColor = 'rgba(99, 102, 241, 0.3)'
		else if (isHighlighted) bgColor = '#f1f5f9'
		else if (isSameValue) bgColor = 'rgba(99, 102, 241, 0.1)'

		return (
			<button
				type="button"
				key={key}
				onClick={() => onCellClick(row, col)}
				style={{ backgroundColor: bgColor }}
				className={cn(
					'flex cursor-pointer items-center justify-center',
					'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
					cell.isGiven && 'font-bold text-slate-900',
					!cell.isGiven && cell.value && 'text-indigo-600',
					hasConflict && !cell.isGiven && 'text-red-500',
				)}
			>
				{cell.value ? (
					<span className="text-[11px] leading-none xs:text-sm sm:text-base">{cell.value}</span>
				) : cell.notes.size > 0 ? (
					<span className="grid h-full w-full grid-cols-3 grid-rows-3 p-px">
						{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
							<span
								key={n}
								className={cn(
									'flex items-center justify-center text-[6px] font-medium leading-none text-slate-500 xs:text-[7px] sm:text-[8px]',
									!cell.notes.has(n) && 'opacity-0',
								)}
							>
								{n}
							</span>
						))}
					</span>
				) : null}
			</button>
		)
	}

	const renderBox = (boxRow: number, boxCol: number) => (
		<div
			key={`box-${boxRow}-${boxCol}`}
			className="grid"
			style={{
				gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
				gridTemplateRows: 'repeat(3, minmax(0, 1fr))',
				gap: '1px',
				backgroundColor: '#cbd5e1', // slate-300 for thin cell borders
			}}
		>
			{[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => renderCell(boxRow * 3 + r, boxCol * 3 + c)))}
		</div>
	)

	return (
		<div className="w-full">
			<div className="relative mx-auto aspect-square w-full">
				{/* Outer 3x3 grid of boxes */}
				<div
					className="absolute inset-0 grid"
					style={{
						gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
						gridTemplateRows: 'repeat(3, minmax(0, 1fr))',
						gap: '2px',
						backgroundColor: '#1e293b', // slate-800 for thick box borders
						padding: '2px',
					}}
				>
					{[0, 1, 2].flatMap((br) => [0, 1, 2].map((bc) => renderBox(br, bc)))}
				</div>
			</div>
		</div>
	)
}
