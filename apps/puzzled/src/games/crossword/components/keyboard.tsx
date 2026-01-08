/**
 * Crossword Keyboard Component
 * On-screen keyboard for letter input
 */

import { Delete } from 'lucide-react'
import { cn } from '@/lib/utils'

const KEYBOARD_ROWS = [
	['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
	['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
	['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
]

type CrosswordKeyboardProps = {
	onLetterPress: (letter: string) => void
	onDelete: () => void
	disabled?: boolean
}

export function CrosswordKeyboard({
	onLetterPress,
	onDelete,
	disabled = false,
}: CrosswordKeyboardProps) {
	return (
		<div className="flex w-full max-w-md flex-col items-center gap-1.5 px-2 sm:px-0">
			{KEYBOARD_ROWS.map((row, rowIndex) => (
				<div key={rowIndex} className="flex gap-1">
					{rowIndex === 2 && (
						<button
							type="button"
							onClick={onDelete}
							disabled={disabled}
							className={cn(
								'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md',
								'bg-muted text-muted-foreground transition-colors',
								'active:bg-muted/70',
								'disabled:opacity-50',
							)}
							aria-label="Delete"
						>
							<Delete className="h-5 w-5" />
						</button>
					)}
					{row.map((letter) => (
						<button
							key={letter}
							type="button"
							onClick={() => onLetterPress(letter)}
							disabled={disabled}
							className={cn(
								'flex min-h-[44px] min-w-[32px] items-center justify-center rounded-md',
								'bg-muted text-sm font-bold transition-colors',
								'active:bg-muted/70',
								'disabled:opacity-50',
								'sm:min-w-[36px] sm:text-base',
							)}
						>
							{letter}
						</button>
					))}
				</div>
			))}
		</div>
	)
}
