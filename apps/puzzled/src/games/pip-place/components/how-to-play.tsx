'use client'

import { useTranslations } from 'next-intl'

/**
 * Spots How-to-Play content
 */
export function PipPlaceHowToPlay() {
	const t = useTranslations('games.pipPlace')

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
							{ row: 0, col: 0, bg: 'bg-orange-200/70', badge: null },
							{ row: 0, col: 1, bg: 'bg-orange-200/70', badge: null },
							{ row: 0, col: 2, bg: 'bg-sky-200/70', badge: '0' },
							{ row: 1, col: 0, bg: 'bg-orange-200/70', badge: null },
							{ row: 1, col: 1, bg: 'bg-orange-200/70', badge: null },
							{ row: 1, col: 2, bg: 'bg-orange-200/70', badge: null },
						].map((cell) => (
							<div
								key={`ex-${cell.row}-${cell.col}`}
								className={`relative flex h-8 w-8 items-center justify-center border border-border ${cell.bg}`}
							>
								{cell.badge !== null && (
									<span className="absolute left-0.5 top-0.5 rounded bg-background/80 px-0.5 text-[9px] font-bold">
										{cell.badge}
									</span>
								)}
							</div>
						))}
					</div>
				</div>
				<p className="text-center text-xs text-muted-foreground">
					Cover the board; the 0 cell must show zero spots
				</p>
			</div>

			<div className="space-y-2">
				<p className="text-sm font-medium">Controls</p>
				<ul className="space-y-1 text-xs text-muted-foreground">
					<li>• Select a tile, then click two cells that share a side</li>
					<li>• Click the selected tile again to swap its ends</li>
					<li>• Click a placed tile to pick it up; Undo and Reset sit in the toolbar</li>
				</ul>
			</div>
		</div>
	)
}
