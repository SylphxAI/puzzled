'use client'

import { ExternalLink, Loader2 } from 'lucide-react'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { createPortalSession } from '@/features/subscription'
import { Button, useToast } from '@sylphx/ui'

type Props = {
	label: string
}

export function ManageSubscriptionButton({ label }: Props) {
	const t = useTranslations()
	const { error: showError } = useToast()
	const [loading, setLoading] = useState(false)

	const handleClick = async () => {
		setLoading(true)
		try {
			// SECURITY: createPortalSession now fetches customerId server-side from authenticated user
			await createPortalSession()
			// Note: createPortalSession calls redirect() which throws NEXT_REDIRECT
			// If we reach here, something unexpected happened
		} catch (error) {
			// redirect() throws a special error - let it propagate
			if (isRedirectError(error)) {
				throw error
			}
			// Portal creation failed - show error toast
			showError(t('subscription.portalError'), t('subscription.portalErrorDescription'))
		} finally {
			// Reset loading state (no-op if redirect succeeded and component unmounts)
			setLoading(false)
		}
	}

	return (
		<Button variant="outline" onClick={handleClick} disabled={loading}>
			{loading ? (
				<Loader2 className="mr-2 h-4 w-4 animate-spin" />
			) : (
				<ExternalLink className="mr-2 h-4 w-4" />
			)}
			{label}
		</Button>
	)
}
