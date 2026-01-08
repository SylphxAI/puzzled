'use client'

import { useCallback, useState } from 'react'
import { trpc } from '@/trpc/client'

type ChallengeRequirement = 'identity' | 'mfa' | 'both'

/**
 * Hook to manage authentication challenges
 *
 * Provides a simple API for components that need to require verification
 * before performing sensitive operations.
 *
 * @param requirement - What level of verification is needed:
 *   - 'identity': Password or email verification (10 min TTL)
 *   - 'mfa': Authenticator or backup code (session lifetime)
 *   - 'both': Both identity AND MFA required
 *
 * @example
 * ```tsx
 * function DeleteAccountButton() {
 *   const { verify, showDialog, onSuccess, onCancel, isVerified } = useChallenge('both')
 *
 *   const handleDelete = async () => {
 *     if (!isVerified) {
 *       verify()
 *       return
 *     }
 *     await deleteAccount()
 *   }
 *
 *   return (
 *     <>
 *       <button onClick={handleDelete}>Delete Account</button>
 *       <ChallengeDialog
 *         open={showDialog}
 *         require="both"
 *         onSuccess={onSuccess}
 *         onCancel={onCancel}
 *       />
 *     </>
 *   )
 * }
 * ```
 */
export function useChallenge(requirement: ChallengeRequirement = 'identity') {
	const [showDialog, setShowDialog] = useState(false)

	const { data: status, refetch } = trpc.challenge.getStatus.useQuery()

	// Calculate if requirement is satisfied based on status
	const isVerified = (() => {
		if (!status) return false

		switch (requirement) {
			case 'identity':
				return status.identityVerified
			case 'mfa':
				return status.mfaVerified
			case 'both':
				// For 'both': if user doesn't have 2FA, only identity is required
				if (!status.userHas2FA) {
					return status.identityVerified
				}
				return status.identityVerified && status.mfaVerified
		}
	})()

	/**
	 * Trigger verification flow
	 * Returns true if already verified, false if dialog was opened
	 */
	const verify = useCallback(() => {
		if (isVerified) {
			return true // Already verified
		}
		setShowDialog(true)
		return false
	}, [isVerified])

	/**
	 * Called when verification succeeds
	 */
	const onSuccess = useCallback(() => {
		setShowDialog(false)
		refetch()
	}, [refetch])

	/**
	 * Called when dialog is cancelled
	 */
	const onCancel = useCallback(() => {
		setShowDialog(false)
	}, [])

	return {
		/** Whether the required verification is currently satisfied */
		isVerified,
		/** Whether user has 2FA enabled */
		userHas2FA: status?.userHas2FA ?? false,
		/** Whether user has a password set */
		userHasPassword: status?.userHasPassword ?? false,
		/** Trigger verification - opens dialog if not verified */
		verify,
		/** Whether the challenge dialog should be shown */
		showDialog,
		/** Callback for when verification succeeds */
		onSuccess,
		/** Callback for when dialog is cancelled */
		onCancel,
	}
}
