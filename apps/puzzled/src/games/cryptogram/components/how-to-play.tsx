'use client'

import { cn } from '@/lib/utils'

/**
 * Cryptogram How-to-Play content
 * Self-contained component for game rules and examples
 */
export function CryptogramHowToPlay() {
	return (
		<div className="space-y-4">
			{/* Basic rules */}
			<div className="space-y-2">
				<ul className="space-y-1.5 text-sm text-muted-foreground">
					<li>• Each letter in the quote has been replaced with a different letter</li>
					<li>• Figure out the substitution pattern to reveal the original quote</li>
					<li>• The same letter always maps to the same replacement</li>
				</ul>
			</div>

			{/* Visual example */}
			<div className="space-y-3">
				<p className="text-sm font-medium">Example</p>

				<div className="space-y-2 rounded-lg border bg-muted/30 p-3">
					<div className="flex items-center gap-2">
						<span className="text-xs font-medium text-muted-foreground">Encrypted:</span>
						<div className="flex gap-0.5 font-mono text-sm">
							<CryptoLetter encrypted="K" guess="H" correct />
							<CryptoLetter encrypted="V" guess="E" correct />
							<CryptoLetter encrypted="O" guess="L" correct />
							<CryptoLetter encrypted="O" guess="L" correct />
							<CryptoLetter encrypted="L" guess="O" correct />
						</div>
					</div>
					<div className="flex items-center gap-2">
						<span className="text-xs font-medium text-muted-foreground">Solution:</span>
						<span className="font-mono text-sm font-bold text-primary">HELLO</span>
					</div>
				</div>

				<p className="text-center text-xs text-muted-foreground">
					K→H, V→E, O→L throughout the puzzle
				</p>
			</div>

			{/* Tips */}
			<div className="space-y-2">
				<p className="text-sm font-medium">Tips</p>
				<ul className="space-y-1 text-xs text-muted-foreground">
					<li>• Start with common short words like "THE", "AND", "A"</li>
					<li>• Look for patterns - double letters, apostrophes</li>
					<li>• Single-letter words are usually "A" or "I"</li>
					<li>• The author name is shown as a hint</li>
				</ul>
			</div>
		</div>
	)
}

function CryptogramHowToPlayTitle() {
	return <>How to Play Cryptogram</>
}

function CryptoLetter({
	encrypted,
	guess,
	correct,
}: {
	encrypted: string
	guess?: string
	correct?: boolean
}) {
	return (
		<div className="flex flex-col items-center">
			<div
				className={cn(
					'flex h-7 w-6 items-center justify-center rounded border text-xs font-bold',
					guess
						? correct
							? 'border-green-500 bg-green-500/20 text-green-600'
							: 'border-red-500 bg-red-500/20 text-red-600'
						: 'border-muted-foreground/30 bg-background',
				)}
			>
				{guess || '?'}
			</div>
			<span className="mt-0.5 text-[10px] text-muted-foreground">{encrypted}</span>
		</div>
	)
}
