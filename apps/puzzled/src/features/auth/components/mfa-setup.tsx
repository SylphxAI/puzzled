'use client'

import {
	AlertTriangle,
	Check,
	ChevronDown,
	ChevronUp,
	Copy,
	Download,
	Key,
	Loader2,
	RefreshCw,
	Shield,
	ShieldCheck,
	ShieldOff,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import QRCode from 'qrcode'
import { useCallback, useEffect, useState } from 'react'
import { APP_NAME } from '@/lib/config/app'
import { Button, Input } from '@/shared/components/ui'
import { trpc } from '@/trpc/client'
import { ChallengeDialog } from './challenge-dialog'

type MfaState =
	| 'idle'
	| 'enabling'
	| 'verifying'
	| 'show-backup-codes'
	| 'confirming-disable'
	| 'disabling'
	| 'regenerating-codes'

export function MfaSetup() {
	const t = useTranslations('settings')
	const [state, setState] = useState<MfaState>('idle')
	const [error, setError] = useState<string | null>(null)
	const [totpUri, setTotpUri] = useState<string | null>(null)
	const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null)
	const [verificationCode, setVerificationCode] = useState('')
	const [backupCodes, setBackupCodes] = useState<string[]>([])
	const [copied, setCopied] = useState(false)
	const [showRecoveryCodes, setShowRecoveryCodes] = useState(false)
	const [showChallengeDialog, setShowChallengeDialog] = useState(false)
	const [challengePurpose, setChallengePurpose] = useState<'enable' | 'disable' | 'regenerate'>('enable')
	const [disableCode, setDisableCode] = useState('')
	const [regenerateCode, setRegenerateCode] = useState('')

	// Use SSOT auth state for all permission checks and MFA status
	const {
		data: authState,
		isLoading: authStateLoading,
		refetch: refetchAuthState,
	} = trpc.security.getAuthState.useQuery()

	// Custom 2FA mutations
	const startSetupMutation = trpc.twoFactor.startSetup.useMutation()
	const verifyAndActivateMutation = trpc.twoFactor.verifyAndActivate.useMutation()
	const disableMutation = trpc.twoFactor.disable.useMutation()
	const regenerateMutation = trpc.twoFactor.regenerateBackupCodes.useMutation()
	const cancelSetupMutation = trpc.twoFactor.cancelSetup.useMutation()

	// Generate QR code client-side (never sends secret to external services)
	useEffect(() => {
		if (!totpUri) {
			setQrCodeDataUrl(null)
			return
		}

		QRCode.toDataURL(totpUri, {
			width: 200,
			margin: 2,
			color: { dark: '#000000', light: '#ffffff' },
		})
			.then(setQrCodeDataUrl)
			.catch(() => setError(t('security.failedToGenerateQr')))
	}, [totpUri, t])

	// All MFA state comes from SSOT (not session) for consistency
	const isMfaEnabled = authState?.twoFactorEnabled ?? false
	const canDisable = authState?.canDisable2FA ?? false
	const disableBlockedReason = authState?.disable2FABlockedReason

	// Handle challenge success based on purpose
	const handleChallengeSuccess = useCallback(async () => {
		setShowChallengeDialog(false)

		if (challengePurpose === 'enable') {
			// Start 2FA setup after identity verification
			setState('enabling')
			setError(null)

			try {
				const result = await startSetupMutation.mutateAsync()
				setTotpUri(result.totpUri)
				setBackupCodes(result.backupCodes)
				setState('verifying')
			} catch (err) {
				if (err instanceof Error && err.message.includes('verify your identity')) {
					// Session expired, need to verify identity again
					setShowChallengeDialog(true)
				} else {
					setError(err instanceof Error ? err.message : t('security.failedToStartSetup'))
				}
				setState('idle')
			}
		}
		// For disable and regenerate, we handle separately since they need a TOTP code
	}, [challengePurpose, startSetupMutation, t])

	const handleStartEnableMfa = useCallback(() => {
		setChallengePurpose('enable')
		setShowChallengeDialog(true)
	}, [])

	const handleVerifyMfa = useCallback(async () => {
		if (!verificationCode || verificationCode.length !== 6) {
			setError(t('security.enter6DigitCode'))
			return
		}

		setError(null)

		try {
			await verifyAndActivateMutation.mutateAsync({ code: verificationCode })

			// Success - MFA is now enabled
			setTotpUri(null)
			setVerificationCode('')

			// Show backup codes before completing setup
			if (backupCodes.length > 0) {
				setState('show-backup-codes')
			} else {
				// No backup codes captured - complete setup
				await refetchAuthState()
				setState('idle')
			}
		} catch (err) {
			if (err instanceof Error && err.message.includes('verify your identity')) {
				// Session expired during setup
				setShowChallengeDialog(true)
				setChallengePurpose('enable')
			} else {
				setError(err instanceof Error ? err.message : t('security.verificationFailed'))
			}
		}
	}, [verificationCode, verifyAndActivateMutation, backupCodes.length, refetchAuthState, t])

	const handleCompleteSetup = useCallback(async () => {
		setBackupCodes([])
		setState('idle')
		await refetchAuthState()
	}, [refetchAuthState])

	const handleDownloadCodes = useCallback(() => {
		if (backupCodes.length === 0) return

		const content = [
			`${APP_NAME} - Recovery Codes`,
			'========================',
			'',
			'Keep these codes in a safe place. Each code can only be used once.',
			'',
			...backupCodes.map((code, i) => `${i + 1}. ${code}`),
			'',
			`Generated: ${new Date().toISOString()}`,
		].join('\n')

		const blob = new Blob([content], { type: 'text/plain' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `${APP_NAME.toLowerCase()}-recovery-codes.txt`
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
		URL.revokeObjectURL(url)
	}, [backupCodes])

	const handleCopyCodes = useCallback(async () => {
		if (backupCodes.length === 0) return

		const content = backupCodes.join('\n')
		try {
			await navigator.clipboard.writeText(content)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		} catch {
			// Fallback for older browsers
			const textarea = document.createElement('textarea')
			textarea.value = content
			document.body.appendChild(textarea)
			textarea.select()
			document.execCommand('copy')
			document.body.removeChild(textarea)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		}
	}, [backupCodes])

	const handleStartDisable = useCallback(() => {
		setChallengePurpose('disable')
		setShowChallengeDialog(true)
		setState('confirming-disable')
	}, [])

	const handleDisableMfa = useCallback(async () => {
		if (!disableCode || disableCode.length !== 6) {
			setError(t('security.enter6DigitCodeFromApp'))
			return
		}

		setState('disabling')
		setError(null)

		try {
			await disableMutation.mutateAsync({ code: disableCode })

			// Success - MFA is now disabled
			setDisableCode('')
			setState('idle')
			await refetchAuthState()
		} catch (err) {
			if (err instanceof Error && err.message.includes('verify your identity')) {
				// Need to verify identity first
				setShowChallengeDialog(true)
			} else {
				setError(err instanceof Error ? err.message : t('security.failedToDisable'))
			}
			setState('confirming-disable')
		}
	}, [disableCode, disableMutation, refetchAuthState, t])

	const handleCancel = useCallback(async () => {
		setState('idle')
		setTotpUri(null)
		setVerificationCode('')
		setDisableCode('')
		setRegenerateCode('')
		setBackupCodes([])
		setError(null)

		// Cancel any pending setup
		if (totpUri) {
			try {
				await cancelSetupMutation.mutateAsync()
			} catch {
				// Ignore cleanup errors
			}
		}
	}, [totpUri, cancelSetupMutation])

	const handleStartRegenerateCodes = useCallback(() => {
		setChallengePurpose('regenerate')
		setShowChallengeDialog(true)
	}, [])

	const handleRegenerateCodes = useCallback(async () => {
		if (!regenerateCode || regenerateCode.length !== 6) {
			setError(t('recoveryCodes.codeRequired'))
			return
		}

		setState('regenerating-codes')
		setError(null)

		try {
			const result = await regenerateMutation.mutateAsync({ code: regenerateCode })

			setBackupCodes(result.backupCodes)
			setRegenerateCode('')
			setShowRecoveryCodes(true)
			setState('idle')
		} catch (err) {
			if (err instanceof Error && err.message.includes('verify your identity')) {
				setShowChallengeDialog(true)
			} else {
				setError(err instanceof Error ? err.message : t('recoveryCodes.regenerateError'))
			}
			setState('idle')
		}
	}, [regenerateCode, regenerateMutation, t])

	if (authStateLoading) {
		return (
			<div className="flex items-center gap-2 text-muted-foreground">
				<Loader2 className="h-4 w-4 animate-spin" />
				{t('security.loading')}
			</div>
		)
	}

	// MFA is enabled - show status and disable option
	if (isMfaEnabled) {
		return (
			<div className="space-y-4">
				{/* Challenge Dialog for identity verification */}
				<ChallengeDialog
					open={showChallengeDialog}
					require="identity"
					onSuccess={handleChallengeSuccess}
					onCancel={() => setShowChallengeDialog(false)}
					title={t('security.verifyIdentity')}
					description={t('security.verifyIdentityDescription')}
				/>

				<div className="flex items-center gap-3">
					<ShieldCheck className="h-5 w-5 text-green-500" />
					<div>
						<p className="font-medium text-green-600 dark:text-green-400">
							{t('security.mfaEnabled')}
						</p>
						<p className="text-sm text-muted-foreground">{t('security.mfaEnabledDescription')}</p>
					</div>
				</div>

				{/* Recovery Codes Section */}
				<div className="rounded-xl border bg-muted/30">
					<button
						type="button"
						onClick={() => setShowRecoveryCodes(!showRecoveryCodes)}
						className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-muted/50"
						aria-expanded={showRecoveryCodes}
						aria-controls="recovery-codes-panel"
					>
						<div className="flex items-center gap-3">
							<Key className="h-5 w-5 text-muted-foreground" />
							<div>
								<p className="font-medium">{t('recoveryCodes.title')}</p>
								<p className="text-sm text-muted-foreground">
									{t('recoveryCodes.shortDescription')}
								</p>
							</div>
						</div>
						{showRecoveryCodes ? (
							<ChevronUp className="h-5 w-5 text-muted-foreground" />
						) : (
							<ChevronDown className="h-5 w-5 text-muted-foreground" />
						)}
					</button>

					{showRecoveryCodes && (
						<div id="recovery-codes-panel" className="border-t p-4 space-y-4">
							{/* Show regenerated codes if available */}
							{backupCodes.length > 0 ? (
								<>
									<div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
										<AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
										<div className="text-sm">
											<p className="font-medium text-amber-700 dark:text-amber-300">
												{t('security.backupCodesWarning')}
											</p>
											<p className="mt-1 text-muted-foreground">
												{t('security.backupCodesWarningDescription')}
											</p>
										</div>
									</div>

									<div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
										{backupCodes.map((code, i) => (
											<div
												key={i}
												className="flex items-center justify-center rounded-lg border bg-background px-3 py-2 font-mono text-sm"
											>
												{code}
											</div>
										))}
									</div>

									<div className="flex flex-wrap gap-2">
										<Button variant="outline" size="sm" onClick={handleCopyCodes}>
											{copied ? (
												<>
													<Check className="mr-2 h-4 w-4 text-green-500" />
													{t('security.copied')}
												</>
											) : (
												<>
													<Copy className="mr-2 h-4 w-4" />
													{t('security.copyAll')}
												</>
											)}
										</Button>
										<Button variant="outline" size="sm" onClick={handleDownloadCodes}>
											<Download className="mr-2 h-4 w-4" />
											{t('security.download')}
										</Button>
										<Button size="sm" onClick={() => setBackupCodes([])}>
											{t('recoveryCodes.done')}
										</Button>
									</div>
								</>
							) : (
								<>
									<div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
										<Shield className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" />
										<div className="text-sm">
											<p className="font-medium">{t('recoveryCodes.codesStoredSecurely')}</p>
											<p className="mt-1 text-muted-foreground">
												{t('recoveryCodes.codesStoredDescription')}
											</p>
										</div>
									</div>

									<div className="space-y-3">
										{state === 'regenerating-codes' ? (
											<div className="flex items-center gap-2 text-muted-foreground">
												<Loader2 className="h-4 w-4 animate-spin" />
												{t('recoveryCodes.regenerating')}
											</div>
										) : state !== 'idle' && challengePurpose === 'regenerate' ? (
											<div className="space-y-3">
												<p className="text-sm text-muted-foreground">
													{t('recoveryCodes.enterCodeToRegenerate')}
												</p>
												<Input
													type="text"
													inputMode="numeric"
													pattern="[0-9]*"
													maxLength={6}
													placeholder="000000"
													value={regenerateCode}
													onChange={(e) => setRegenerateCode(e.target.value.replace(/\D/g, ''))}
													className="w-32 text-center font-mono text-lg"
												/>
												{error && <p className="text-sm text-destructive">{error}</p>}
												<div className="flex gap-2">
													<Button
														size="sm"
														onClick={handleRegenerateCodes}
														disabled={regenerateCode.length !== 6}
													>
														{t('recoveryCodes.confirmRegenerate')}
													</Button>
													<Button
														size="sm"
														variant="ghost"
														onClick={() => {
															setRegenerateCode('')
															setError(null)
															setState('idle')
														}}
													>
														{t('recoveryCodes.cancel')}
													</Button>
												</div>
											</div>
										) : (
											<div className="space-y-2">
												<Button variant="outline" size="sm" onClick={handleStartRegenerateCodes}>
													<RefreshCw className="mr-2 h-4 w-4" />
													{t('recoveryCodes.regenerate')}
												</Button>
												<p className="text-xs text-muted-foreground">
													{t('recoveryCodes.regenerateHint')}
												</p>
											</div>
										)}
									</div>
								</>
							)}
						</div>
					)}
				</div>

				{state === 'idle' && (
					<div className="space-y-2">
						{/* Admin warning - can't disable 2FA */}
						{!canDisable && disableBlockedReason && (
							<div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
								<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
								<span className="text-amber-700 dark:text-amber-400">{disableBlockedReason}</span>
							</div>
						)}
						<Button
							variant="outline"
							size="sm"
							onClick={handleStartDisable}
							disabled={!canDisable}
							title={disableBlockedReason ?? undefined}
						>
							<ShieldOff className="mr-2 h-4 w-4" />
							{t('security.disableMfa')}
						</Button>
					</div>
				)}

				{state === 'confirming-disable' && (
					<div className="space-y-3 rounded-lg border border-destructive/50 bg-destructive/5 p-4">
						<p className="text-sm font-medium text-destructive">{t('security.confirmDisable')}</p>
						<p className="text-sm text-muted-foreground">
							{t('security.confirmDisableDescription')}
						</p>
						<p className="text-sm text-muted-foreground">{t('security.enterCodeToDisable')}</p>
						<Input
							type="text"
							inputMode="numeric"
							pattern="[0-9]*"
							maxLength={6}
							placeholder="000000"
							value={disableCode}
							onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
							className="w-32 text-center font-mono text-lg"
						/>
						{error && <p className="text-sm text-destructive">{error}</p>}
						<div className="flex gap-2">
							<Button
								onClick={handleDisableMfa}
								variant="destructive"
								disabled={disableCode.length !== 6}
							>
								{t('security.confirm')}
							</Button>
							<Button onClick={handleCancel} variant="ghost">
								{t('security.cancel')}
							</Button>
						</div>
					</div>
				)}

				{state === 'disabling' && (
					<div className="flex items-center gap-2 text-muted-foreground">
						<Loader2 className="h-4 w-4 animate-spin" />
						{t('security.disabling')}
					</div>
				)}
			</div>
		)
	}

	// MFA is not enabled - show setup flow
	return (
		<div className="space-y-4">
			{/* Challenge Dialog for identity verification */}
			<ChallengeDialog
				open={showChallengeDialog}
				require="identity"
				onSuccess={handleChallengeSuccess}
				onCancel={() => setShowChallengeDialog(false)}
				title={t('security.verifyIdentity')}
				description={t('security.verifyIdentityDescription')}
			/>

			<div className="flex items-center gap-3">
				<Shield className="h-5 w-5 text-muted-foreground" />
				<div>
					<p className="font-medium">{t('security.mfaDisabled')}</p>
					<p className="text-sm text-muted-foreground">{t('security.mfaDisabledDescription')}</p>
				</div>
			</div>

			{state === 'idle' && (
				<Button onClick={handleStartEnableMfa}>
					<Shield className="mr-2 h-4 w-4" />
					{t('security.enableMfa')}
				</Button>
			)}

			{state === 'enabling' && (
				<div className="flex items-center gap-2 text-muted-foreground">
					<Loader2 className="h-4 w-4 animate-spin" />
					{t('security.generatingQr')}
				</div>
			)}

			{state === 'verifying' && totpUri && (
				<div className="space-y-4 rounded-lg border p-4">
					<div>
						<p className="mb-2 font-medium">{t('security.scanQrCode')}</p>
						<p className="mb-4 text-sm text-muted-foreground">
							{t('security.scanQrCodeDescription')}
						</p>

						{/* QR Code - generated client-side for security */}
						<div className="mb-4 flex justify-center">
							<div className="rounded-lg bg-white p-4">
								{qrCodeDataUrl ? (
									// biome-ignore lint/a11y/useAltText: Decorative QR code with manual entry fallback
									// biome-ignore lint/performance/noImgElement: Data URL cannot use Next.js Image optimization
									<img src={qrCodeDataUrl} className="h-48 w-48" />
								) : (
									<div className="flex h-48 w-48 items-center justify-center">
										<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
									</div>
								)}
							</div>
						</div>

						{/* Manual entry */}
						<details className="text-sm">
							<summary className="cursor-pointer text-muted-foreground hover:text-foreground">
								{t('security.cantScanQr')}
							</summary>
							<code className="mt-2 block break-all rounded bg-muted p-2 text-xs">{totpUri}</code>
						</details>
					</div>

					<div className="space-y-2">
						<p className="text-sm font-medium">{t('security.enterVerificationCode')}</p>
						<div className="flex gap-2">
							<Input
								type="text"
								inputMode="numeric"
								pattern="[0-9]*"
								maxLength={6}
								placeholder="000000"
								value={verificationCode}
								onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
								className="w-32 text-center font-mono text-lg"
							/>
							<Button onClick={handleVerifyMfa} disabled={verifyAndActivateMutation.isPending}>
								{verifyAndActivateMutation.isPending ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									t('security.verify')
								)}
							</Button>
							<Button onClick={handleCancel} variant="ghost">
								{t('security.cancel')}
							</Button>
						</div>
					</div>

					{error && <p className="text-sm text-destructive">{error}</p>}
				</div>
			)}

			{state === 'show-backup-codes' && backupCodes.length > 0 && (
				<div className="space-y-4 rounded-lg border p-4">
					{/* Success header */}
					<div className="flex items-center gap-3">
						<ShieldCheck className="h-6 w-6 text-green-500" />
						<div>
							<p className="font-medium text-green-600 dark:text-green-400">
								{t('security.mfaSetupComplete')}
							</p>
							<p className="text-sm text-muted-foreground">{t('security.saveBackupCodesNow')}</p>
						</div>
					</div>

					{/* Warning banner */}
					<div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
						<AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
						<div className="text-sm">
							<p className="font-medium text-amber-700 dark:text-amber-300">
								{t('security.backupCodesWarning')}
							</p>
							<p className="mt-1 text-muted-foreground">
								{t('security.backupCodesWarningDescription')}
							</p>
						</div>
					</div>

					{/* Backup codes grid */}
					<div className="rounded-lg border bg-muted/30 p-4">
						<div className="mb-3 flex items-center gap-2">
							<Key className="h-4 w-4 text-muted-foreground" />
							<span className="text-sm font-medium">{t('security.yourBackupCodes')}</span>
						</div>
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
							{backupCodes.map((code, i) => (
								<div
									key={i}
									className="flex items-center justify-center rounded-lg border bg-background px-3 py-2 font-mono text-sm"
								>
									{code}
								</div>
							))}
						</div>
					</div>

					{/* Action buttons */}
					<div className="flex flex-wrap gap-2">
						<Button variant="outline" size="sm" onClick={handleCopyCodes}>
							{copied ? (
								<>
									<Check className="mr-2 h-4 w-4 text-green-500" />
									{t('security.copied')}
								</>
							) : (
								<>
									<Copy className="mr-2 h-4 w-4" />
									{t('security.copyAll')}
								</>
							)}
						</Button>
						<Button variant="outline" size="sm" onClick={handleDownloadCodes}>
							<Download className="mr-2 h-4 w-4" />
							{t('security.download')}
						</Button>
					</div>

					{/* Complete setup button */}
					<div className="pt-2">
						<Button onClick={handleCompleteSetup} className="w-full">
							{t('security.iHaveSavedMyCodes')}
						</Button>
					</div>
				</div>
			)}

			{error && state === 'idle' && <p className="text-sm text-destructive">{error}</p>}
		</div>
	)
}
