import { Target, Trophy } from 'lucide-react'
import {
	type ResultCardModel,
	type ResultCardStrings,
	resultCardChips,
} from '@/features/daily/lib/result-card'
import { cn } from '@/lib/utils'

type ResultCardSummaryProps = {
	model: ResultCardModel
	strings: ResultCardStrings
	/** Who the result belongs to ("Their result"), when it sits beside another. */
	heading?: string
	/** One chip per row, for a narrow column beside another result. */
	stacked?: boolean
	className?: string
}

/**
 * One non-spoiler result as text: the status and the card's own chips
 * (attempts, score, time band). The share landing and the side-by-side result
 * both draw it, so a result reads the same wherever it appears.
 */
export function ResultCardSummary({
	model,
	strings,
	heading,
	stacked,
	className,
}: ResultCardSummaryProps) {
	const won = model.status === 'won'
	const chips = resultCardChips(model, strings)
	return (
		<section
			className={cn('rounded-2xl border border-border bg-card p-4 shadow-card', className)}
			aria-label={heading ?? model.gameName}
		>
			{heading && <p className="text-xs font-medium text-muted-foreground">{heading}</p>}
			<p
				className={cn(
					'mt-1 flex items-center gap-2 font-display text-xl leading-tight',
					won ? 'text-foreground' : 'text-muted-foreground',
				)}
			>
				<span
					className={cn(
						'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
						won ? 'bg-accent-warm text-[#1a1712]' : 'bg-muted text-muted-foreground',
					)}
					aria-hidden="true"
				>
					{won ? <Trophy className="h-4 w-4" /> : <Target className="h-4 w-4" />}
				</span>
				{won ? strings.statusWon : strings.statusLost}
			</p>
			{chips.length > 0 && (
				<dl className={cn('mt-3 grid gap-x-3 gap-y-2', !stacked && 'grid-cols-2')}>
					{chips.map((chip) => (
						<div key={chip.label}>
							<dt className="text-xs text-muted-foreground">{chip.label}</dt>
							<dd className="text-[15px] font-semibold tnum">{chip.value}</dd>
						</div>
					))}
				</dl>
			)}
		</section>
	)
}
