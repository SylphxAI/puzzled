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
			style={isShuffling ? { animationDelay: `${shuffleIndex * 20}ms` } : undefined}
			className={cn(
				// Playful roundness (14-16px) with brand-tinted shadows - Puzzled signature look
				// Mobile-first: min 44px touch target, better text scaling
				'flex min-h-[44px] aspect-[5/4] items-center justify-center rounded-xl px-2 text-xs font-semibold uppercase tracking-tight min-[400px]:aspect-[4/3] min-[400px]:text-sm sm:rounded-2xl sm:text-base',
				'transition-all duration-150 shadow-[var(--shadow-tile)]',
				isSelected
					? 'bg-foreground text-background shadow-[var(--shadow-tile-hover)] scale-[0.97]'
					: 'bg-muted/60 text-foreground hover:bg-muted hover:shadow-[var(--shadow-tile-hover)] active:scale-[0.95] active:animate-tile-press',
				disabled && 'cursor-not-allowed opacity-50',
				isShuffling && 'animate-shuffle-tile',
			)}
		>
			{word}
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
		// Always 4 columns - tiles scale down on small screens for compact layout
		<div className="grid w-full max-w-md grid-cols-4 gap-2 px-2 min-[400px]:gap-2.5 sm:gap-3 sm:px-0">
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
