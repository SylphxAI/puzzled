'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

/**
 * Word Ladder How-to-Play content
 * Self-contained component for game rules and examples
 */
export function WordLadderHowToPlay() {
	const t = useTranslations('games.wordLadder')

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

				{/* COLD→CORD: L→R at index 2, CORD→WORD: C→W at index 0 */}
				{/* WORD→WORM: D→M at index 3, WORM→WARM: O→A at index 1 */}
				<div className="flex flex-col items-center gap-1">
					<LadderWord word="COLD" isStart />
					<LadderConnector />
					<LadderWord word="CORD" changedIndex={2} />
					<LadderConnector />
					<LadderWord word="WORD" changedIndex={0} />
					<LadderConnector />
					<LadderWord word="WORM" changedIndex={3} />
					<LadderConnector />
					<LadderWord word="WARM" isEnd changedIndex={1} />
				</div>

				<p className="text-center text-xs text-muted-foreground">
					Change one letter at a time to reach the target word
				</p>
			</div>
		</div>
	)
}

function WordLadderHowToPlayTitle() {
	const t = useTranslations('games.wordLadder')
	return <>{t('howToPlay')}</>
}

function LadderWord({
	word,
	isStart = false,
	isEnd = false,
	changedIndex,
}: {
	word: string
	isStart?: boolean
	isEnd?: boolean
	changedIndex?: number
}) {
	return (
		<div
			className={cn(
				'flex gap-0.5 rounded px-2 py-1',
				isStart && 'bg-primary text-primary-foreground',
				isEnd && 'bg-correct text-white',
				!isStart && !isEnd && 'bg-muted',
			)}
		>
			{word.split('').map((letter, i) => (
				<span
					key={i}
					className={cn(
						'flex h-6 w-6 items-center justify-center text-xs font-bold',
						changedIndex === i && 'rounded bg-black/20',
					)}
				>
					{letter}
				</span>
			))}
		</div>
	)
}

function LadderConnector() {
	return <div className="h-1 w-0.5 bg-border" />
}
