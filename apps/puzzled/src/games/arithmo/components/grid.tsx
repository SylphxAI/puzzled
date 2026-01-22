'use client'

/**
 * Arithmo Grid Component
 * Displays the equation guessing grid
 */

import { memo } from 'react'
import { cn } from '@/lib/utils'

import type { CharStatus } from '../types'
import { EQUATION_LENGTH, MAX_ATTEMPTS } from '../types'

type ArithmoGridProps = {
	guesses: string[]
	results: CharStatus[][]
	currentGuess: string
	currentRow: number
}

export function ArithmoGrid({ guesses, results, currentGuess, currentRow }: ArithmoGridProps) {
	// Build rows
	const rows: { chars: string[]; statuses: CharStatus[] }[] = []

	// Completed rows
	for (let i = 0; i < guesses.length; i++) {
		rows.push({
			chars: guesses[i].split(''),
			statuses: results[i],
		})
	}

	// Current row
	if (currentRow < MAX_ATTEMPTS) {
		const chars = currentGuess.padEnd(EQUATION_LENGTH, ' ').split('')
		rows.push({
			chars,
			statuses: Array(EQUATION_LENGTH).fill('empty'),
		})
	}

	// Empty rows
	for (let i = rows.length; i < MAX_ATTEMPTS; i++) {
		rows.push({
			chars: Array(EQUATION_LENGTH).fill(''),
			statuses: Array(EQUATION_LENGTH).fill('empty'),
		})
	}

	return (
		<div className="flex flex-col gap-1 sm:gap-1.5 w-full max-w-sm">
			{rows.map((row, rowIndex) => (
				<div key={rowIndex} className="flex justify-center gap-0.5 sm:gap-1">
					{row.chars.map((char, charIndex) => (
						<Cell
							key={charIndex}
							char={char}
							status={row.statuses[charIndex]}
							isCurrentRow={rowIndex === currentRow}
							hasChar={char !== '' && char !== ' '}
						/>
					))}
				</div>
			))}
		</div>
	)
}

type CellProps = {
	char: string
	status: CharStatus
	isCurrentRow: boolean
	hasChar: boolean
}

/**
 * Memoized cell component - only re-renders when its props change
 */
const Cell = memo(function Cell({ char, status, isCurrentRow, hasChar }: CellProps) {
	return (
		<div
			className={cn(
				'flex h-9 w-9 sm:h-11 sm:w-11 md:h-12 md:w-12 items-center justify-center rounded',
				'text-base sm:text-lg md:text-xl font-bold transition-all duration-200',
				'border-2',
				// Empty state
				status === 'empty' && !hasChar && 'border-muted bg-background',
				status === 'empty' && hasChar && 'border-muted-foreground bg-background',
				// Result states
				status === 'correct' && 'border-correct bg-correct text-white',
				status === 'present' && 'border-present bg-present text-white',
				status === 'absent' && 'border-absent bg-absent text-white',
				// Animation for current row input
				isCurrentRow && hasChar && status === 'empty' && 'animate-in zoom-in-75 duration-100',
			)}
		>
			{char !== ' ' && char}
		</div>
	)
})
