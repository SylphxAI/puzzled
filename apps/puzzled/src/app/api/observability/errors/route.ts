import { relayBrowserError } from '@/lib/observability/relay'

export const runtime = 'nodejs'

/** Same-origin browser error intake (docs/observability.md). */
export const POST = relayBrowserError
