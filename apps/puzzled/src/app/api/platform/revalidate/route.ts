/**
 * POST /api/platform/revalidate
 *
 * Webhook handler for cache invalidation from Sylphx platform.
 * When admin changes config (flags, plans, OAuth, consent), the platform
 * sends a `config.changed` webhook here. We verify the signature and
 * call `revalidateTag()` for each tag in the payload.
 */

import { revalidateTag } from 'next/cache'
import { createWebhookHandler } from '@sylphx/sdk/server'

export const POST = createWebhookHandler({
	secret: process.env.SYLPHX_SECRET_KEY!,
	handlers: {
		'config.changed': async (data) => {
			const { tags } = data as { tags?: string[] }
			for (const tag of tags ?? []) {
				revalidateTag(tag, { expire: 0 })
			}
		},
	},
})
