/**
 * Pure helpers for the seeded web-vitals gate (web-vitals.e2e.ts).
 *
 * LCP's budget is the Core Web Vitals "good" threshold at the 75th percentile.
 * INP's budget is a ratchet: under the gate's 4x CPU slowdown the seeded play
 * measured 330-470 ms p75 on four routes (two runs, 2026-10-05), so the gate
 * holds 600 ms to catch a regression now. The "good" target is 200 ms
 * (INP_TARGET_MS); lower INP_BUDGET_MS as the slow interactions are fixed.
 */
const INP_TARGET_MS = 200
const INP_BUDGET_MS = 600

export const VITAL_BUDGETS = {
	/** Largest Contentful Paint, p75, ms. */
	lcp: 2500,
	/** Interaction to Next Paint, p75, ms (ratchet toward INP_TARGET_MS). */
	inp: INP_BUDGET_MS,
} as const

export type VitalName = keyof typeof VITAL_BUDGETS

export type VitalSample = { lcp: number | null; inp: number | null }

export type RouteReport = {
	route: string
	runs: number
	lcpP75: number | null
	inpP75: number | null
}

/** Nearest-rank percentile (the method CrUX-style p75 reports use). */
export function percentile(values: number[], p: number): number | null {
	if (values.length === 0) return null
	const sorted = [...values].sort((a, b) => a - b)
	const rank = Math.max(1, Math.ceil((p / 100) * sorted.length))
	return sorted[rank - 1]
}

export function summarise(route: string, samples: VitalSample[]): RouteReport {
	const pick = (name: VitalName) =>
		samples.map((s) => s[name]).filter((v): v is number => typeof v === 'number')
	return {
		route,
		runs: samples.length,
		lcpP75: percentile(pick('lcp'), 75),
		inpP75: percentile(pick('inp'), 75),
	}
}

/**
 * Budget failures for one route. A route that produced no sample for a vital
 * fails too: a gate that cannot measure must not pass.
 */
export function budgetFailures(
	report: RouteReport,
	budgets: Record<VitalName, number> = VITAL_BUDGETS,
): string[] {
	const failures: string[] = []
	const checks: [VitalName, number | null][] = [
		['lcp', report.lcpP75],
		['inp', report.inpP75],
	]
	for (const [name, value] of checks) {
		if (value === null) failures.push(`${report.route}: no ${name.toUpperCase()} sample`)
		else if (value > budgets[name])
			failures.push(
				`${report.route}: ${name.toUpperCase()} p75 ${Math.round(value)} ms over budget ${budgets[name]} ms`,
			)
	}
	return failures
}

export function markdownTable(reports: RouteReport[]): string {
	const cell = (v: number | null) => (v === null ? 'n/a' : `${Math.round(v)} ms`)
	const rows = reports.map(
		(r) => `| ${r.route} | ${r.runs} | ${cell(r.lcpP75)} | ${cell(r.inpP75)} |`,
	)
	return [
		'| Route | Runs | LCP p75 | INP p75 |',
		'| --- | --- | --- | --- |',
		...rows,
		'',
		`Budgets (p75): LCP ${VITAL_BUDGETS.lcp} ms, INP ${VITAL_BUDGETS.inp} ms (target ${INP_TARGET_MS} ms).`,
	].join('\n')
}
