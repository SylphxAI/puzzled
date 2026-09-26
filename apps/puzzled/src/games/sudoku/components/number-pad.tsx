/**
 * Sudoku Number Pad Component
 * Number input buttons for mobile
 */

'use client'

import { Button } from '@sylphx/ui'
import { Delete, PencilLine } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { memo, useCallback } from 'react'
import { cn } from '@/lib/utils'

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
				'h-13 w-full min-w-0 rounded-xl bg-key text-xl font-medium text-key-text tnum shadow-[inset_0_-1px_0_rgb(0_0_0/0.08)] transition-[transform,background-color] duration-fast [-webkit-tap-highlight-color:transparent]',
				'hover:bg-accent active:scale-95 disabled:pointer-events-none disabled:opacity-50',
				'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
				isNotesMode && 'text-base text-muted-foreground',
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
	const handleNumberPress = useCallback((value: number) => onNumberPress(value), [onNumberPress])

	const t = useTranslations('games.sudoku')

	return (
		<div className="w-full space-y-2">
			{/* 1-5 over 6-9 and erase: every key is at least 44px wide on a phone. */}
			<div className="grid w-full grid-cols-5 gap-1.5">
				{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
					<NumberButton
						key={num}
						num={num}
						isNotesMode={isNotesMode}
						disabled={disabled}
						onPress={handleNumberPress}
					/>
				))}
				<button
					type="button"
					disabled={disabled}
					onClick={onDelete}
					aria-label={t('clear')}
					className="flex h-13 w-full items-center justify-center rounded-xl bg-muted text-foreground transition-[transform,background-color] duration-fast hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 disabled:pointer-events-none disabled:opacity-50"
				>
					<Delete className="h-5 w-5" aria-hidden="true" />
				</button>
			</div>

			<Button
				variant={isNotesMode ? 'default' : 'secondary'}
				disabled={disabled}
				onClick={onToggleNotes}
				aria-pressed={isNotesMode}
				className="w-full gap-2"
			>
				<PencilLine className="h-4 w-4" aria-hidden="true" />
				{isNotesMode ? t('notesMode') : t('notes')}
			</Button>
		</div>
	)
}
