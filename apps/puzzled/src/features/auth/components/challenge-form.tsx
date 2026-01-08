'use client'

import { useCallback, useMemo } from 'react'
import {
	ChallengeForm as BaseChallengeForm,
	type ChallengeCallbacks,
	type ChallengeLabels,
	type ChallengeRequirement,
} from '@sylphx/auth/components'
import { trpc } from '@/trpc/client'

export type { ChallengeRequirement }

export interface ChallengeFormProps {
	/** What level of verification is required */
	require: ChallengeRequirement
	/** Called when all required challenges are verified */
	onSuccess: () => void
	/** Called when user cancels (optional - for dialog use) */
	onCancel?: () => void
	/** Show cancel button */
	showCancel?: boolean
	/** Custom class name for the form container */
	className?: string
	/** Auto-focus first input */
	autoFocus?: boolean
}

/**
 * ChallengeForm - Core verification form component
 *
 * Wrapper around @sylphx/auth/components/ChallengeForm with tRPC integration.
 * Handles all verification scenarios:
 * - Identity verification (password OR email code)
 * - MFA verification (TOTP OR backup code)
 * - Combined verification (both required)
 */
export function ChallengeForm({
	require,
	onSuccess,
	onCancel,
	showCancel = false,
	className,
	autoFocus = true,
}: ChallengeFormProps) {
	const utils = trpc.useUtils()

	// Create tRPC-based callbacks
	const callbacks: ChallengeCallbacks = useMemo(() => ({
		getStatus: async () => {
			const status = await utils.challenge.getStatus.fetch()
			return {
				userHasPassword: status.userHasPassword,
				userHas2FA: status.userHas2FA,
			}
		},
		requestEmailCode: async () => {
			const result = await utils.client.challenge.requestEmailCode.mutate()
			return { expiresInSeconds: result.expiresInSeconds }
		},
		verifyIdentity: async (params) => {
			await utils.client.challenge.verifyIdentity.mutate(params)
		},
		verifyMfa: async (params) => {
			const result = await utils.client.challenge.verifyMfa.mutate(params)
			return {
				method: result.method as 'totp' | 'backup',
				remainingBackupCodes: result.remainingBackupCodes,
			}
		},
	}), [utils])

	// Labels - hardcoded English for now (puzzled uses next-intl elsewhere)
	const labels: ChallengeLabels = useMemo(() => ({
		password: 'Password',
		emailCode: 'Email Code',
		enterPassword: 'Enter your password',
		passwordPlaceholder: '••••••••',
		sendCodePrompt: "We'll send a verification code to your email address.",
		sendCode: 'Send Code',
		sending: 'Sending...',
		enterEmailCode: 'Enter the 6-digit code sent to your email',
		codeExpiresIn: (m, s) => `Code expires in ${m}:${String(s).padStart(2, '0')}`,
		resendCode: 'Resend code',
		enterAuthenticatorCode: 'Enter authenticator code',
		enterBackupCode: 'Enter backup code',
		useAuthenticator: 'Use authenticator app instead',
		useBackupCode: 'Lost access? Use a backup code',
		enterPasswordError: 'Please enter your password',
		enterCodeError: 'Please enter the verification code',
		backupCodeFormat: 'Backup code must be in format XXXXX-XXXXX',
		verificationCodeFormat: 'Verification code must be 6 digits',
		continue: 'Continue',
		verify: 'Verify',
		verifying: 'Verifying...',
		cancel: 'Cancel',
		verificationSuccessful: 'Verification Successful',
		backupCodesRemaining: (count) => `${count} backup codes remaining`,
		redirecting: 'Redirecting...',
		identityVerified: 'Identity verified. Now verify your authenticator.',
		twoFaRequired: 'Two-Factor Authentication Required',
		twoFaRequiredDesc: 'You need to enable 2FA before you can access this feature.',
		goToSettings: 'Go to Settings',
	}), [])

	return (
		<BaseChallengeForm
			require={require}
			onSuccess={onSuccess}
			onCancel={onCancel}
			callbacks={callbacks}
			showCancel={showCancel}
			className={className}
			autoFocus={autoFocus}
			labels={labels}
		/>
	)
}
