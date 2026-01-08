export const dynamic = 'force-dynamic'

import { ExternalLink, FlaskConical, TrendingUp } from 'lucide-react'
import { getLocale, getTranslations } from 'next-intl/server'
import { EXPERIMENTS } from '@/features/analytics/lib/ab-testing'

type ExperimentVariant = {
	name: string
	exposures: number
	conversions: number
	conversionRate: number
}

type ExperimentResult = {
	key: string
	status: string
	exposures: number
	variants: ExperimentVariant[]
}

/**
 * Fetch experiment results from PostHog API
 * Returns empty array if PostHog is not configured or no experiments exist
 */
async function getExperimentResults(): Promise<ExperimentResult[]> {
	const posthogProjectId = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_ID
	const posthogApiKey = process.env.POSTHOG_PERSONAL_API_KEY

	// Return empty if PostHog is not configured
	if (!posthogProjectId || !posthogApiKey) {
		return []
	}

	try {
		const response = await fetch(
			`https://app.posthog.com/api/projects/${posthogProjectId}/experiments/`,
			{
				headers: {
					Authorization: `Bearer ${posthogApiKey}`,
				},
				next: { revalidate: 60 }, // Cache for 1 minute
			},
		)

		if (!response.ok) {
			console.error('[Experiments] Failed to fetch from PostHog:', response.status)
			return []
		}

		const data = await response.json()

		// Transform PostHog experiment format to our display format
		// Note: Full results require fetching experiment results endpoint separately
		return (data.results || []).map(
			(exp: {
				feature_flag_key: string
				start_date: string | null
				parameters: { feature_flag_variants: Array<{ key: string; rollout_percentage: number }> }
			}) => ({
				key: exp.feature_flag_key,
				status: exp.start_date ? 'active' : 'draft',
				exposures: 0, // Would need separate API call for results
				variants: (exp.parameters?.feature_flag_variants || []).map(
					(v: { key: string; rollout_percentage: number }) => ({
						name: v.key,
						exposures: 0,
						conversions: 0,
						conversionRate: 0,
					}),
				),
			}),
		)
	} catch (error) {
		console.error('[Experiments] Error fetching experiments:', error)
		return []
	}
}

