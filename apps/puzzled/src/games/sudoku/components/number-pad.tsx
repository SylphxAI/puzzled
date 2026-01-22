/**
 * Sudoku Number Pad Component
 * Number input buttons for mobile
 */

'use client'

import { memo, useCallback } from 'react'
import { Delete, PencilLine } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@sylphx/ui'

type NumberButtonProps = {
	num: number
	isNotesMode: boolean
	disabled: boolean
	onPress: (value: number) => void
}

/**
 * Memoized number button - only re-renders when its props change
 */
const NumberButton = memo(function NumberButton({
	num,
	isNotesMode,
	disabled,
	onPress,
}: NumberButtonProps) {
	const handleClick = useCallback(() => onPress(num), [onPress, num])

	return (
		<button
			type="button"
			disabled={disabled}
			onClick={handleClick}
			className={cn(
				'aspect-square w-full min-w-0 rounded-lg border-2 bg-background text-xs font-semibold transition-all',
				'hover:bg-muted active:scale-95 disabled:pointer-events-none disabled:opacity-50',
				'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
				'xs:text-sm sm:text-base',
				isNotesMode ? 'border-primary/50 text-primary' : 'border-border',
			)}
		>
			{num}
		</button>
	)
})

type Props = {
	onNumberPress: (value: number) => void
	onDelete: () => void
	onToggleNotes: () => void
	isNotesMode: boolean
	disabled?: boolean
}

export function SudokuNumberPad({
	onNumberPress,
	onDelete,
	onToggleNotes,
	isNotesMode,
	disabled = false,
}: Props) {
	// Memoize stable handler
	const handleNumberPress = useCallback(
		(value: number) => onNumberPress(value),
		[onNumberPress],
	)

	return (
		<div className="w-full space-y-2">
			{/* Numbers 1-9 */}
			<div
				className="grid w-full gap-1"
				style={{ gridTemplateColumns: 'repeat(9, minmax(0, 1fr))' }}
			>
				{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
					<NumberButton
						key={num}
						num={num}
						isNotesMode={isNotesMode}
						disabled={disabled}
						onPress={handleNumberPress}
					/>
				))}
			</div>

			{/* Action buttons */}
			<div className="flex gap-2">
				<Button
					variant={isNotesMode ? 'default' : 'outline'}
					size="sm"
					disabled={disabled}
					onClick={onToggleNotes}
					className="flex-1 gap-2 min-h-[44px]"
				>
					<PencilLine className="h-4 w-4" />
					<span className="text-sm">Notes</span>
				</Button>
				<Button
					variant="outline"
					size="sm"
					disabled={disabled}
					onClick={onDelete}
					className="flex-1 gap-2 min-h-[44px]"
				>
					<Delete className="h-4 w-4" />
					<span className="text-sm">Clear</span>
				</Button>
			</div>
		</div>
	)
}
