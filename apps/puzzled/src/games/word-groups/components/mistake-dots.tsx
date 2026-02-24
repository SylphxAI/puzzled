'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { MAX_MISTAKES } from '../types'

type MistakeDotsProps = {
	mistakes: number
}

export function MistakeDots({ mistakes }: MistakeDotsProps) {
	const t = useTranslations('games.wordGroups')
	const remaining = MAX_MISTAKES - mistakes
	const prevMistakesRef = useRef(mistakes)

	// Track if a mistake was just made for animation
	const justMadeMistake = mistakes > prevMistakesRef.current
	useEffect(() => {
		prevMistakesRef.current = mistakes
	}, [mistakes])

	// Accessibility: describe remaining attempts
	const ariaLabel = t('mistakesRemaining', { remaining, total: MAX_MISTAKES })

	return (
		<output
			className="flex items-center justify-center gap-2"
			aria-label={ariaLabel}
			aria-live="polite"
		>
			<span className="text-xs text-muted-foreground" aria-hidden="true">
				{t('mistakes')}:
			</span>
			<div className="flex gap-1.5" aria-hidden="true">
				{Array.from({ length: MAX_MISTAKES }).map((_, i) => {
					const isRemaining = i < remaining
					const isJustLost = justMadeMistake && i === remaining
					return (
						<div
							key={i}
							className={cn(
								'h-2.5 w-2.5 rounded-full transition-all duration-300',
								isRemaining ? 'bg-foreground/70' : 'bg-muted',
								isJustLost && 'animate-pulse bg-red-500',
							)}
						/>
					)
				})}
			</div>
		</output>
	)
}
