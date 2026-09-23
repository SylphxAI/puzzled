import { getTranslations } from 'next-intl/server'
import type { AchievementTier } from '@/features/gamification'
import { ProgressRing } from '@/shared/components/ui/progress-ring'
import { ConsoleCard } from './console-chrome'

export type Milestone = {
	id: string
	/** The measured metric this milestone counts. */
	metric: 'streak' | 'wins'
	tier: AchievementTier
	/** Value already reached, straight from the stats payload. */
	progress: number
	/** Value the milestone needs. */
	target: number
}

const TIER_CLASSES: Record<AchievementTier, string> = {
	bronze: 'bg-amber-700/10 text-amber-800 dark:text-amber-500',
	silver: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
	gold: 'bg-amber-500/15 text-amber-800 dark:text-amber-400',
	platinum: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
	diamond: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
}

type MilestoneRingsCardProps = {
	milestones: readonly Milestone[]
	/** True when the totals behind the rings did not load. */
	unavailable: boolean
}

/**
 * Progress toward the next milestones, drawn from the same numbers as the
 * totals row. A ring only appears for a metric the console actually read, so
 * a missing payload can never look like a locked achievement.
 */
export async function MilestoneRingsCard({ milestones, unavailable }: MilestoneRingsCardProps) {
	const t = await getTranslations('stats')
	const tTier = await getTranslations('stats.tier')

	return (
		<ConsoleCard
			title={t('milestones.title')}
			description={t('milestones.description')}
			bodyClassName="px-4 py-4 md:px-5"
		>
			{unavailable ? (
				<p className="text-sm text-muted-foreground">{t('milestones.unavailable')}</p>
			) : milestones.length === 0 ? (
				<p className="text-sm text-muted-foreground">{t('milestones.caughtUp')}</p>
			) : (
				<ul className="grid gap-4 sm:grid-cols-2">
					{milestones.map((milestone) => {
						const label = t(`milestones.metric.${milestone.metric}`)
						const tier = tTier(milestone.tier)
						return (
							<li
								key={milestone.id}
								className="flex items-center gap-4 rounded-2xl border border-border/70 bg-surface-muted/60 p-3"
							>
								<ProgressRing
									value={milestone.progress}
									max={milestone.target}
									size={64}
									strokeWidth={7}
									title={t('milestones.ringLabel', {
										label,
										progress: milestone.progress,
										target: milestone.target,
									})}
								/>
								<div className="min-w-0 flex-1">
									<p className="font-semibold">{label}</p>
									<p className="mt-0.5 text-sm text-muted-foreground tnum">
										{t('milestones.progress', {
											progress: milestone.progress,
											target: milestone.target,
										})}
									</p>
									<span className={`chip mt-1.5 ${TIER_CLASSES[milestone.tier]}`}>{tier}</span>
								</div>
							</li>
						)
					})}
				</ul>
			)}
		</ConsoleCard>
	)
}
