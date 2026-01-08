'use client'

import { AlertTriangle, Download, Loader2, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCallback, useState } from 'react'
import { ChallengeDialog, signOut, useChallenge } from '@/features/auth'
import { downloadJson, getExportFilename } from '@/lib/download'
import {
	Button,
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
} from '@/shared/components/ui'
import { trpc } from '@/trpc/client'
import { exportUserData } from '../actions/privacy-actions'

type DeleteAccountModalProps = {
	open: boolean
	onClose: () => void
}

export function DeleteAccountModal({ open, onClose }: DeleteAccountModalProps) {
	const t = useTranslations()
	const router = useRouter()
	// Account deletion requires both identity and MFA verification (if MFA enabled)
	// The 'both' requirement is smart - if user doesn't have 2FA, only identity is required
	const {
		verify,
		showDialog,
		onSuccess: onChallengeSuccess,
		onCancel: onChallengeCancel,
		isVerified,
	} = useChallenge('both')

	// Get localized confirmation word
	const confirmWord = t('settings.privacy.deleteAccount.confirmWord')

	const [confirmation, setConfirmation] = useState('')
	const [isDeleting, setIsDeleting] = useState(false)
	const [isExporting, setIsExporting] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [pendingDelete, setPendingDelete] = useState(false)

	// Delete account mutation using tRPC
	const deleteAccountMutation = trpc.account.deleteAccount.useMutation({
		onSuccess: async () => {
			// Sign out and redirect to home
			await signOut()
			router.push('/')
		},
		onError: (err) => {
			if (err.data?.code === 'FORBIDDEN' && err.message.includes('verify')) {
				// Need identity verification
				setPendingDelete(true)
				verify()
			} else {
				setError(err.message)
			}
			setIsDeleting(false)
		},
	})

	const handleExport = async () => {
		setIsExporting(true)
		setError(null)

		try {
			const result = await exportUserData()

			if (result.success && result.data) {
				downloadJson(result.data, getExportFilename('puzzled-data-export'))
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : t('settings.privacy.exportError'))
		} finally {
			setIsExporting(false)
		}
	}

	// Handle challenge success - proceed with deletion
	const handleChallengeSuccess = useCallback(() => {
		onChallengeSuccess()
		if (pendingDelete && confirmation === confirmWord) {
			setPendingDelete(false)
			setIsDeleting(true)
			deleteAccountMutation.mutate({ confirmation: confirmWord })
		}
	}, [onChallengeSuccess, pendingDelete, confirmation, confirmWord, deleteAccountMutation])

	// Handle challenge cancel
	const handleChallengeCancel = useCallback(() => {
		onChallengeCancel()
		setPendingDelete(false)
	}, [onChallengeCancel])

	const handleDelete = async () => {
		if (confirmation !== confirmWord) {
			setError(t('settings.privacy.deleteAccount.confirmError', { confirmWord }))
			return
		}

		setError(null)

		// Check if already verified
		if (isVerified) {
			setIsDeleting(true)
			deleteAccountMutation.mutate({ confirmation: confirmWord })
		} else {
			// Need to verify first
			setPendingDelete(true)
			verify()
		}
	}

	const handleClose = () => {
		if (!isDeleting) {
			setConfirmation('')
			setError(null)
			setPendingDelete(false)
			onClose()
		}
	}

	return (
		<>
			{/* ChallengeDialog for identity (and MFA if enabled) verification */}
			<ChallengeDialog
				open={showDialog}
				require="both"
				onSuccess={handleChallengeSuccess}
				onCancel={handleChallengeCancel}
				title={t('settings.privacy.deleteAccount.verifyTitle')}
				description={t('settings.privacy.deleteAccount.verifyDescription')}
			/>

			<Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<AlertTriangle className="h-5 w-5 text-destructive" />
							{t('settings.privacy.deleteAccount.title')}
						</DialogTitle>
					</DialogHeader>

					<DialogBody className="space-y-4">
						<div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
							<p className="mb-2 font-medium text-destructive">
								{t('settings.privacy.deleteAccount.warning')}
							</p>
							<p className="text-sm text-muted-foreground">
								{t('settings.privacy.deleteAccount.warningDescription')}
							</p>
						</div>

						<div>
							<p className="mb-2 text-sm font-medium">
								{t('settings.privacy.deleteAccount.whatWillBeDeleted')}
							</p>
							<ul className="space-y-1 text-sm text-muted-foreground">
								<li>• {t('settings.privacy.deleteAccount.deleteProfile')}</li>
								<li>• {t('settings.privacy.deleteAccount.deleteGameHistory')}</li>
								<li>• {t('settings.privacy.deleteAccount.deleteAchievements')}</li>
								<li>• {t('settings.privacy.deleteAccount.deleteSubscription')}</li>
							</ul>
						</div>

						<div className="rounded-lg border bg-muted/50 p-4">
							<p className="mb-2 text-sm font-medium">
								{t('settings.privacy.deleteAccount.exportFirst')}
							</p>
							<Button
								onClick={handleExport}
								disabled={isExporting || isDeleting}
								variant="outline"
								size="sm"
							>
								{isExporting ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										{t('settings.privacy.exporting')}
									</>
								) : (
									<>
										<Download className="mr-2 h-4 w-4" />
										{t('settings.privacy.exportButton')}
									</>
								)}
							</Button>
						</div>

						<div>
							<label htmlFor="delete-confirmation" className="mb-2 block text-sm font-medium">
								{t('settings.privacy.deleteAccount.confirmPrompt', { confirmWord })}
							</label>
							<Input
								id="delete-confirmation"
								value={confirmation}
								onChange={(e) => setConfirmation(e.target.value)}
								placeholder={confirmWord}
								disabled={isDeleting}
								className="font-mono"
							/>
							<p className="mt-1 text-xs text-muted-foreground">
								{t('settings.privacy.deleteAccount.typeDelete', { confirmWord })}
							</p>
						</div>

						{error && (
							<div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
								{error}
							</div>
						)}
					</DialogBody>

					<DialogFooter>
						<Button onClick={handleClose} variant="outline" disabled={isDeleting}>
							{t('common.cancel')}
						</Button>
						<Button
							onClick={handleDelete}
							variant="destructive"
							disabled={confirmation !== confirmWord || isDeleting}
						>
							{isDeleting ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									{t('settings.privacy.deleteAccount.deleting')}
								</>
							) : (
								<>
									<Trash2 className="mr-2 h-4 w-4" />
									{t('settings.privacy.deleteAccount.confirmButton')}
								</>
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}
