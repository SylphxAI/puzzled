import { relayBrowserError } from '@/lib/observability/relay'

export const runtime = 'nodejs'

/** Browser error relay into Sylphx Observability (docs/observability.md). */
export const POST = relayBrowserError
