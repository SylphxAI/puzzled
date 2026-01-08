'use client'

import { cn } from '@/lib/utils'

/**
 * Word Search How-to-Play content
 * Self-contained component for game rules and examples
 */
export function WordSearchHowToPlay() {
	return (
		<div className="space-y-4">
			{/* Basic rules */}
			<div className="space-y-2">
				<ul className="space-y-1.5 text-sm text-muted-foreground">
					<li>• Find all hidden words in the letter grid</li>
					<li>• Words can be horizontal, vertical, or diagonal</li>
					<li>• Drag from first to last letter to select a word</li>
				</ul>
			</div>

			{/* Visual example */}
			<div className="space-y-3">
				<p className="text-sm font-medium">Example</p>

				<div className="mx-auto grid w-fit grid-cols-5 gap-0.5 rounded border bg-muted/30 p-2">
					{['C', 'A', 'T', 'X', 'Y'].map((letter, i) => (
						<GridCell key={`row0-${letter}-${i}`} letter={letter} highlighted={i < 3} />
					))}
					{['M', 'O', 'U', 'S', 'E'].map((letter, i) => (
						<GridCell key={`row1-${letter}-${i}`} letter={letter} />
					))}
					{['D', 'O', 'G', 'Z', 'Q'].map((letter, i) => (
						<GridCell key={`row2-${letter}-${i}`} letter={letter} />
					))}
				</div>

				<p className="text-center text-xs text-muted-foreground">Found: CAT, MOUSE, DOG</p>
			</div>

			{/* Tips */}
			<div className="space-y-2">
				<p className="text-sm font-medium">Tips</p>
				<ul className="space-y-1 text-xs text-muted-foreground">
					<li>• All words relate to the theme shown</li>
					<li>• Words can go forwards or backwards</li>
					<li>• Look for less common letters first</li>
				</ul>
			</div>
		</div>
	)
}

export function WordSearchHowToPlayTitle() {
	return <>How to Play Word Hunt</>
}

function GridCell({ letter, highlighted = false }: { letter: string; highlighted?: boolean }) {
	return (
		<div
			className={cn(
				'flex h-7 w-7 items-center justify-center rounded text-sm font-bold',
				highlighted ? 'bg-cyan-500/30 text-cyan-600' : 'bg-background text-foreground',
			)}
		>
			{letter}
		</div>
	)
}
