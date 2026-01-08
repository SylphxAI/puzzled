'use client'

import { AlertCircle, CheckCircle, Clock, Loader2, Mail, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useState } from 'react'
import { ChallengeDialog, useChallenge, useSession } from '@/features/auth'
import {
	Button,
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
} from '@sylphx/ui'
import { trpc } from '@/trpc/client'

export function EmailChange() {
	const t = useTranslations('settings.email')
	const tCommon = useTranslations('common')
	const { data: session } = useSession()
	const {
		verify,
		showDialog,
		onSuccess: onChallengeSuccess,
		onCancel: onChallengeCancel,
		isVerified,
	} = useChallenge('identity')

	const [showChangeEmail, setShowChangeEmail] = useState(false)
	const [newEmail, setNewEmail] = useState('')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')
	const [success, setSuccess] = useState(false)
	const [pendingEmailChange, setPendingEmailChange] = useState(false)

	// Get pending email change
	const { data: pendingChange, refetch: refetchPending } =
		trpc.email.getPendingEmailChange.useQuery()

	// Request email change mutation
	const requestChangeMutation = trpc.email.requestEmailChange.useMutation({
		onSuccess: () => {
			setSuccess(true)
			refetchPending()
			setTimeout(() => {
				setShowChangeEmail(false)
				setSuccess(false)
				resetForm()
			}, 2000)
		},
		onError: (err) => {
			// Check if identity verification is required
			if (
				err.data?.code === 'FORBIDDEN' &&
				(err.message.includes('verify') || err.message.includes('identity'))
			) {
				// Challenge expired, need to verify again
				setError(t('verificationRequired'))
			} else {
				setError(err.message)
			}
		},
	})

	// Cancel email change mutation
	const cancelChangeMutation = trpc.email.cancelEmailChange.useMutation({
		onSuccess: () => {
			refetchPending()
		},
		onError: (err) => {
			setError(err.message)
		},
	})

	const resetForm = () => {
		setNewEmail('')
		setError('')
		setSuccess(false)
	}

	// Handle challenge success - open the email change dialog
	const handleChallengeSuccess = useCallback(() => {
		onChallengeSuccess()
		if (pendingEmailChange) {
			setPendingEmailChange(false)
			setShowChangeEmail(true)
		}
	}, [onChallengeSuccess, pendingEmailChange])

	// Handle challenge cancel
	const handleChallengeCancel = useCallback(() => {
		onChallengeCancel()
		setPendingEmailChange(false)
	}, [onChallengeCancel])

	const handleOpenChangeEmail = () => {
		// Check if already verified
		if (isVerified) {
			setShowChangeEmail(true)
			return
		}

		// Need to verify first
		setPendingEmailChange(true)
		verify()
	}

	const handleRequestChange = async () => {
		setError('')

		if (!newEmail.trim()) {
			setError(t('emailRequired'))
			return
		}

		// Basic email validation
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
		if (!emailRegex.test(newEmail)) {
			setError(t('invalidEmail'))
			return
		}

		setLoading(true)
		try {
			await requestChangeMutation.mutateAsync({
				newEmail: newEmail.trim(),
			})
		} finally {
			setLoading(false)
		}
	}

	const handleCancelChange = async () => {
		await cancelChangeMutation.mutateAsync()
	}

	const formatTimeRemaining = (expiresAt: Date) => {
		const now = new Date()
		const expires = new Date(expiresAt)
		const hoursRemaining = Math.max(
			0,
			Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60)),
		)
		return t('expiresIn', { hours: hoursRemaining })
	}

	const currentEmail = session?.user?.email
	const isEmailVerified = session?.user?.emailVerified

	return (
		<>
			{/* ChallengeDialog for identity verification */}
			<ChallengeDialog
				open={showDialog}
				require="identity"
				onSuccess={handleChallengeSuccess}
				onCancel={handleChallengeCancel}
				title={t('changeEmailTitle')}
				description={t('verifyToChangeEmail')}
			/>

			<div className="space-y-4">
				{/* Current Email Display */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
							<Mail className="h-5 w-5 text-primary" />
						</div>
						<div>
							<p className="font-medium">{currentEmail}</p>
							<div className="flex items-center gap-2">
								{isEmailVerified ? (
									<span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
										<CheckCircle className="h-3.5 w-3.5" />
										{t('verified')}
									</span>
								) : (
									<span className="flex items-center gap-1 text-sm text-yellow-600 dark:text-yellow-400">
										<AlertCircle className="h-3.5 w-3.5" />
										{t('unverified')}
									</span>
								)}
							</div>
						</div>
					</div>
					<Button variant="outline" onClick={handleOpenChangeEmail} disabled={!!pendingChange}>
						{t('changeEmail')}
					</Button>
				</div>

				{/* Pending Email Change Notice */}
				{pendingChange && (
					<div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
						<div className="flex items-start justify-between">
							<div className="flex items-start gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20">
									<Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
								</div>
								<div>
									<p className="font-medium text-blue-700 dark:text-blue-300">
										{t('pendingChangeTitle')}
									</p>
									<p className="text-sm text-muted-foreground">
										{t('pendingChangeDescription', { email: pendingChange.newEmail })}
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										{formatTimeRemaining(pendingChange.expiresAt)}
									</p>
								</div>
							</div>
							<Button
								variant="ghost"
								size="icon"
								onClick={handleCancelChange}
								disabled={cancelChangeMutation.isPending}
								className="h-8 w-8"
								aria-label={tCommon('cancel')}
							>
								{cancelChangeMutation.isPending ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<X className="h-4 w-4" />
								)}
							</Button>
						</div>
					</div>
				)}
			</div>

			{/* Change Email Modal */}
			<Dialog
				open={showChangeEmail}
				onOpenChange={(isOpen) => {
					if (!isOpen) {
						setShowChangeEmail(false)
						resetForm()
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t('changeEmailTitle')}</DialogTitle>
					</DialogHeader>
					<DialogBody className="space-y-4">
						{error && (
							<div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
								{error}
							</div>
						)}
						{success && (
							<div className="rounded-lg bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
								{t('verificationSent')}
							</div>
						)}
						<div className="text-sm text-muted-foreground">{t('changeEmailDescription')}</div>
						<Input
							type="email"
							label={t('newEmail')}
							value={newEmail}
							onChange={(e) => setNewEmail(e.target.value)}
							autoComplete="email"
							disabled={loading || success}
							placeholder={t('newEmailPlaceholder')}
						/>
					</DialogBody>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setShowChangeEmail(false)
								resetForm()
							}}
							disabled={loading}
						>
							{tCommon('cancel')}
						</Button>
						<Button onClick={handleRequestChange} disabled={loading || success}>
							{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('sendVerification')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}
