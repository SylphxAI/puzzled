/**
 * Sudoku Grid Component
 * Nested 3x3 grids with gap-based borders (symmetric, no offset)
 */

'use client'

import { useTranslations } from 'next-intl'
import { memo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { SudokuCell as SudokuCellData } from '../types'
import { BOX_SIZE } from '../types'

type CellProps = {
	cell: SudokuCellData
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
	const t = useTranslations('common')
	const handleClick = useCallback(() => onClick(row, col), [onClick, row, col])

	// Selection is amber, its row, column and box are muted, and matching
	// digits get a light amber wash: the same cues in light and dark.
	const background = isSelected
		? 'bg-accent-warm/70'
		: isSameValue
			? 'bg-accent-warm/25'
			: isHighlighted
				? 'bg-muted'
				: 'bg-card'

	return (
		<button
			type="button"
			onClick={handleClick}
			/*
			 * Cells only paint a glyph, so without a name an empty cell reaches
			 * assistive tech as an unlabelled button (WCAG 4.1.2). The name gives
			 * the position, then the digit the player placed or was given.
			 */
			aria-label={[
				t('cellRow', { index: row + 1 }),
				t('cellColumn', { index: col + 1 }),
				cell.value ? String(cell.value) : null,
			]
				.filter(Boolean)
				.join(', ')}
			className={cn(
				'flex cursor-pointer items-center justify-center transition-colors duration-fast [-webkit-tap-highlight-color:transparent]',
				'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
				background,
				cell.isGiven && 'font-semibold text-foreground',
				!cell.isGiven && cell.value && 'font-medium text-info',
				hasConflict && !cell.isGiven && 'text-destructive',
				isSelected && 'text-[#1a1712]',
			)}
		>
			{cell.value ? (
				<span className="text-lg leading-none tnum sm:text-xl">{cell.value}</span>
			) : cell.notes.size > 0 ? (
				<span className="grid h-full w-full grid-cols-3 grid-rows-3 p-px">
					{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
						<span
							key={n}
							className={cn(
								'flex items-center justify-center text-[8px] font-medium leading-none text-muted-foreground sm:text-[9px]',
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
	userGrid: SudokuCellData[][]
	selectedCell: { row: number; col: number } | null
	conflictingCells: Set<string>
	onCellClick: (row: number, col: number) => void
}

export function SudokuGrid({ userGrid, selectedCell, conflictingCells, onCellClick }: Props) {
	const t = useTranslations('games.sudoku')
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
				backgroundColor: 'var(--color-border)', // thin cell rules
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
				{/* biome-ignore lint/a11y/useSemanticElements: a sudoku board is a named group of controls, not a form fieldset */}
				<div
					className="absolute inset-0 grid"
					role="group"
					aria-label={t('name')}
					style={{
						gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
						gridTemplateRows: 'repeat(3, minmax(0, 1fr))',
						gap: '2px',
						backgroundColor: 'var(--color-foreground)', // box rules in ink
						padding: '2px',
						borderRadius: '10px',
						overflow: 'hidden',
					}}
				>
					{[0, 1, 2].flatMap((br) => [0, 1, 2].map((bc) => renderBox(br, bc)))}
				</div>
			</div>
		</div>
	)
}
