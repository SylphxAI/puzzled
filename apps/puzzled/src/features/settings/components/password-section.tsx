'use client'

import { Loader2, Lock, ShieldCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useState, useTransition } from 'react'
import { authClient, ChallengeDialog, useChallenge, validatePassword } from '@/features/auth'
import { PasswordStrength } from '@/features/auth/components'
import { setPasswordForOAuthUser } from '@/features/settings/actions/password-actions'
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

export function PasswordSection() {
	const t = useTranslations()
	const {
		verify,
		showDialog,
		onSuccess: onChallengeSuccess,
		onCancel: onChallengeCancel,
		isVerified,
	} = useChallenge('identity')

	const [showChangePassword, setShowChangePassword] = useState(false)
	const [showSetPassword, setShowSetPassword] = useState(false)
	const [pendingAction, setPendingAction] = useState<'change' | 'set' | null>(null)
	const [currentPassword, setCurrentPassword] = useState('')
	const [newPassword, setNewPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')
	const [success, setSuccess] = useState('')
	const [isPending, startTransition] = useTransition()

	// Use SSOT auth state for hasPassword check
	const utils = trpc.useUtils()
	const { data, isLoading, refetch } = trpc.security.getAuthState.useQuery()

	// Handle challenge success - open the appropriate password dialog
	const handleChallengeSuccess = useCallback(() => {
		onChallengeSuccess()
		if (pendingAction === 'change') {
			setShowChangePassword(true)
		} else if (pendingAction === 'set') {
			setShowSetPassword(true)
		}
		setPendingAction(null)
	}, [onChallengeSuccess, pendingAction])

	// Handle challenge cancel
	const handleChallengeCancel = useCallback(() => {
		onChallengeCancel()
		setPendingAction(null)
	}, [onChallengeCancel])

	// Open change password with identity verification check
	const handleOpenChangePassword = () => {
		if (isVerified) {
			setShowChangePassword(true)
			return
		}
		setPendingAction('change')
		verify()
	}

	// Open set password with identity verification check
	const handleOpenSetPassword = () => {
		if (isVerified) {
			setShowSetPassword(true)
			return
		}
		setPendingAction('set')
		verify()
	}

	const resetForm = () => {
		setCurrentPassword('')
		setNewPassword('')
		setConfirmPassword('')
		setError('')
		setSuccess('')
	}

	const handleChangePassword = async () => {
		setError('')
		setSuccess('')

		if (newPassword !== confirmPassword) {
			setError(t('auth.passwordsDoNotMatch'))
			return
		}

		const validation = validatePassword(newPassword)
		if (!validation.isValid) {
			setError(t('auth.passwordTooShort'))
			return
		}

		setLoading(true)
		try {
			await authClient.changePassword({
				currentPassword,
				newPassword,
				revokeOtherSessions: false,
			})
			setSuccess(t('settings.account.password.passwordUpdated'))
			resetForm()
			// Invalidate auth state to ensure fresh data across all components
			await utils.security.getAuthState.invalidate()
			setTimeout(() => {
				setShowChangePassword(false)
				setSuccess('')
			}, 2000)
		} catch (err) {
			setError(err instanceof Error ? err.message : t('common.error'))
		} finally {
			setLoading(false)
		}
	}

	const handleSetPassword = () => {
		setError('')
		setSuccess('')

		if (newPassword !== confirmPassword) {
			setError(t('auth.passwordsDoNotMatch'))
			return
		}

		const validation = validatePassword(newPassword)
		if (!validation.isValid) {
			setError(t('settings.account.password.passwordInvalid'))
			return
		}

		startTransition(async () => {
			try {
				const result = await setPasswordForOAuthUser(newPassword)

				if (result.success) {
					setSuccess(t('settings.account.password.passwordSet'))
					resetForm()
					// Refetch password status
					await refetch()
					setTimeout(() => {
						setShowSetPassword(false)
						setSuccess('')
					}, 2000)
				} else {
					// Map error codes to translated messages
					const errorMessages: Record<string, string> = {
						unauthorized: t('common.error'),
						rateLimited: t('settings.account.password.rateLimited'),
						noOAuthAccount: t('settings.account.password.noOAuthAccount'),
						alreadyHasPassword: t('settings.account.password.alreadyHasPassword'),
						invalidPassword: t('settings.account.password.passwordInvalid'),
						serverError: t('common.error'),
					}
					setError(errorMessages[result.error || 'serverError'] || t('common.error'))
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : t('common.error'))
			}
		})
	}

	const canSubmitSetPassword =
		newPassword.length > 0 &&
		confirmPassword.length > 0 &&
		newPassword === confirmPassword &&
		validatePassword(newPassword).isValid

	if (isLoading) {
		return (
			<div className="flex justify-center py-4">
				<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
			</div>
		)
	}

	const hasPassword = data?.hasPassword

	return (
		<>
			<div className="space-y-4">
				{hasPassword ? (
					<div className="flex items-center justify-between">
						<div>
							<p className="font-medium">{t('settings.account.password.changePassword')}</p>
							<p className="text-sm text-muted-foreground">
								{t('settings.account.password.description')}
							</p>
						</div>
						<Button onClick={handleOpenChangePassword}>
							{t('settings.account.password.changePassword')}
						</Button>
					</div>
				) : (
					<div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
						<div className="flex items-start gap-4">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/20">
								<Lock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
							</div>
							<div className="flex-1">
								<p className="font-medium">{t('settings.account.password.setPassword')}</p>
								<p className="text-sm text-muted-foreground">
									{t('settings.account.password.setPasswordDescription')}
								</p>
								<Button className="mt-3" onClick={handleOpenSetPassword}>
									{t('settings.account.password.setPassword')}
								</Button>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Change Password Modal (for users who already have a password) */}
			<Dialog
				open={showChangePassword}
				onOpenChange={(isOpen) => !isOpen && setShowChangePassword(false)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t('settings.account.password.changePassword')}</DialogTitle>
					</DialogHeader>
					<DialogBody className="space-y-4">
						{error && (
							<div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
								{error}
							</div>
						)}
						{success && (
							<div className="rounded-lg bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
								{success}
							</div>
						)}
						<Input
							type="password"
							label={t('settings.account.password.currentPassword')}
							value={currentPassword}
							onChange={(e) => setCurrentPassword(e.target.value)}
							autoComplete="current-password"
							disabled={loading}
						/>
						<Input
							type="password"
							label={t('settings.account.password.newPassword')}
							value={newPassword}
							onChange={(e) => setNewPassword(e.target.value)}
							autoComplete="new-password"
							disabled={loading}
						/>
						{newPassword && <PasswordStrength password={newPassword} />}
						<Input
							type="password"
							label={t('settings.account.password.confirmPassword')}
							value={confirmPassword}
							onChange={(e) => setConfirmPassword(e.target.value)}
							autoComplete="new-password"
							disabled={loading}
						/>
					</DialogBody>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setShowChangePassword(false)}
							disabled={loading}
						>
							{t('common.cancel')}
						</Button>
						<Button onClick={handleChangePassword} disabled={loading}>
							{loading ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								t('settings.account.password.changePassword')
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Set Password Modal (for OAuth-only users) */}
			<Dialog
				open={showSetPassword}
				onOpenChange={(isOpen) => !isOpen && setShowSetPassword(false)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t('settings.account.password.setPassword')}</DialogTitle>
					</DialogHeader>
					<DialogBody className="space-y-4">
						<div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3">
							<div className="flex items-start gap-3">
								<ShieldCheck className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
								<p className="text-sm text-muted-foreground">
									{t('settings.account.password.setPasswordSecurityNote')}
								</p>
							</div>
						</div>
						{error && (
							<div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
								{error}
							</div>
						)}
						{success && (
							<div className="rounded-lg bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
								{success}
							</div>
						)}
						<Input
							type="password"
							label={t('settings.account.password.newPassword')}
							value={newPassword}
							onChange={(e) => setNewPassword(e.target.value)}
							autoComplete="new-password"
							disabled={isPending}
						/>
						{newPassword && <PasswordStrength password={newPassword} />}
						<Input
							type="password"
							label={t('settings.account.password.confirmPassword')}
							value={confirmPassword}
							onChange={(e) => setConfirmPassword(e.target.value)}
							autoComplete="new-password"
							disabled={isPending}
						/>
						{confirmPassword && newPassword !== confirmPassword && (
							<p className="text-sm text-destructive">{t('auth.passwordsDoNotMatch')}</p>
						)}
					</DialogBody>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								resetForm()
								setShowSetPassword(false)
							}}
							disabled={isPending}
						>
							{t('common.cancel')}
						</Button>
						<Button onClick={handleSetPassword} disabled={isPending || !canSubmitSetPassword}>
							{isPending ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								t('settings.account.password.setPassword')
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* ChallengeDialog for identity verification */}
			<ChallengeDialog
				open={showDialog}
				require="identity"
				onSuccess={handleChallengeSuccess}
				onCancel={handleChallengeCancel}
				title={t('settings.account.password.verifyIdentity')}
				description={t('settings.account.password.verifyIdentityDescription')}
			/>
		</>
	)
}
