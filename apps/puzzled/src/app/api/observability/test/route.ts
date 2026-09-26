import { isTestTriggerAuthorized, testNonce } from '@/lib/observability/test-trigger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Production check for error capture: with the environment key it throws
 * `observability test error <nonce>`, which `onRequestError` captures. Any
 * other caller gets 404. See docs/observability.md.
 */
export async function POST(request: Request): Promise<Response> {
	if (!isTestTriggerAuthorized(request.headers.get('authorization'))) {
		return new Response(null, { status: 404 })
	}
	const nonce = testNonce(await request.json().catch(() => null))
	throw new Error(`observability test error ${nonce || 'no-nonce'}`)
}
