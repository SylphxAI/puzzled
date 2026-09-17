'use client'

import { useTranslations } from 'next-intl'
import { useCallback, useRef, useTransition } from 'react'
import { usePathname, useRouter } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'
import { LEADERBOARD_PERIODS, type LeaderboardPeriod } from '../lib/leaderboard-period'

export type LeaderboardModuleOption = {
	slug: string
	/** Localized module name. */
	name: string
}

type LeaderboardControlsProps = {
	period: LeaderboardPeriod
	moduleSlug: string
	modules: readonly LeaderboardModuleOption[]
	/** Id of the tab panel these controls drive. */
	panelId: string
}

/**
 * Scope tabs and module picker for the board.
 *
 * The URL is the single source of truth: both controls navigate, so a board is
 * always shareable and the server always renders the board the URL names.
 * Tabs follow the ARIA tabs pattern with manual activation (arrow keys move
 * focus, Enter or Space switches), and the pending state is announced.
 */
export function LeaderboardControls({
	period,
	moduleSlug,
	modules,
	panelId,
}: LeaderboardControlsProps) {
	const t = useTranslations('leaderboard')
	const router = useRouter()
	const pathname = usePathname()
	const [isPending, startTransition] = useTransition()
	const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

	const navigate = useCallback(
		(next: { period?: LeaderboardPeriod; module?: string }) => {
			const params = new URLSearchParams()
			params.set('period', next.period ?? period)
			params.set('module', next.module ?? moduleSlug)
			startTransition(() => {
				router.replace(`${pathname}?${params.toString()}`, { scroll: false })
			})
		},
		[moduleSlug, pathname, period, router],
	)

	const focusTab = useCallback((index: number) => {
		const target =
			LEADERBOARD_PERIODS[(index + LEADERBOARD_PERIODS.length) % LEADERBOARD_PERIODS.length]
		tabRefs.current[target]?.focus()
	}, [])

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
			switch (event.key) {
				case 'ArrowRight':
					event.preventDefault()
					focusTab(index + 1)
					break
				case 'ArrowLeft':
					event.preventDefault()
					focusTab(index - 1)
					break
				case 'Home':
					event.preventDefault()
					focusTab(0)
					break
				case 'End':
					event.preventDefault()
					focusTab(LEADERBOARD_PERIODS.length - 1)
					break
				default:
					break
			}
		},
		[focusTab],
	)

	return (
		<div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
			<div
				role="tablist"
				aria-label={t('scopeLabel')}
				className="flex w-full gap-1 rounded-2xl border border-border/70 bg-surface-muted/60 p-1 lg:w-auto"
			>
				{LEADERBOARD_PERIODS.map((value, index) => {
					const selected = value === period
					return (
						<button
							key={value}
							ref={(node) => {
								tabRefs.current[value] = node
							}}
							type="button"
							role="tab"
							id={`board-tab-${value}`}
							aria-selected={selected}
							aria-controls={panelId}
							tabIndex={selected ? 0 : -1}
							onClick={() => navigate({ period: value })}
							onKeyDown={(event) => handleKeyDown(event, index)}
							className={cn(
								'min-h-11 flex-1 rounded-xl px-4 text-sm font-semibold transition-colors lg:flex-none',
								'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
								selected
									? 'bg-background text-foreground shadow-sm'
									: 'text-muted-foreground hover:bg-muted hover:text-foreground',
							)}
						>
							{t(`period.${value}`)}
						</button>
					)
				})}
			</div>

			<div className="w-full lg:w-72">
				<label
					htmlFor="board-module"
					className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
				>
					{t('moduleLabel')}
				</label>
				<select
					id="board-module"
					value={moduleSlug}
					onChange={(event) => navigate({ module: event.target.value })}
					className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					{modules.map((module) => (
						<option key={module.slug} value={module.slug}>
							{module.name}
						</option>
					))}
				</select>
			</div>

			<output aria-live="polite" className="sr-only">
				{isPending ? t('loadingBoard') : ''}
			</output>
		</div>
	)
}
