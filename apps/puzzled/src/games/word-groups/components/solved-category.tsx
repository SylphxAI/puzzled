'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { triggerHaptic, triggerSound } from '@/shared/hooks'
import type { Category } from '../types'
import { CATEGORY_COLORS } from '../types'

type SolvedCategoryProps = {
	category: Category
	animate?: boolean
}

export function SolvedCategory({ category, animate }: SolvedCategoryProps) {
	const colors = CATEGORY_COLORS[category.level]
	const soundPlayedRef = useRef(false)

	// Play sound once when a new category is revealed with animation
	useEffect(() => {
		if (animate && !soundPlayedRef.current) {
			soundPlayedRef.current = true
			triggerSound('categoryFound')
			triggerHaptic('success')
		}
	}, [animate])

	return (
		<div
			className={cn(
				'solved-band flex flex-col items-center justify-center gap-0.5 px-3 py-3 text-center transition-all duration-300 min-[400px]:py-3.5 sm:py-4',
				colors.bg,
				colors.text,
				animate && 'animate-bounce-once',
			)}
		>
			<span className="font-display text-[13px] font-bold uppercase tracking-wide min-[400px]:text-sm sm:text-[15px]">
				{category.name}
			</span>
			<span className="text-[11px] font-semibold opacity-85 [overflow-wrap:anywhere] min-[400px]:text-xs sm:text-[13px]">
				{category.words.join(', ')}
			</span>
		</div>
	)
}
