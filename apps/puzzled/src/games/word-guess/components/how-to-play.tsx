'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

/**
 * Wordle How-to-Play content
 * Self-contained component for game rules and examples
 */
export function WordleHowToPlay() {
	const t = useTranslations('games.wordGuess')

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

			{/* Visual examples */}
			<div className="space-y-3">
				<p className="text-sm font-medium">Examples</p>

				{/* Correct example */}
				<div className="space-y-1.5">
					<div className="flex gap-1">
						<WordleTile letter="W" status="correct" />
						<WordleTile letter="O" status="absent" />
						<WordleTile letter="R" status="absent" />
						<WordleTile letter="D" status="absent" />
						<WordleTile letter="S" status="absent" />
					</div>
					<p className="text-xs text-muted-foreground">
						<span className="font-medium text-correct">W</span> - {t('rules.correct')}
					</p>
				</div>

				{/* Present example */}
				<div className="space-y-1.5">
					<div className="flex gap-1">
						<WordleTile letter="P" status="absent" />
						<WordleTile letter="I" status="present" />
						<WordleTile letter="L" status="absent" />
						<WordleTile letter="O" status="absent" />
						<WordleTile letter="T" status="absent" />
					</div>
					<p className="text-xs text-muted-foreground">
						<span className="font-medium text-present">I</span> - {t('rules.present')}
					</p>
				</div>

				{/* Absent example */}
				<div className="space-y-1.5">
					<div className="flex gap-1">
						<WordleTile letter="V" status="absent" />
						<WordleTile letter="A" status="absent" />
						<WordleTile letter="G" status="absent" />
						<WordleTile letter="U" status="absent" />
						<WordleTile letter="E" status="absent" />
					</div>
					<p className="text-xs text-muted-foreground">
						<span className="font-medium text-muted-foreground">V, A, G, U, E</span> -{' '}
						{t('rules.absent')}
					</p>
				</div>
			</div>
		</div>
	)
}

export function WordleHowToPlayTitle() {
	const t = useTranslations('games.wordGuess')
	return <>{t('howToPlay')}</>
}

type TileStatus = 'correct' | 'present' | 'absent'

function WordleTile({ letter, status }: { letter: string; status: TileStatus }) {
	return (
		<div
			className={cn(
				'flex h-10 w-10 items-center justify-center rounded text-sm font-bold text-white',
				status === 'correct' && 'bg-correct',
				status === 'present' && 'bg-present',
				status === 'absent' && 'bg-absent',
			)}
		>
			{letter}
		</div>
	)
}