export default async function ExperimentsPage() {
	const locale = await getLocale()
	const t = await getTranslations('admin.experiments')
	const experiments = await getExperimentResults()

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="admin-page-header">
					<h1 className="admin-page-title">{t('title')}</h1>
					<p className="admin-page-subtitle">{t('subtitle')}</p>
				</div>
				<a
					href={`https://app.posthog.com/project/${process.env.NEXT_PUBLIC_POSTHOG_PROJECT_ID || ''}/experiments`}
					target="_blank"
					rel="noopener noreferrer"
					className="admin-btn admin-btn-ghost"
				>
					{t('viewInPostHog')}
					<ExternalLink className="h-4 w-4" />
				</a>
			</div>

			{/* Empty State */}
			{experiments.length === 0 && (
				<div className="admin-card">
					<div className="flex flex-col items-center justify-center p-12 text-center">
						<div className="mb-4 rounded-full bg-purple-500/10 p-4">
							<FlaskConical className="h-8 w-8 text-purple-400" />
						</div>
						<h3 className="text-lg font-semibold text-[var(--admin-text-primary)]">
							{t('emptyState.title')}
						</h3>
						<p className="mt-2 max-w-md text-sm text-[var(--admin-text-secondary)]">
							{t('emptyState.description')}
						</p>
						<a
							href="https://posthog.com/docs/experiments"
							target="_blank"
							rel="noopener noreferrer"
							className="admin-btn admin-btn-primary mt-6"
						>
							{t('emptyState.createFirst')}
							<ExternalLink className="h-4 w-4" />
						</a>
					</div>
				</div>
			)}

			{/* Experiments List */}
			{experiments.length > 0 && (
				<div className="space-y-6">
					{experiments.map((experiment, index) => {
						const definition = EXPERIMENTS[experiment.key as keyof typeof EXPERIMENTS]
						const winner = [...experiment.variants].sort(
							(a, b) => b.conversionRate - a.conversionRate,
						)[0]

						return (
							<div
								key={experiment.key}
								className="admin-card admin-animate-in"
								style={{ animationDelay: `${index * 0.05}s` }}
							>
								<div className="p-6">
									{/* Experiment Header */}
									<div className="mb-6 flex items-start justify-between">
										<div className="flex items-start gap-3">
											<div className="mt-1 rounded-lg bg-purple-500/10 p-2">
												<FlaskConical className="h-5 w-5 text-purple-400" />
											</div>
											<div>
												<h3 className="font-semibold text-[var(--admin-text-primary)]">
													{experiment.key}
												</h3>
												{definition && (
													<p className="mt-1 text-sm text-[var(--admin-text-secondary)]">
														{definition.description}
													</p>
												)}
												<div className="mt-2 flex items-center gap-4 text-sm text-[var(--admin-text-muted)]">
													<span className="inline-flex items-center gap-1">
														<span
															className={`h-2 w-2 rounded-full ${
																experiment.status === 'active'
																	? 'bg-[var(--admin-success)]'
																	: 'bg-[var(--admin-text-muted)]'
															}`}
														/>
														{experiment.status}
													</span>
													<span>
														{experiment.exposures.toLocaleString(locale)} {t('totalExposures')}
													</span>
												</div>
											</div>
										</div>
									</div>

									{/* Variants Table */}
									<div className="overflow-hidden rounded-lg border border-[var(--admin-border)]">
										<table className="admin-table">
											<thead>
												<tr>
													<th>{t('variant')}</th>
													<th className="text-right">{t('exposures')}</th>
													<th className="text-right">{t('conversions')}</th>
													<th className="text-right">{t('conversionRate')}</th>
													<th className="text-right">{t('performance')}</th>
												</tr>
											</thead>
											<tbody>
												{experiment.variants.map((variant) => {
													const isWinner = variant.name === winner.name
													const improvement =
														variant.name !== 'control'
															? (
																	((variant.conversionRate -
																		(experiment.variants.find((v) => v.name === 'control')
																			?.conversionRate || 0)) /
																		(experiment.variants.find((v) => v.name === 'control')
																			?.conversionRate || 1)) *
																	100
																).toFixed(1)
															: null

													return (
														<tr
															key={variant.name}
															className={isWinner ? 'admin-table-row-highlight' : ''}
														>
															<td>
																<div className="flex items-center gap-2">
																	<code className="admin-code">{variant.name}</code>
																	{isWinner && (
																		<span className="admin-badge admin-badge-success">
																			<TrendingUp className="h-3 w-3" />
																			{t('winner')}
																		</span>
																	)}
																</div>
															</td>
															<td className="text-right text-sm text-[var(--admin-text-secondary)]">
																{variant.exposures.toLocaleString(locale)}
															</td>
															<td className="text-right text-sm text-[var(--admin-text-secondary)]">
																{variant.conversions}
															</td>
															<td className="text-right text-sm font-medium text-[var(--admin-text-primary)]">
																{variant.conversionRate.toFixed(2)}%
															</td>
															<td className="text-right text-sm">
																{improvement ? (
																	<span
																		className={
																			Number.parseFloat(improvement) > 0
																				? 'text-[var(--admin-success)]'
																				: 'text-[var(--admin-error)]'
																		}
																	>
																		{Number.parseFloat(improvement) > 0 ? '+' : ''}
																		{improvement}%
																	</span>
																) : (
																	<span className="text-[var(--admin-text-muted)]">-</span>
																)}
															</td>
														</tr>
													)
												})}
											</tbody>
										</table>
									</div>

									{/* Winner Summary */}
									{winner && winner.name !== 'control' && (
										<div className="admin-recommendation mt-4">
											<p className="admin-recommendation-text">
												<strong>{t('recommendation')}:</strong> The{' '}
												<code className="admin-code">{winner.name}</code> variant is performing{' '}
												{(
													((winner.conversionRate -
														(experiment.variants.find((v) => v.name === 'control')
															?.conversionRate || 0)) /
														(experiment.variants.find((v) => v.name === 'control')
															?.conversionRate || 1)) *
													100
												).toFixed(1)}
												% better than control. Consider making this the default.
											</p>
										</div>
									)}
								</div>
							</div>
						)
					})}
				</div>
			)}

			{/* Help Text */}
			<div className="admin-section">
				<div className="admin-section-content">
					<h3 className="mb-2 font-semibold text-[var(--admin-text-primary)]">
						{t('howToUse.title')}
					</h3>
					<div className="space-y-2 text-sm text-[var(--admin-text-secondary)]">
						<p>{t('howToUse.step1')}</p>
						<p>{t('howToUse.step2')}</p>
						<p>{t('howToUse.step3')}</p>
					</div>
					<a
						href="https://posthog.com/docs/experiments"
						target="_blank"
						rel="noopener noreferrer"
						className="admin-btn admin-btn-ghost mt-4"
					>
						{t('learnMore')}
						<ExternalLink className="h-4 w-4" />
					</a>
				</div>
			</div>
		</div>
	)
}
