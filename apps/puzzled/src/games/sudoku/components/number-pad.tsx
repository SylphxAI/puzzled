/**
 * Sudoku Number Pad Component
 * Number input buttons for mobile
 */

'use client'

import { Button } from '@sylphx/ui'
import { Delete, PencilLine, Undo2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { memo, useCallback } from 'react'
import styles from './sudoku-craft.module.css'

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
			className={styles.key}
			data-notes={isNotesMode || undefined}
		>
			{num}
		</button>
	)
})

type Props = {
	onNumberPress: (value: number) => void
	onDelete: () => void
	onUndo: () => void
	canUndo: boolean
	onToggleNotes: () => void
	isNotesMode: boolean
	disabled?: boolean
}

export function SudokuNumberPad({
	onNumberPress,
	onDelete,
	onUndo,
	canUndo,
	onToggleNotes,
	isNotesMode,
	disabled = false,
}: Props) {
	// Memoize stable handler
	const handleNumberPress = useCallback((value: number) => onNumberPress(value), [onNumberPress])

	const t = useTranslations('games.sudoku')

	return (
		<div className={styles.pad}>
			{/* 1-5 over 6-9 and erase: every key is at least 48px wide on a phone. */}
			<div className={styles.digits}>
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
					className={`${styles.key} ${styles.erase}`}
				>
					<Delete className="h-5 w-5" aria-hidden="true" />
				</button>
			</div>

			<div className={styles.tools}>
				<Button
					variant="secondary"
					disabled={disabled || !canUndo}
					onClick={onUndo}
					className={`${styles.key} ${styles.tool}`}
				>
					<Undo2 className="h-4 w-4" aria-hidden="true" />
					{t('undo')}
				</Button>
				<Button
					variant={isNotesMode ? 'default' : 'secondary'}
					disabled={disabled}
					onClick={onToggleNotes}
					aria-pressed={isNotesMode}
					className={`${styles.key} ${styles.tool}`}
				>
					<PencilLine className="h-4 w-4" aria-hidden="true" />
					{isNotesMode ? t('notesMode') : t('notes')}
				</Button>
			</div>
		</div>
	)
}
