'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

/**
 * Pattern Match How-to-Play content
 * Self-contained component for game rules and examples
 */
export function PatternMatchHowToPlay() {
	const t = useTranslations('games.patternMatch')

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
				<p className="text-sm font-medium">Example Set</p>

				<div className="flex items-center justify-center gap-2">
					{/* 3 example cards showing a valid set */}
					<PatternExampleCard shape="diamond" color="red" fill="solid" count={1} />
					<PatternExampleCard shape="diamond" color="green" fill="striped" count={2} />
					<PatternExampleCard shape="diamond" color="purple" fill="empty" count={3} />
				</div>

				<p className="text-center text-xs text-muted-foreground">
					Same shape, all different colors, all different fills, all different counts
				</p>
			</div>

			{/* Properties */}
			<div className="space-y-2">
				<p className="text-sm font-medium">Properties</p>
				<ul className="space-y-1 text-xs text-muted-foreground">
					<li>
						• <strong>Shape:</strong> Diamond, Oval, Squiggle
					</li>
					<li>
						• <strong>Color:</strong> Red, Green, Purple
					</li>
					<li>
						• <strong>Fill:</strong> Solid, Striped, Empty
					</li>
					<li>
						• <strong>Count:</strong> 1, 2, or 3 shapes
					</li>
				</ul>
			</div>
		</div>
	)
}

function _PatternMatchHowToPlayTitle() {
	const t = useTranslations('games.patternMatch')
	return <>{t('howToPlay')}</>
}

function PatternExampleCard({
	shape,
	color,
	fill,
	count,
}: {
	shape: 'diamond' | 'oval' | 'squiggle'
	color: 'red' | 'green' | 'purple'
	fill: 'solid' | 'striped' | 'empty'
	count: number
}) {
	const colorClass = {
		red: 'text-red-500 stroke-red-500',
		green: 'text-emerald-500 stroke-emerald-500',
		purple: 'text-violet-500 stroke-violet-500',
	}[color]

	const fillClass = {
		solid: 'fill-current',
		striped: 'fill-none stroke-[2]',
		empty: 'fill-none stroke-[1.5]',
	}[fill]

	return (
		<div className="flex h-16 w-12 items-center justify-center rounded-lg border bg-card p-1">
			<div className="flex flex-col items-center gap-0.5">
				{Array.from({ length: count }).map((_, i) => (
					<svg key={i} viewBox="0 0 24 18" className={cn('h-4 w-5', colorClass)} aria-hidden="true">
						{shape === 'diamond' && (
							<polygon
								points="12,2 22,9 12,16 2,9"
								className={fillClass}
								strokeDasharray={fill === 'striped' ? '2,2' : undefined}
							/>
						)}
						{shape === 'oval' && (
							<ellipse
								cx="12"
								cy="9"
								rx="9"
								ry="6"
								className={fillClass}
								strokeDasharray={fill === 'striped' ? '2,2' : undefined}
							/>
						)}
						{shape === 'squiggle' && (
							<path
								d="M 4 6 Q 2 9, 6 12 Q 10 15, 14 12 Q 18 9, 20 12 Q 22 15, 20 9 Q 18 6, 14 6 Q 10 3, 6 6 Q 2 3, 4 6 Z"
								className={fillClass}
								strokeDasharray={fill === 'striped' ? '2,2' : undefined}
							/>
						)}
					</svg>
				))}
			</div>
		</div>
	)
}
