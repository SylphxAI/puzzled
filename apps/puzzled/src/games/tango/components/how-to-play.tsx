'use client'

import { useTranslations } from 'next-intl'

/**
 * Tango How-to-Play content
 * Self-contained component for game rules and examples
 */
export function TangoHowToPlay() {
	const t = useTranslations('games.tango')

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
					{/* 4x4 example grid */}
					<div className="grid grid-cols-4 gap-1">
						<div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-lg">
							☀️
						</div>
						<div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-lg">
							🌙
						</div>
						<div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-lg">
							☀️
						</div>
						<div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-lg">
							🌙
						</div>
						<div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-lg">
							🌙
						</div>
						<div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-lg">
							☀️
						</div>
						<div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-lg">
							🌙
						</div>
						<div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-lg">
							☀️
						</div>
						<div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-lg">
							☀️
						</div>
						<div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-lg">
							🌙
						</div>
						<div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-lg">
							🌙
						</div>
						<div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-lg">
							☀️
						</div>
						<div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-lg">
							🌙
						</div>
						<div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-lg">
							☀️
						</div>
						<div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-lg">
							☀️
						</div>
						<div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-lg">
							🌙
						</div>
					</div>
				</div>

				<p className="text-center text-xs text-muted-foreground">
					Each row and column has 2 ☀️ and 2 🌙
				</p>
			</div>

			{/* Controls */}
			<div className="space-y-2">
				<p className="text-sm font-medium">Controls</p>
				<ul className="space-y-1 text-xs text-muted-foreground">
					<li>• Click/tap to cycle: empty → ☀️ → 🌙 → empty</li>
					<li>• Red highlight shows rule violations</li>
				</ul>
			</div>
		</div>
	)
}

function _TangoHowToPlayTitle() {
	const t = useTranslations('games.tango')
	return <>{t('howToPlay')}</>
}
