'use client'

/**
 * Sylphx Platform Sign In Button
 *
 * A button that redirects to Sylphx Platform for centralized auth.
 * Only renders when NEXT_PUBLIC_SYLPHX_APP_ID is configured.
 * Gracefully handles when Sylphx Platform is not configured.
 */

import { useCallback } from 'react'
import { useSafeUser, useSafeAuth } from '@sylphx/sdk/react'
import { Button } from '@sylphx/ui'
import { ExternalLink } from 'lucide-react'

interface SylphxSignInButtonProps {
	/** URL to redirect back to after sign in */
	redirectUrl?: string
	/** Custom button text */
	children?: React.ReactNode
	/** Additional class names */
	className?: string
	/** Disabled state */
	disabled?: boolean
}

export function SylphxSignInButton({
	redirectUrl,
	children,
	className,
	disabled,
}: SylphxSignInButtonProps) {
	const { isConfigured, isLoaded, isSignedIn } = useSafeUser()
	const { signIn } = useSafeAuth()

	const handleClick = useCallback(() => {
		signIn({
			redirectUrl: redirectUrl || '/dashboard',
		})
	}, [signIn, redirectUrl])

	// Don't render if Sylphx is not configured
	if (!isConfigured) {
		return null
	}

	// Don't render if user is already signed in
	if (isLoaded && isSignedIn) {
		return null
	}

	return (
		<Button
			type="button"
			variant="outline"
			onClick={handleClick}
			disabled={disabled}
			className={className}
		>
			<ExternalLink className="mr-2 h-4 w-4" />
			{children || 'Continue with Sylphx'}
		</Button>
	)
}
