'use client'

import { useTranslations } from 'next-intl'
import { useCallback } from 'react'
import {
	SocialLoginButtons as BaseSocialLoginButtons,
	type SocialProvider,
} from '@sylphx/auth/components'
import { signIn } from '../lib/auth-client'

/**
 * Social login buttons with i18n support
 * Wrapper around @sylphx/auth/components/SocialLoginButtons
 */
export function SocialLoginButtons({ disabled }: { disabled?: boolean }) {
	const t = useTranslations('auth')

	const handleSignIn = useCallback(async (provider: SocialProvider, callbackURL: string) => {
		await signIn.social({
			provider,
			callbackURL,
		})
	}, [])

	return (
		<BaseSocialLoginButtons
			disabled={disabled}
			onSignIn={handleSignIn}
			callbackURL="/"
			errorMessage={(name) => t('socialLoginFailed', { provider: name })}
		/>
	)
}
