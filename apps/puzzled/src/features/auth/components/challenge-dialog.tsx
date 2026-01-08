'use client'

import { Shield } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@sylphx/ui'
import { ChallengeForm, type ChallengeRequirement } from './challenge-form'

// ==================
// Types
// ==================

type ChallengeDialogProps = {
	/** Whether the dialog is open */
	open: boolean
	/** What level of verification is required */
	require: ChallengeRequirement
	/** Called when all required challenges are verified */
	onSuccess: () => void
	/** Called when dialog is closed/cancelled */
	onCancel: () => void
	/** Custom title */
	title?: string
	/** Custom description */
	description?: string
}

// ==================
// Component
// ==================

/**
 * ChallengeDialog - Modal wrapper for ChallengeForm
 *
 * Use this for client-side operations that need verification.
 * For server-side redirects, use the /challenge page instead.
 */
export function ChallengeDialog({
	open,
	require,
	onSuccess,
	onCancel,
	title,
	description,
}: ChallengeDialogProps) {
	// Track if we need to reset the form
	const [formKey, setFormKey] = useState(0)

	// Reset form when dialog opens
	useEffect(() => {
		if (open) {
			setFormKey((k) => k + 1)
		}
	}, [open])

	const handleOpenChange = useCallback(
		(isOpen: boolean) => {
			if (!isOpen) {
				onCancel()
			}
		},
		[onCancel],
	)

	const dialogTitle =
		title ??
		(require === 'both'
			? 'Security Verification Required'
			: require === 'mfa'
				? 'Verify Your Identity'
				: 'Confirm Your Identity')

	const dialogDescription =
		description ??
		(require === 'both'
			? 'This action requires additional security verification.'
			: require === 'mfa'
				? 'Enter your authenticator code to continue.'
				: 'Please verify your identity to continue.')

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
						<Shield className="h-6 w-6 text-primary" />
					</div>
					<DialogTitle className="text-center">{dialogTitle}</DialogTitle>
					<DialogDescription className="text-center">{dialogDescription}</DialogDescription>
				</DialogHeader>

				<DialogBody>
					<ChallengeForm
						key={formKey}
						require={require}
						onSuccess={onSuccess}
						onCancel={onCancel}
						showCancel
						autoFocus
					/>
				</DialogBody>
			</DialogContent>
		</Dialog>
	)
}
