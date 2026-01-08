'use client'

/**
 * Word Ladder Display Component
 * Shows the path from start to end word
 */

import { cn } from '@/lib/utils'

type WordLadderDisplayProps = {
	startWord: string
	endWord: string
	path: string[]
	minSteps: number
}

export function WordLadderDisplay({
	startWord: _startWord,
	endWord,
	path,
	minSteps,
}: WordLadderDisplayProps) {
	const currentSteps = path.length - 1 // First word doesn't count as a step

	return (
		<div className="flex w-full flex-col items-center gap-2 px-2 sm:px-0">
			{/* Progress indicator */}
			<div className="text-sm text-muted-foreground">
				{currentSteps} / {minSteps} steps (min)
			</div>

			{/* Ladder display */}
			<div className="flex w-full max-w-xs flex-col items-center gap-1">
				{/* Show the path from end to start (top to bottom) */}
				{path.map((word, index) => (
					<div key={index} className="w-full">
						<WordRung
							word={word}
							isStart={index === 0}
							isEnd={word.toLowerCase() === endWord.toLowerCase()}
							isLatest={index === path.length - 1 && word.toLowerCase() !== endWord.toLowerCase()}
							previousWord={index > 0 ? path[index - 1] : undefined}
						/>
						{/* Connector line */}
						{index < path.length - 1 && (
							<div className="flex justify-center">
								<div className="h-2 w-0.5 bg-border" />
							</div>
						)}
					</div>
				))}

				{/* Show target word if not reached yet */}
				{path[path.length - 1].toLowerCase() !== endWord.toLowerCase() && (
					<>
						{/* Dots to show remaining */}
						<div className="flex justify-center py-1">
							<div className="flex gap-1 text-muted-foreground">
								<span>•</span>
								<span>•</span>
								<span>•</span>
							</div>
						</div>

						<WordRung word={endWord} isEnd isTarget previousWord={undefined} />
					</>
				)}
			</div>
		</div>
	)
}

type WordRungProps = {
	word: string
	isStart?: boolean
	isEnd?: boolean
	isLatest?: boolean
	isTarget?: boolean
	previousWord?: string
}

function WordRung({
	word,
	isStart = false,
	isEnd = false,
	isLatest = false,
	isTarget = false,
	previousWord,
}: WordRungProps) {
	// Find which letter changed from previous word
	const changedIndex = previousWord
		? [...word.toLowerCase()].findIndex((letter, i) => letter !== previousWord.toLowerCase()[i])
		: -1

	return (
		<div
			className={cn(
				'flex w-full items-center justify-center gap-1 rounded-lg px-2 py-3 sm:px-4',
				isStart && 'bg-primary text-primary-foreground',
				isEnd && !isTarget && 'bg-correct text-white',
				isTarget && 'border-2 border-dashed border-muted-foreground bg-muted/50',
				isLatest && 'bg-present text-white',
				!isStart && !isEnd && !isLatest && !isTarget && 'bg-muted',
			)}
		>
			{word.split('').map((letter, i) => (
				<span
					key={i}
					className={cn(
						'inline-flex h-9 w-9 items-center justify-center rounded text-base font-bold uppercase sm:h-10 sm:w-10 sm:text-lg',
						changedIndex === i && !isStart && 'bg-black/20',
					)}
				>
					{isTarget ? '?' : letter}
				</span>
			))}
		</div>
	)
}
