/**
 * Sudoku Grid Component
 * Nested 3x3 grids with gap-based borders (symmetric, no offset)
 */

'use client'

import { memo, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { SudokuCell } from '../types'
import { BOX_SIZE } from '../types'

type CellProps = {
	cell: SudokuCell
	row: number
	col: number
	isSelected: boolean
	isHighlighted: boolean
	isSameValue: boolean
	hasConflict: boolean
	onClick: (row: number, col: number) => void
}

/**
 * Memoized cell component - only re-renders when its specific props change
 */
const SudokuCell = memo(function SudokuCell({
	cell,
	row,
	col,
	isSelected,
	isHighlighted,
	isSameValue,
	hasConflict,
	onClick,
}: CellProps) {
	const handleClick = useCallback(() => onClick(row, col), [onClick, row, col])

	const bgColor = useMemo(() => {
		if (isSelected) return 'rgba(99, 102, 241, 0.3)'
		if (isHighlighted) return '#f1f5f9'
		if (isSameValue) return 'rgba(99, 102, 241, 0.1)'
		return '#ffffff'
	}, [isSelected, isHighlighted, isSameValue])

	return (
		<button
			type="button"
			onClick={handleClick}
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
})

type Props = {
	userGrid: SudokuCell[][]
	selectedCell: { row: number; col: number } | null
	conflictingCells: Set<string>
	onCellClick: (row: number, col: number) => void
}

export function SudokuGrid({ userGrid, selectedCell, conflictingCells, onCellClick }: Props) {
	const selectedValue = selectedCell ? userGrid[selectedCell.row]?.[selectedCell.col]?.value : null

	// Pre-compute cell states to pass to memoized components
	const getCellState = useCallback(
		(row: number, col: number) => {
			const isSelected = selectedCell?.row === row && selectedCell?.col === col
			const isHighlighted =
				selectedCell !== null &&
				(selectedCell.row === row ||
					selectedCell.col === col ||
					(Math.floor(selectedCell.row / BOX_SIZE) === Math.floor(row / BOX_SIZE) &&
						Math.floor(selectedCell.col / BOX_SIZE) === Math.floor(col / BOX_SIZE)))
			const cell = userGrid[row]?.[col]
			const isSameValue = selectedValue !== null && cell?.value === selectedValue
			const hasConflict = conflictingCells.has(`${row},${col}`)

			return { isSelected, isHighlighted, isSameValue, hasConflict }
		},
		[selectedCell, selectedValue, userGrid, conflictingCells],
	)

	// Memoize stable onClick handler
	const handleCellClick = useCallback(
		(row: number, col: number) => onCellClick(row, col),
		[onCellClick],
	)

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
			{[0, 1, 2].flatMap((r) =>
				[0, 1, 2].map((c) => {
					const row = boxRow * 3 + r
					const col = boxCol * 3 + c
					const cell = userGrid[row]?.[col]
					if (!cell) return null

					const state = getCellState(row, col)
					return (
						<SudokuCell
							key={`${row},${col}`}
							cell={cell}
							row={row}
							col={col}
							isSelected={state.isSelected}
							isHighlighted={state.isHighlighted}
							isSameValue={state.isSameValue}
							hasConflict={state.hasConflict}
							onClick={handleCellClick}
						/>
					)
				}),
			)}
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
