'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

/**
 * Sudoku How-to-Play content
 * Self-contained component for game rules and examples
 */
export function SudokuHowToPlay() {
	const t = useTranslations('games.sudoku')

	return (
		<div className="space-y-4">
			{/* Basic rules */}
			<div className="space-y-2">
				<ul className="space-y-1.5 text-sm text-muted-foreground">
					<li>• {t('rules.rule1')}</li>
					<li>• {t('rules.rule2')}</li>
					<li>• {t('rules.rule3')}</li>
				</ul>
			</div>

			{/* Visual example - Mini grid */}
			<div className="space-y-3">
				<p className="text-sm font-medium">Example</p>

				<div className="mx-auto grid w-fit grid-cols-3 gap-0.5 rounded border-2 border-foreground/50 bg-border p-0.5">
					<SudokuCell value={5} isGiven />
					<SudokuCell value={3} isGiven />
					<SudokuCell value={null} />
					<SudokuCell value={6} isGiven />
					<SudokuCell value={null} />
					<SudokuCell value={null} />
					<SudokuCell value={null} />
					<SudokuCell value={9} isGiven />
					<SudokuCell value={8} isGiven />
				</div>

				<p className="text-center text-xs text-muted-foreground">
					Fill empty cells so each row, column, and 3×3 box contains 1-9
				</p>
			</div>

			{/* Tips */}
			<div className="space-y-2">
				<p className="text-sm font-medium">Tips</p>
				<ul className="space-y-1 text-xs text-muted-foreground">
					<li>• Use notes to track possible numbers</li>
					<li>• Press N to toggle notes mode</li>
					<li>• Look for cells with only one possibility</li>
				</ul>
			</div>
		</div>
	)
}

export function SudokuHowToPlayTitle() {
	const t = useTranslations('games.sudoku')
	return <>{t('howToPlay')}</>
}

function SudokuCell({ value, isGiven = false }: { value: number | null; isGiven?: boolean }) {
	return (
		<div
			className={cn(
				'flex h-8 w-8 items-center justify-center bg-background text-sm',
				isGiven ? 'font-bold' : 'text-primary',
			)}
		>
			{value}
		</div>
	)
}
