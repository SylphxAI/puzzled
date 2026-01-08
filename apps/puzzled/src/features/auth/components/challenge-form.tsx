'use client'

import { AlertTriangle, CheckCircle2, KeyRound, Loader2, Mail, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Input } from '@/shared/components/ui'
import { cn } from '@/lib/utils'
import { trpc } from '@/trpc/client'

// ==================
// Types
// ==================

export type ChallengeRequirement = 'identity' | 'mfa' | 'both'
type IdentityMethod = 'password' | 'email'
type Step = 'identity' | 'mfa' | 'success'

export type ChallengeFormProps = {
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

// ==================
// Constants
// ==================

const SUCCESS_FEEDBACK_DURATION = 800

// ==================
// Component
// ==================

/**
 * ChallengeForm - Core verification form component
 *
 * Handles all verification scenarios:
 * - Identity verification (password OR email code)
 * - MFA verification (TOTP OR backup code)
 * - Combined verification (both required)
 *
 * This is the SSOT for all challenge UI. Used by:
 * - ChallengeDialog (modal wrapper)
 * - /challenge page (full page wrapper)
 */
export function ChallengeForm({
	require,
	onSuccess,
	onCancel,
	showCancel = false,
	className,
	autoFocus = true,
}: ChallengeFormProps) {
	// ==================
	// State
	// ==================

	// Current step in multi-step flow
	const [step, setStep] = useState<Step>(require === 'mfa' ? 'mfa' : 'identity')

	// Identity verification state
	const [identityMethod, setIdentityMethod] = useState<IdentityMethod>('password')
	const [password, setPassword] = useState('')
	const [emailCode, setEmailCode] = useState('')
	const [emailCodeSent, setEmailCodeSent] = useState(false)
	const [emailCountdown, setEmailCountdown] = useState(0)
	const [emailExpiryCountdown, setEmailExpiryCountdown] = useState(0)

	// MFA verification state
	const [mfaCode, setMfaCode] = useState('')
	const [useBackupCode, setUseBackupCode] = useState(false)

	// General state
	const [error, setError] = useState<string | null>(null)
	const [backupCodesRemaining, setBackupCodesRemaining] = useState<number | null>(null)

	// Refs
	const isMountedRef = useRef(true)
	const isSubmittingRef = useRef(false)
	const onSuccessRef = useRef(onSuccess)

	// ==================
	// Queries
	// ==================

	const { data: status, isLoading: statusLoading } = trpc.challenge.getStatus.useQuery(undefined, {
		refetchOnWindowFocus: true,
	})

	// ==================
	// Mutations
	// ==================

	const requestEmailCodeMutation = trpc.challenge.requestEmailCode.useMutation({
		onSuccess: (data) => {
			if (!isMountedRef.current) return
			setEmailCodeSent(true)
			setEmailCountdown(60)
			setEmailExpiryCountdown(data.expiresInSeconds)
			setError(null)
		},
		onError: (err) => {
			if (!isMountedRef.current) return
			setError(err.message)
		},
	})

	const verifyIdentityMutation = trpc.challenge.verifyIdentity.useMutation({
		onSuccess: () => {
			if (!isMountedRef.current) return
			setError(null)

			// For 'both' requirement: only proceed to MFA if user has 2FA enabled
			if (require === 'both' && status?.userHas2FA) {
				setStep('mfa')
			} else {
				// Identity only, or 'both' but user doesn't have 2FA
				setStep('success')
				setTimeout(() => {
					if (isMountedRef.current) {
						onSuccessRef.current()
					}
				}, SUCCESS_FEEDBACK_DURATION)
			}
		},
		onError: (err) => {
			if (!isMountedRef.current) return
			setError(err.message)
		},
	})

	const verifyMfaMutation = trpc.challenge.verifyMfa.useMutation({
		onSuccess: (data) => {
			if (!isMountedRef.current) return
			setError(null)

			if (data.method === 'backup' && data.remainingBackupCodes !== undefined) {
				setBackupCodesRemaining(data.remainingBackupCodes)
			}

			setStep('success')
			setTimeout(() => {
				if (isMountedRef.current) {
					onSuccessRef.current()
				}
			}, SUCCESS_FEEDBACK_DURATION)
		},
		onError: (err) => {
			if (!isMountedRef.current) return
			setError(err.message)
		},
	})

	// ==================
	// Effects
	// ==================

	// Keep callback ref updated
	useEffect(() => {
		onSuccessRef.current = onSuccess
	}, [onSuccess])

	// Cleanup on unmount
	useEffect(() => {
		isMountedRef.current = true
		return () => {
			isMountedRef.current = false
		}
	}, [])

	// Email countdown timer
	useEffect(() => {
		if (emailCountdown > 0) {
			const timer = setTimeout(() => setEmailCountdown(emailCountdown - 1), 1000)
			return () => clearTimeout(timer)
		}
	}, [emailCountdown])

	// Email expiry countdown
	useEffect(() => {
		if (emailExpiryCountdown > 0) {
			const timer = setTimeout(() => setEmailExpiryCountdown(emailExpiryCountdown - 1), 1000)
			return () => clearTimeout(timer)
		}
	}, [emailExpiryCountdown])

	// Auto-select method based on available methods
	useEffect(() => {
		if (status && !status.userHasPassword) {
			setIdentityMethod('email')
		}
	}, [status])

	// ==================
	// Handlers
	// ==================

	const handleRequestEmailCode = useCallback(() => {
		if (requestEmailCodeMutation.isPending) return
		requestEmailCodeMutation.mutate()
	}, [requestEmailCodeMutation])

	const handleVerifyIdentity = useCallback(() => {
		if (isSubmittingRef.current || verifyIdentityMutation.isPending) return
		isSubmittingRef.current = true

		const credential = identityMethod === 'password' ? password : emailCode
		if (!credential) {
			setError(identityMethod === 'password' ? 'Please enter your password' : 'Please enter the verification code')
			isSubmittingRef.current = false
			return
		}

		verifyIdentityMutation.mutate(
			{ method: identityMethod, credential },
			{ onSettled: () => { isSubmittingRef.current = false } },
		)
	}, [identityMethod, password, emailCode, verifyIdentityMutation])

	const handleVerifyMfa = useCallback(() => {
		if (isSubmittingRef.current || verifyMfaMutation.isPending) return
		isSubmittingRef.current = true

		const code = mfaCode.trim()
		if (!code) {
			setError('Please enter your verification code')
			isSubmittingRef.current = false
			return
		}

		// Validation
		if (useBackupCode) {
			if (code.length !== 11 || !code.includes('-')) {
				setError('Backup code must be in format XXXXX-XXXXX')
				isSubmittingRef.current = false
				return
			}
		} else {
			if (code.length !== 6 || !/^\d{6}$/.test(code)) {
				setError('Verification code must be 6 digits')
				isSubmittingRef.current = false
				return
			}
		}

		verifyMfaMutation.mutate(
			{ code },
			{ onSettled: () => { isSubmittingRef.current = false } },
		)
	}, [mfaCode, useBackupCode, verifyMfaMutation])

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'Enter') {
				if (step === 'identity') {
					handleVerifyIdentity()
				} else if (step === 'mfa') {
					handleVerifyMfa()
				}
			}
		},
		[step, handleVerifyIdentity, handleVerifyMfa],
	)

	// ==================
	// Computed values
	// ==================

	const isLoading = statusLoading
	const isPending = verifyIdentityMutation.isPending || verifyMfaMutation.isPending || requestEmailCodeMutation.isPending

	// ==================
	// Render: Loading
	// ==================

	if (isLoading) {
		return (
			<div className={cn('flex items-center justify-center py-8', className)}>
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		)
	}

	// ==================
	// Render: Success
	// ==================

	if (step === 'success') {
		return (
			<div className={cn('space-y-4 text-center py-4', className)}>
				<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
					<ShieldCheck className="h-8 w-8 text-green-600" />
				</div>
				<div>
					<p className="font-medium text-green-600">Verification Successful</p>
					{backupCodesRemaining !== null && (
						<p className="mt-2 text-sm text-amber-600">
							{backupCodesRemaining} backup codes remaining
						</p>
					)}
				</div>
				<div className="flex items-center justify-center gap-2 text-muted-foreground">
					<Loader2 className="h-4 w-4 animate-spin" />
					<span className="text-sm">Redirecting...</span>
				</div>
			</div>
		)
	}

	// ==================
	// Render: Identity Step
	// ==================

	if (step === 'identity') {
		const hasPassword = status?.userHasPassword ?? false

		return (
			<div className={cn('space-y-4', className)}>
				{/* Method selection (only if user has password) */}
				{hasPassword && (
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => { setIdentityMethod('password'); setError(null) }}
							className={cn(
								'flex-1 rounded-lg border p-3 text-sm transition-colors',
								identityMethod === 'password'
									? 'border-primary bg-primary/5 text-primary'
									: 'border-border hover:border-primary/50'
							)}
						>
							<KeyRound className="mx-auto mb-1 h-5 w-5" />
							Password
						</button>
						<button
							type="button"
							onClick={() => { setIdentityMethod('email'); setError(null) }}
							className={cn(
								'flex-1 rounded-lg border p-3 text-sm transition-colors',
								identityMethod === 'email'
									? 'border-primary bg-primary/5 text-primary'
									: 'border-border hover:border-primary/50'
							)}
						>
							<Mail className="mx-auto mb-1 h-5 w-5" />
							Email Code
						</button>
					</div>
				)}

				{/* Password input */}
				{identityMethod === 'password' && (
					<div className="space-y-2">
						<label htmlFor="challenge-password" className="text-sm font-medium">
							Enter your password
						</label>
						<Input
							id="challenge-password"
							type="password"
							value={password}
							onChange={(e) => { setPassword(e.target.value); setError(null) }}
							onKeyDown={handleKeyDown}
							placeholder="••••••••"
							autoComplete="current-password"
							disabled={isPending}
							autoFocus={autoFocus}
						/>
					</div>
				)}

				{/* Email code input */}
				{identityMethod === 'email' && (
					<div className="space-y-3">
						{!emailCodeSent ? (
							<>
								<p className="text-sm text-muted-foreground">
									We'll send a verification code to your email address.
								</p>
								<Button
									onClick={handleRequestEmailCode}
									disabled={isPending}
									className="w-full"
								>
									{requestEmailCodeMutation.isPending ? (
										<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
									) : (
										<><Mail className="mr-2 h-4 w-4" />Send Code</>
									)}
								</Button>
							</>
						) : (
							<>
								<label htmlFor="challenge-email-code" className="text-sm font-medium">
									Enter the 6-digit code sent to your email
								</label>
								<Input
									id="challenge-email-code"
									type="text"
									inputMode="numeric"
									pattern="[0-9]*"
									maxLength={6}
									value={emailCode}
									onChange={(e) => { setEmailCode(e.target.value.replace(/\D/g, '')); setError(null) }}
									onKeyDown={handleKeyDown}
									placeholder="000000"
									className="text-center font-mono text-lg tracking-widest"
									disabled={isPending}
									autoFocus={autoFocus}
								/>
								{emailExpiryCountdown > 0 && (
									<p className="text-xs text-muted-foreground text-center">
										Code expires in {Math.floor(emailExpiryCountdown / 60)}:{String(emailExpiryCountdown % 60).padStart(2, '0')}
									</p>
								)}
								{emailCountdown === 0 && (
									<button
										type="button"
										onClick={handleRequestEmailCode}
										className="text-sm text-primary hover:underline w-full text-center"
										disabled={isPending}
									>
										Resend code
									</button>
								)}
							</>
						)}
					</div>
				)}

				{/* Error */}
				{error && (
					<div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
						<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
						<p className="text-sm text-destructive">{error}</p>
					</div>
				)}

				{/* Actions */}
				{(identityMethod === 'password' || emailCodeSent) && (
					<div className="flex flex-col gap-2">
						<Button
							onClick={handleVerifyIdentity}
							disabled={isPending || (identityMethod === 'password' ? !password : !emailCode)}
							className="w-full"
						>
							{verifyIdentityMutation.isPending ? (
								<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</>
							) : require === 'both' ? (
								'Continue'
							) : (
								'Verify'
							)}
						</Button>
						{showCancel && onCancel && (
							<Button variant="ghost" onClick={onCancel} disabled={isPending} className="w-full">
								Cancel
							</Button>
						)}
					</div>
				)}

				{/* Step indicator for 'both' requirement */}
				{require === 'both' && (
					<div className="flex justify-center gap-2 pt-2">
						<div className="h-2 w-2 rounded-full bg-primary" />
						<div className="h-2 w-2 rounded-full bg-muted" />
					</div>
				)}
			</div>
		)
	}

	// ==================
	// Render: MFA Step
	// ==================

	if (!status?.userHas2FA) {
		return (
			<div className={cn('space-y-4 text-center', className)}>
				<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
					<AlertTriangle className="h-6 w-6 text-amber-600" />
				</div>
				<div>
					<p className="font-medium">Two-Factor Authentication Required</p>
					<p className="mt-1 text-sm text-muted-foreground">
						You need to enable 2FA before you can access this feature.
					</p>
				</div>
				{onCancel && (
					<Button variant="outline" onClick={onCancel}>
						Go to Settings
					</Button>
				)}
			</div>
		)
	}

	return (
		<div className={cn('space-y-4', className)}>
			{require === 'both' && (
				<div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-700 dark:text-green-400">
					<CheckCircle2 className="h-4 w-4" />
					<span>Identity verified. Now verify your authenticator.</span>
				</div>
			)}

			<div className="space-y-2">
				<label htmlFor="challenge-mfa-code" className="text-sm font-medium">
					{useBackupCode ? 'Enter backup code' : 'Enter authenticator code'}
				</label>
				<Input
					id="challenge-mfa-code"
					type="text"
					inputMode={useBackupCode ? 'text' : 'numeric'}
					maxLength={useBackupCode ? 11 : 6}
					value={mfaCode}
					onChange={(e) => {
						const value = useBackupCode
							? e.target.value.toUpperCase()
							: e.target.value.replace(/\D/g, '')
						setMfaCode(value)
						setError(null)
					}}
					onKeyDown={handleKeyDown}
					placeholder={useBackupCode ? 'XXXXX-XXXXX' : '000000'}
					className="text-center font-mono text-lg tracking-widest"
					disabled={isPending}
					autoFocus={autoFocus}
				/>
			</div>

			{/* Toggle backup code option */}
			<button
				type="button"
				onClick={() => { setUseBackupCode(!useBackupCode); setMfaCode(''); setError(null) }}
				className="text-sm text-muted-foreground hover:text-foreground w-full text-center"
			>
				{useBackupCode ? 'Use authenticator app instead' : "Lost access? Use a backup code"}
			</button>

			{/* Error */}
			{error && (
				<div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
					<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
					<p className="text-sm text-destructive">{error}</p>
				</div>
			)}

			{/* Actions */}
			<div className="flex flex-col gap-2">
				<Button
					onClick={handleVerifyMfa}
					disabled={isPending || !mfaCode}
					className="w-full"
				>
					{verifyMfaMutation.isPending ? (
						<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</>
					) : (
						'Verify'
					)}
				</Button>
				{showCancel && onCancel && (
					<Button variant="ghost" onClick={onCancel} disabled={isPending} className="w-full">
						Cancel
					</Button>
				)}
			</div>

			{/* Step indicator for 'both' requirement */}
			{require === 'both' && (
				<div className="flex justify-center gap-2 pt-2">
					<div className="h-2 w-2 rounded-full bg-green-500" />
					<div className="h-2 w-2 rounded-full bg-primary" />
				</div>
			)}
		</div>
	)
}
