import { getServerMetricsReport } from '@/lib/api/server'

function rate(numerator: number, denominator: number): string {
	return denominator > 0
		? `${((100 * numerator) / denominator).toFixed(1)}% (${numerator}/${denominator})`
		: '— (no cohort)'
}

/** Operator surface: read-only aggregates, no SQL and no private player rows. */
export async function ProductMetricsReport() {
	const report = await getServerMetricsReport().catch(() => null)
	return (
		<section className="admin-card space-y-4 p-6" aria-labelledby="product-metrics-title">
			<h2 id="product-metrics-title" className="text-xl font-semibold">
				Daily puzzle completers
			</h2>
			<p className="text-sm">
				Asia/Hong_Kong product days · refreshed every 15 minutes · current day provisional
			</p>
			{(!report || report.stale) && (
				<p role="alert">
					Scheduled metrics are missing or more than 30 minutes old. Check the product-metrics
					schedule.
				</p>
			)}
			<p className="text-sm">
				D7 is completing again on day 7 after the first completer day. A dash means no cohort, not
				zero retention. Landing completers are consenting first-time completers after a verified
				share landing in the preceding seven product days.
			</p>
			<div className="overflow-x-auto">
				<table className="w-full text-left text-sm">
					<caption className="text-left">
						Last 35 product days. Landings are anonymous visits; attributed completers cover
						analytics opt-ins only. Observed Plus/free audience rates cover signed-in subscription
						viewers only; trials are not paid. New counters start at deployment; historical landings
						and share taps cannot be reconstructed.
					</caption>
					<thead>
						<tr>
							{[
								'Day',
								'Completers (signed in)',
								'D7 retention',
								'Weekly regulars',
								'Shares / landings / new completers',
								'Free finish errors',
								'Plus / free completion rate',
								'Alerts',
							].map((title) => (
								<th key={title} scope="col" className="p-2">
									{title}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{report?.days.map((day) => (
							<tr key={day.dayKey} className="border-t">
								<th scope="row" className="p-2">
									{day.dayKey}
									{!day.complete && ' (provisional)'}
									<span className="block font-normal">Updated {day.generatedAt}</span>
								</th>
								<td className="p-2">
									{day.dailyPuzzleCompleters} ({day.signedInCompleters})
								</td>
								<td className="p-2">
									{day.complete ? rate(day.d7Returned, day.d7Cohort) : 'Not mature'}
								</td>
								<td className="p-2">{day.weeklyRitualists}</td>
								<td className="p-2">
									{day.shares} / {day.shareLandings} / {day.shareLandingCompleters}
								</td>
								<td className="p-2">
									{rate(day.freeFinishFailed, day.freeFinishOk + day.freeFinishFailed)}
								</td>
								<td className="p-2">
									{rate(day.paidCompleters, day.paidActive)} /{' '}
									{rate(day.freeCompleters, day.freeActive)}
								</td>
								<td className="p-2">
									{day.complete ? day.alerts.join(', ') || 'None above threshold' : 'Not evaluated'}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</section>
	)
}
