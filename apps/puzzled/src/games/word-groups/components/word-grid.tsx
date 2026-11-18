'use client'

import { memo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { triggerHaptic, triggerSound } from '@/shared/hooks'

type WordTileProps = {
	word: string
	isSelected: boolean
	onToggle: () => void
	disabled?: boolean
	isShuffling?: boolean
	shuffleIndex?: number
}

/**
 * Memoized word tile component to prevent unnecessary re-renders
 * Only re-renders when its specific props change
 */
const WordTile = memo(function WordTile({
	word,
	isSelected,
	onToggle,
	disabled,
	isShuffling,
	shuffleIndex = 0,
}: WordTileProps) {
	const longest = Math.max(6, ...word.split(/\s+/).map((part) => part.length))
	const handleClick = useCallback(() => {
		// Trigger sound and haptic based on current state (before toggle)
		if (isSelected) {
			triggerSound('deselect')
		} else {
			triggerSound('select')
		}
		triggerHaptic('select')
		onToggle()
	}, [isSelected, onToggle])

	return (
		<button
			type="button"
			onClick={handleClick}
			disabled={disabled || isShuffling}
			aria-label={`${isSelected ? 'Deselect' : 'Select'} word: ${word}`}
			aria-pressed={isSelected}
			data-selected={isSelected ? 'true' : undefined}
			style={
				{
					// The tile type shrinks with the word, so a 10-12 letter word keeps
					// clear of the tile edge at every width (see .word-tile).
					'--word-len': longest,
					...(longest >= 9 ? { '--word-tracking': '-0.01em' } : {}),
					...(isShuffling ? { animationDelay: `${shuffleIndex * 20}ms` } : {}),
				} as React.CSSProperties
			}
			className={cn(
				'word-tile',
				disabled && 'cursor-not-allowed opacity-50',
				isShuffling && 'animate-shuffle-tile',
			)}
		>
			<span className="word-tile-label">{word}</span>
		</button>
	)
})

type WordGridProps = {
	words: string[]
	selectedWords: string[]
	onToggleWord: (word: string) => void
	disabled?: boolean
	isShuffling?: boolean
}

export function WordGrid({
	words,
	selectedWords,
	onToggleWord,
	disabled,
	isShuffling,
}: WordGridProps) {
	return (
		// Always 4 columns; the grid is a size container so tile type follows its width.
		<div className="word-grid grid w-full max-w-md grid-cols-4 px-0.5 sm:px-0">
			{words.map((word, index) => (
				<WordTile
					key={word}
					word={word}
					isSelected={selectedWords.includes(word)}
					onToggle={() => onToggleWord(word)}
					disabled={disabled}
					isShuffling={isShuffling}
					shuffleIndex={index}
				/>
			))}
		</div>
	)
}
