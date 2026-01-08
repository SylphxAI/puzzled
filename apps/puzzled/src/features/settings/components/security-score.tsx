'use client'

import { cn } from '@/lib/utils'

/**
 * Security Score Ring visualization
 *
 * A circular progress ring showing security score from 0-100.
 * Used in settings-overview and security checkup components.
 */
export function SecurityScoreRing({
	score,
	size = 'md',
}: {
	score: number
	size?: 'sm' | 'md' | 'lg'
}) {
	const sizes = {
		sm: { ring: 64, stroke: 6, text: 'text-lg' },
		md: { ring: 96, stroke: 8, text: 'text-2xl' },
		lg: { ring: 128, stroke: 10, text: 'text-4xl' },
	}

	const { ring, stroke, text } = sizes[size]
	const radius = (ring - stroke) / 2
	const circumference = radius * 2 * Math.PI
	const offset = circumference - (score / 100) * circumference

	const getColor = (score: number) => {
		if (score === 100) return 'stroke-green-500'
		if (score >= 75) return 'stroke-blue-500'
		if (score >= 50) return 'stroke-amber-500'
		return 'stroke-red-500'
	}

	return (
		<div className="relative" style={{ width: ring, height: ring }}>
			<svg className="rotate-[-90deg]" width={ring} height={ring} aria-hidden="true">
				{/* Background circle */}
				<circle
					className="stroke-muted"
					fill="none"
					strokeWidth={stroke}
					r={radius}
					cx={ring / 2}
					cy={ring / 2}
				/>
				{/* Progress circle */}
				<circle
					className={cn('transition-all duration-700 ease-out', getColor(score))}
					fill="none"
					strokeWidth={stroke}
					strokeLinecap="round"
					strokeDasharray={circumference}
					strokeDashoffset={offset}
					r={radius}
					cx={ring / 2}
					cy={ring / 2}
				/>
			</svg>
			{/* Score text */}
			<div className="absolute inset-0 flex flex-col items-center justify-center">
				<span className={cn('font-bold tabular-nums', text)}>{score}</span>
				{size === 'lg' && <span className="text-xs text-muted-foreground">/100</span>}
			</div>
		</div>
	)
}
