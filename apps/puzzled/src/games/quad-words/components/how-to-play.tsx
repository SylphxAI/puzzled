'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

/**
 * Quordle How-to-Play content
 * Self-contained component for game rules and examples
 */
export function QuordleHowToPlay() {
	const t = useTranslations('games.quadWords')

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

			{/* Visual example */}
			<div className="space-y-3">
				<p className="text-sm font-medium">Example</p>

				<div className="flex justify-center">
					{/* 2x2 mini boards */}
					<div className="grid grid-cols-2 gap-2">
						{[0, 1, 2, 3].map((i) => (
							<div key={i} className="rounded border p-1">
								<div className="grid grid-rows-3 gap-0.5">
									{[0, 1, 2].map((row) => (
										<div key={row} className="flex gap-0.5">
											{[0, 1, 2, 3, 4].map((col) => (
												<div
													key={col}
													className={cn(
														'h-4 w-4 rounded-sm',
														row === 0 && col < 3 && 'bg-correct',
														row === 0 && col >= 3 && 'bg-absent',
														row === 1 && col === 1 && 'bg-present',
														row === 1 && col !== 1 && 'bg-absent',
														row === 2 && 'bg-muted',
													)}
												/>
											))}
										</div>
									))}
								</div>
							</div>
						))}
					</div>
				</div>

				<p className="text-center text-xs text-muted-foreground">
					Each guess applies to all 4 boards
				</p>
			</div>

			{/* Tips */}
			<div className="space-y-2">
				<p className="text-sm font-medium">Tips</p>
				<ul className="space-y-1 text-xs text-muted-foreground">
					<li>• Focus on solving one board at a time</li>
					<li>• Use common letters to narrow down multiple boards</li>
					<li>• You have 9 guesses to solve all 4 words</li>
				</ul>
			</div>
		</div>
	)
}

function _QuordleHowToPlayTitle() {
	const t = useTranslations('games.quadWords')
	return <>{t('howToPlay')}</>
}
