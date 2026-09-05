'use client'

import { useTranslations } from 'next-intl'

/**
 * Path How-to-Play content
 */
export function NumberPathHowToPlay() {
	const t = useTranslations('games.numberPath')

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<ul className="space-y-1.5 text-sm text-muted-foreground">
					<li>• {t('rules.rule1')}</li>
					<li>• {t('rules.rule2')}</li>
					<li>• {t('rules.rule3')}</li>
				</ul>
			</div>

			<div className="space-y-3">
				<p className="text-sm font-medium">Example</p>
				<div className="flex justify-center">
					<div className="grid grid-cols-3 gap-0 overflow-hidden rounded border">
						{[
							{ row: 0, col: 0, label: '1' },
							{ row: 0, col: 1, label: '' },
							{ row: 0, col: 2, label: '3' },
							{ row: 1, col: 0, label: '' },
							{ row: 1, col: 1, label: '2' },
							{ row: 1, col: 2, label: '' },
							{ row: 2, col: 0, label: '' },
							{ row: 2, col: 1, label: '' },
							{ row: 2, col: 2, label: '9' },
						].map((cell) => (
							<div
								key={`ex-${cell.row}-${cell.col}`}
								className="flex h-8 w-8 items-center justify-center border border-border text-sm font-semibold"
							>
								{cell.label}
							</div>
						))}
					</div>
				</div>
				<p className="text-center text-xs text-muted-foreground">
					Connect 1 to the last number through every cell
				</p>
			</div>

			<div className="space-y-2">
				<p className="text-sm font-medium">Controls</p>
				<ul className="space-y-1 text-xs text-muted-foreground">
					<li>• Click or drag from 1 to draw the path</li>
					<li>• Click a cell already on the path to backtrack</li>
					<li>• Undo removes the last step; Reset clears the path</li>
				</ul>
			</div>
		</div>
	)
}
