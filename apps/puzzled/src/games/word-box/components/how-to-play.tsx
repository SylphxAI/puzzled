'use client'

import { useTranslations } from 'next-intl'

/**
 * Letter Boxed How-to-Play content
 * Self-contained component for game rules and examples
 */
export function LetterBoxedHowToPlay() {
	const t = useTranslations('games.wordBox')

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
			{/* Letters: Top=API, Right=KDN, Bottom=SLC, Left=OER */}
			{/* Valid words: SOAK = S(bottom)→O(left)→A(top)→K(right) ✅ */}
			{/* KALE = K(right)→A(top)→L(bottom)→E(left) ✅ */}
			<div className="space-y-3">
				<p className="text-sm font-medium">Example</p>

				<div className="flex justify-center">
					<div className="relative h-32 w-32">
						{/* Box outline */}
						<div className="absolute inset-4 rounded-lg border-2 border-primary" />

						{/* Top letters: A P I */}
						<div className="absolute left-1/2 top-0 flex -translate-x-1/2 gap-2">
							<div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
								A
							</div>
							<div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold">
								P
							</div>
							<div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold">
								I
							</div>
						</div>

						{/* Right letters: K D N */}
						<div className="absolute right-0 top-1/2 flex -translate-y-1/2 flex-col gap-2">
							<div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
								K
							</div>
							<div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold">
								D
							</div>
							<div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold">
								N
							</div>
						</div>

						{/* Bottom letters: S L C */}
						<div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 gap-2">
							<div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
								S
							</div>
							<div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
								L
							</div>
							<div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold">
								C
							</div>
						</div>

						{/* Left letters: O E R */}
						<div className="absolute left-0 top-1/2 flex -translate-y-1/2 flex-col gap-2">
							<div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
								O
							</div>
							<div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
								E
							</div>
							<div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold">
								R
							</div>
						</div>
					</div>
				</div>

				<p className="text-center text-xs text-muted-foreground">
					Connect letters from different sides to form words
				</p>
			</div>

			{/* Example word chain - verified valid */}
			{/* SOAK: S(bottom)→O(left)→A(top)→K(right) ✅ */}
			{/* KALE: K(right)→A(top)→L(bottom)→E(left) ✅ */}
			<div className="space-y-2">
				<p className="text-sm font-medium">Word Chain</p>
				<div className="flex flex-wrap justify-center gap-2">
					<span className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
						SOAK
					</span>
					<span className="text-xs text-muted-foreground">→</span>
					<span className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
						KALE
					</span>
				</div>
				<p className="text-center text-xs text-muted-foreground">
					Each letter must come from a different side than the previous
				</p>
			</div>

			{/* Controls */}
			<div className="space-y-2">
				<p className="text-sm font-medium">Controls</p>
				<ul className="space-y-1 text-xs text-muted-foreground">
					<li>• Click letters or type to form words</li>
					<li>• Press Enter to submit a word</li>
					<li>• Use all 12 letters to win</li>
				</ul>
			</div>
		</div>
	)
}

function LetterBoxedHowToPlayTitle() {
	const t = useTranslations('games.wordBox')
	return <>{t('howToPlay')}</>
}
