'use client'

import { useTranslations } from 'next-intl'

/**
 * Connections How-to-Play content
 * Self-contained component for game rules and examples
 */
export function ConnectionsHowToPlay() {
	const t = useTranslations('games.wordGroups')

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

			{/* Visual example - Category groups */}
			<div className="space-y-3">
				<p className="text-sm font-medium">Example Categories</p>

				{/* Example category */}
				<div className="space-y-2">
					<div className="rounded-lg bg-yellow-400 p-2 text-center text-xs font-medium text-yellow-900">
						FRUITS
					</div>
					<div className="grid grid-cols-4 gap-1">
						<CategoryWord word="APPLE" />
						<CategoryWord word="BANANA" />
						<CategoryWord word="CHERRY" />
						<CategoryWord word="DATE" />
					</div>
				</div>
			</div>

			{/* Difficulty legend */}
			<div className="space-y-2">
				<p className="text-sm font-medium">Difficulty Colors</p>
				<div className="grid grid-cols-2 gap-2 text-xs">
					<div className="flex items-center gap-2">
						<div className="h-4 w-4 rounded bg-yellow-400" />
						<span>{t('difficulty.0')}</span>
					</div>
					<div className="flex items-center gap-2">
						<div className="h-4 w-4 rounded bg-green-400" />
						<span>{t('difficulty.1')}</span>
					</div>
					<div className="flex items-center gap-2">
						<div className="h-4 w-4 rounded bg-blue-400" />
						<span>{t('difficulty.2')}</span>
					</div>
					<div className="flex items-center gap-2">
						<div className="h-4 w-4 rounded bg-purple-400" />
						<span>{t('difficulty.3')}</span>
					</div>
				</div>
			</div>
		</div>
	)
}

function _ConnectionsHowToPlayTitle() {
	const t = useTranslations('games.wordGroups')
	return <>{t('howToPlay')}</>
}

function CategoryWord({ word }: { word: string }) {
	return <div className="rounded bg-muted px-2 py-1.5 text-center text-xs font-medium">{word}</div>
}
