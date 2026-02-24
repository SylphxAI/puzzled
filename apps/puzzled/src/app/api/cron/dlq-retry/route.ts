import { cronSuccess, verifyCronAuth } from '@/lib/api/cron'
import { getServerBaseUrl } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * DLQ retry cron job
 *
 * Triggered by Vercel Cron hourly (see vercel.json)
 * Processes failed jobs in the dead letter queue.
 */
export function GET(request: Request): Response {
	const authError = verifyCronAuth(request, '[DLQ]')
	if (authError) return authError

	const baseUrl = getServerBaseUrl()
	const jobUrl = `${baseUrl}/api/jobs/dlq-retry`

	console.log('[DLQ] Triggering DLQ retry job')

	// Fire-and-forget - don't await
	fetch(jobUrl, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-internal-call': 'true',
		},
	}).catch((error) => {
		console.error('[DLQ] Failed to trigger job:', error)
	})

	return cronSuccess('DLQ retry job triggered')
}
