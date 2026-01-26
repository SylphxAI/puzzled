'use client'

import { useTranslations } from 'next-intl'

/**
 * Queens How-to-Play content
 * Self-contained component for game rules and examples
 */
export function QueensHowToPlay() {
	const t = useTranslations('games.queens')

	return (
		<div className="space-y-4">
			{/* Basic rules */}
			<div className="space-y-2">
				<ul className="space-y-1.5 text-sm text-muted-foreground">
					<li>• {t('rules.rule1')}</li>
					<li>• {t('rules.rule2')}</li>
					<li>• {t('rules.rule3')}</li>
					<li>• {t('rules.rule4')}</li>
				</ul>
			</div>

			{/* Visual example */}
			<div className="space-y-3">
				<p className="text-sm font-medium">Example</p>

				<div className="flex justify-center">
					{/* Mini 4x4 board example - Valid solution: (0,1), (1,3), (2,0), (3,2) */}
					{/* Queens are not adjacent (including diagonally) */}
					<div className="grid grid-cols-4 gap-0.5">
						{/* Row 0: Red, Blue(Q), Green, Green */}
						<div className="h-8 w-8 rounded bg-red-400/70" />
						<div className="flex h-8 w-8 items-center justify-center rounded bg-blue-400/70">
							👑
						</div>
						<div className="h-8 w-8 rounded bg-green-400/70" />
						<div className="h-8 w-8 rounded bg-green-400/70" />
						{/* Row 1: Red, Blue, Blue, Green(Q) */}
						<div className="h-8 w-8 rounded bg-red-400/70" />
						<div className="h-8 w-8 rounded bg-blue-400/70" />
						<div className="h-8 w-8 rounded bg-blue-400/70" />
						<div className="flex h-8 w-8 items-center justify-center rounded bg-green-400/70">
							👑
						</div>
						{/* Row 2: Red(Q), Yellow, Yellow, Green */}
						<div className="flex h-8 w-8 items-center justify-center rounded bg-red-400/70">👑</div>
						<div className="h-8 w-8 rounded bg-yellow-400/70" />
						<div className="h-8 w-8 rounded bg-yellow-400/70" />
						<div className="h-8 w-8 rounded bg-green-400/70" />
						{/* Row 3: Red, Yellow, Yellow(Q), Green */}
						<div className="h-8 w-8 rounded bg-red-400/70" />
						<div className="h-8 w-8 rounded bg-yellow-400/70" />
						<div className="flex h-8 w-8 items-center justify-center rounded bg-yellow-400/70">
							👑
						</div>
						<div className="h-8 w-8 rounded bg-green-400/70" />
					</div>
				</div>

				<p className="text-center text-xs text-muted-foreground">
					Each row, column, and color region has exactly one 👑
					<br />
					<span className="text-[10px]">Queens cannot touch (including diagonally)</span>
				</p>
			</div>

			{/* Controls */}
			<div className="space-y-2">
				<p className="text-sm font-medium">Controls</p>
				<ul className="space-y-1 text-xs text-muted-foreground">
					<li>• Click/tap a cell to place or remove a queen</li>
					<li>• Use arrow keys to navigate, Space/Enter to toggle</li>
					<li>• Red highlight shows conflicts</li>
				</ul>
			</div>
		</div>
	)
}

function QueensHowToPlayTitle() {
	const t = useTranslations('games.queens')
	return <>{t('howToPlay')}</>
}
