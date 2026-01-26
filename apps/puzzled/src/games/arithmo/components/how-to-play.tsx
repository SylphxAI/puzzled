'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

/**
 * Arithmo How-to-Play content
 * Self-contained component for game rules and examples
 */
export function ArithmoHowToPlay() {
	const t = useTranslations('games.arithmo')

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

				<div className="flex flex-col items-center gap-1">
					{/* Example row */}
					<div className="flex gap-1">
						<ArithmoCell char="1" status="correct" />
						<ArithmoCell char="2" status="correct" />
						<ArithmoCell char="+" status="present" />
						<ArithmoCell char="3" status="absent" />
						<ArithmoCell char="4" status="correct" />
						<ArithmoCell char="=" status="correct" />
						<ArithmoCell char="4" status="present" />
						<ArithmoCell char="6" status="absent" />
					</div>
				</div>

				<div className="space-y-1 text-xs text-muted-foreground">
					<p>
						<span className="mr-1 inline-block h-4 w-4 rounded bg-correct" /> Correct position
					</p>
					<p>
						<span className="mr-1 inline-block h-4 w-4 rounded bg-present" /> In equation, wrong
						position
					</p>
					<p>
						<span className="mr-1 inline-block h-4 w-4 rounded bg-absent" /> Not in equation
					</p>
				</div>
			</div>

			{/* Valid characters */}
			<div className="space-y-2">
				<p className="text-sm font-medium">Available</p>
				<div className="flex flex-wrap gap-1 text-xs">
					<span className="rounded bg-muted px-2 py-1 font-mono">0-9</span>
					<span className="rounded bg-muted px-2 py-1 font-mono">+</span>
					<span className="rounded bg-muted px-2 py-1 font-mono">-</span>
					<span className="rounded bg-muted px-2 py-1 font-mono">*</span>
					<span className="rounded bg-muted px-2 py-1 font-mono">/</span>
					<span className="rounded bg-muted px-2 py-1 font-mono">=</span>
				</div>
			</div>
		</div>
	)
}

function ArithmoHowToPlayTitle() {
	const t = useTranslations('games.arithmo')
	return <>{t('howToPlay')}</>
}

function ArithmoCell({ char, status }: { char: string; status: 'correct' | 'present' | 'absent' }) {
	return (
		<div
			className={cn(
				'flex h-8 w-8 items-center justify-center rounded text-sm font-bold text-white',
				status === 'correct' && 'bg-correct',
				status === 'present' && 'bg-present',
				status === 'absent' && 'bg-absent',
			)}
		>
			{char}
		</div>
	)
}
