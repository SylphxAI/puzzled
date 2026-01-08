'use client'

import { Calendar } from 'lucide-react'
import { useLocale } from 'next-intl'
import { getPuzzleDateString } from '@/features/daily/lib'

type DailyPuzzleHeaderProps = {
	gameName: string
	showDate?: boolean
}

export function DailyPuzzleHeader({ gameName, showDate = true }: DailyPuzzleHeaderProps) {
	const locale = useLocale()
	const dateString = getPuzzleDateString(new Date(), locale)

	return (
		<div className="flex flex-col items-center gap-1 text-center">
			{/* Game Name */}
			<div className="text-sm font-medium text-muted-foreground">{gameName}</div>

			{/* Date */}
			{showDate && (
				<div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
					<Calendar className="h-3 w-3" />
					<span>{dateString}</span>
				</div>
			)}
		</div>
	)
}
