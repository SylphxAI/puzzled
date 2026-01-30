/**
 * Security Settings Component
 *
 * Full security management: 2FA setup, password change, active sessions, login history.
 * Self-contained with CSS-in-JS styles.
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ThemeVariables } from './styles'
import {
	defaultTheme,
	baseStyles,
	mergeStyles,
	injectGlobalStyles,
} from './styles'
import { useUserContext, useSecurityContext } from '../services-context'

interface TwoFactorStatus {
	enabled: boolean
	enabledAt?: string
	method?: 'totp' | 'sms'
}

interface ActiveSession {
	id: string
	current: boolean
	device: string
	browser: string
	ip: string
	location?: string
	lastActive?: string
	createdAt?: string
}

interface LoginHistoryEntry {
	id: string
	ip: string
	device: string
	browser: string
	location?: string
	success: boolean
	createdAt: string
}

export interface SecuritySettingsProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Called on successful update */
	onSuccess?: (message: string) => void
	/** Called on error */
	onError?: (error: string) => void
	/** Custom class name */
	className?: string
	/** Show 2FA section */
	show2FA?: boolean
	/** Show password section */
	showPassword?: boolean
	/** Show sessions section */
	showSessions?: boolean
	/** Show login history */
	showLoginHistory?: boolean
}

/**
 * Full security settings component
 *
 * @example
 * ```tsx
 * <SecuritySettings
 *   onSuccess={(msg) => toast.success(msg)}
 *   onError={(msg) => toast.error(msg)}
 * />
 * ```
 */
export function SecuritySettings({
	theme = defaultTheme,
	onSuccess,
	onError,
	className,
	show2FA = true,
	showPassword = true,
	showSessions = true,
	showLoginHistory = true,
}: SecuritySettingsProps) {
	const userContext = useUserContext()
	const securityContext = useSecurityContext()
	const queryClient = useQueryClient()
	const styles = baseStyles(theme)

	// UI state for messages
	const [error, setError] = useState<string | null>(null)
	const [success, setSuccess] = useState<string | null>(null)

	// 2FA setup UI state
	const [showSetup2FA, setShowSetup2FA] = useState(false)
	const [totpSecret, setTotpSecret] = useState<string | null>(null)
	const [totpQrCode, setTotpQrCode] = useState<string | null>(null)
	const [verifyCode, setVerifyCode] = useState('')

	// Password change UI state
	const [showPasswordChange, setShowPasswordChange] = useState(false)
	const [currentPassword, setCurrentPassword] = useState('')
	const [newPassword, setNewPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')

	// Inject global styles
	useEffect(() => {
		injectGlobalStyles()
	}, [])

	// React Query for 2FA status
	const twoFactorQuery = useQuery({
		queryKey: ['sylphx', 'security', '2fa-status'],
		queryFn: async () => {
			const data = await securityContext.getTwoFactorStatus()
			return {
				enabled: data.enabled,
				method: data.enabled ? 'totp' as const : undefined,
			}
		},
		enabled: show2FA,
		staleTime: 5 * 60 * 1000, // 5 min
	})

	// React Query for sessions
	const sessionsQuery = useQuery({
		queryKey: ['sylphx', 'security', 'sessions'],
		queryFn: async () => {
			const data = await userContext.getSessions()
			return data.map(s => ({
				id: s.id,
				current: s.isCurrent ?? false,
				device: s.deviceType || s.device || 'Unknown',
				browser: s.browser || 'Unknown',
				ip: s.ipAddress || 'Unknown',
				location: s.city && s.country ? `${s.city}, ${s.country}` : (s.location || s.country || undefined),
				lastActive: s.lastActiveAt || s.createdAt,
				createdAt: s.createdAt,
			}))
		},
		enabled: showSessions,
		staleTime: 60 * 1000, // 1 min - sessions can change
	})

	// React Query for login history
	const loginHistoryQuery = useQuery({
		queryKey: ['sylphx', 'security', 'login-history'],
		queryFn: async () => {
			const data = await userContext.getLoginHistory({ limit: 10 })
			return data.map(h => ({
				id: h.id,
				ip: h.ipAddress || 'Unknown',
				device: h.device || 'Unknown',
				browser: h.browser || 'Unknown',
				location: h.location ?? undefined,
				success: h.successful,
				createdAt: h.loginAt.toISOString(),
			}))
		},
		enabled: showLoginHistory,
		staleTime: 60 * 1000, // 1 min
	})

	// Derived state from queries
	const twoFactor = twoFactorQuery.data ?? { enabled: false }
	const sessions = sessionsQuery.data ?? []
	const loginHistory = loginHistoryQuery.data ?? []
	const isLoading = twoFactorQuery.isLoading || sessionsQuery.isLoading || loginHistoryQuery.isLoading

	// Combined query error
	const queryError = twoFactorQuery.error || sessionsQuery.error || loginHistoryQuery.error
	useEffect(() => {
		if (queryError) {
			const message = queryError instanceof Error ? queryError.message : 'Failed to load security settings'
			setError(message)
			onError?.(message)
		}
	}, [queryError, onError])

	// Clear messages after timeout
	useEffect(() => {
		if (success || error) {
			const timer = setTimeout(() => {
				setSuccess(null)
				setError(null)
			}, 5000)
			return () => clearTimeout(timer)
		}
	}, [success, error])

	// Mutation: Start 2FA setup
	const setup2FAMutation = useMutation({
		mutationFn: () => securityContext.twoFactorSetup(),
		onSuccess: (data) => {
			setTotpSecret(data.secret)
			setTotpQrCode((data as { uri?: string }).uri ?? null)
			setShowSetup2FA(true)
		},
		onError: (err) => {
			const message = err instanceof Error ? err.message : 'Failed to start 2FA setup'
			setError(message)
			onError?.(message)
		},
	})

	// Mutation: Enable 2FA (verify code)
	const enable2FAMutation = useMutation({
		mutationFn: (code: string) => securityContext.twoFactorVerify(code),
		onSuccess: () => {
			queryClient.setQueryData(['sylphx', 'security', '2fa-status'], { enabled: true, method: 'totp' })
			setShowSetup2FA(false)
			setVerifyCode('')
			setSuccess('Two-factor authentication enabled')
			onSuccess?.('Two-factor authentication enabled')
		},
		onError: (err) => {
			const message = err instanceof Error ? err.message : 'Invalid verification code'
			setError(message)
			onError?.(message)
		},
	})

	// Mutation: Disable 2FA
	const disable2FAMutation = useMutation({
		mutationFn: (code: string) => securityContext.twoFactorDisable(code),
		onSuccess: () => {
			queryClient.setQueryData(['sylphx', 'security', '2fa-status'], { enabled: false })
			setSuccess('Two-factor authentication disabled')
			onSuccess?.('Two-factor authentication disabled')
		},
		onError: (err) => {
			const message = err instanceof Error ? err.message : 'Failed to disable 2FA'
			setError(message)
			onError?.(message)
		},
	})

	// Mutation: Change password
	const changePasswordMutation = useMutation({
		mutationFn: ({ current, newPwd }: { current: string; newPwd: string }) =>
			userContext.changePassword(current, newPwd),
		onSuccess: () => {
			setShowPasswordChange(false)
			setCurrentPassword('')
			setNewPassword('')
			setConfirmPassword('')
			setSuccess('Password changed successfully')
			onSuccess?.('Password changed successfully')
		},
		onError: (err) => {
			const message = err instanceof Error ? err.message : 'Failed to change password'
			setError(message)
			onError?.(message)
		},
	})

	// Mutation: Revoke session
	const revokeSessionMutation = useMutation({
		mutationFn: (sessionId: string) => userContext.revokeSession(sessionId),
		onSuccess: (_data, sessionId) => {
			queryClient.setQueryData<ActiveSession[]>(['sylphx', 'security', 'sessions'], (prev) =>
				prev?.filter((s) => s.id !== sessionId) ?? []
			)
			setSuccess('Session revoked')
			onSuccess?.('Session revoked')
		},
		onError: (err) => {
			const message = err instanceof Error ? err.message : 'Failed to revoke session'
			setError(message)
			onError?.(message)
		},
	})

	// Mutation: Revoke all sessions
	const revokeAllSessionsMutation = useMutation({
		mutationFn: () => userContext.revokeAllSessions(),
		onSuccess: () => {
			queryClient.setQueryData<ActiveSession[]>(['sylphx', 'security', 'sessions'], (prev) =>
				prev?.filter((s) => s.current) ?? []
			)
			setSuccess('All other sessions revoked')
			onSuccess?.('All other sessions revoked')
		},
		onError: (err) => {
			const message = err instanceof Error ? err.message : 'Failed to revoke sessions'
			setError(message)
			onError?.(message)
		},
	})

	// Handler: Start 2FA setup
	const handleStart2FASetup = useCallback(() => {
		setup2FAMutation.mutate()
	}, [setup2FAMutation])

	// Handler: Enable 2FA
	const handleEnable2FA = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault()
			if (!verifyCode || verifyCode.length !== 6) {
				setError('Please enter a 6-digit code')
				return
			}
			enable2FAMutation.mutate(verifyCode)
		},
		[verifyCode, enable2FAMutation]
	)

	// Handler: Disable 2FA
	const handleDisable2FA = useCallback(() => {
		const code = prompt('Enter your 2FA code to disable two-factor authentication:')
		if (!code) return
		disable2FAMutation.mutate(code)
	}, [disable2FAMutation])

	// Handler: Change password
	const handlePasswordChange = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault()

			if (newPassword !== confirmPassword) {
				setError('Passwords do not match')
				return
			}

			if (newPassword.length < 8) {
				setError('Password must be at least 8 characters')
				return
			}

			changePasswordMutation.mutate({ current: currentPassword, newPwd: newPassword })
		},
		[newPassword, confirmPassword, currentPassword, changePasswordMutation]
	)

	// Handler: Revoke session
	const handleRevokeSession = useCallback(
		(sessionId: string) => {
			revokeSessionMutation.mutate(sessionId)
		},
		[revokeSessionMutation]
	)

	// Handler: Revoke all sessions
	const handleRevokeAllSessions = useCallback(() => {
		if (!confirm('Are you sure you want to sign out all other devices?')) {
			return
		}
		revokeAllSessionsMutation.mutate()
	}, [revokeAllSessionsMutation])

	// Derived loading states for UI
	const isEnabling2FA = enable2FAMutation.isPending
	const isChangingPassword = changePasswordMutation.isPending

	const cardStyles: React.CSSProperties = mergeStyles(styles.card, {
		padding: '1rem',
		marginBottom: '1rem',
	})

	if (isLoading) {
		return (
			<div style={mergeStyles(styles.flexCenter, { padding: '3rem' })} className={className}>
				<span style={mergeStyles(styles.spinner, { width: '2rem', height: '2rem' })} />
			</div>
		)
	}

	return (
		<div className={className}>
			{/* Alerts */}
			{success && (
				<div style={mergeStyles(styles.alert, styles.alertSuccess, styles.mb4)}>
					{success}
				</div>
			)}
			{error && (
				<div style={mergeStyles(styles.alert, styles.alertError, styles.mb4)}>
					{error}
				</div>
			)}

			{/* Two-Factor Authentication */}
			{show2FA && (
				<div style={cardStyles}>
					<div style={styles.flexBetween}>
						<div>
							<h4 style={{ margin: 0, fontWeight: 500 }}>Two-Factor Authentication</h4>
							<p style={mergeStyles(styles.textSm, styles.textMuted, { margin: '0.25rem 0 0' })}>
								Add an extra layer of security to your account
							</p>
						</div>
						{twoFactor.enabled ? (
							<span
								style={mergeStyles(styles.badge, styles.badgeSuccess)}
							>
								Enabled
							</span>
						) : (
							<span
								style={mergeStyles(styles.badge, {
									backgroundColor: theme.colorMuted,
									color: theme.colorMutedForeground,
								})}
							>
								Not enabled
							</span>
						)}
					</div>

					{!twoFactor.enabled && !showSetup2FA && (
						<button
							type="button"
							onClick={handleStart2FASetup}
							style={mergeStyles(styles.button, styles.buttonPrimary, { marginTop: '1rem' })}
						>
							<ShieldIcon size={16} />
							Enable 2FA
						</button>
					)}

					{twoFactor.enabled && (
						<button
							type="button"
							onClick={handleDisable2FA}
							style={mergeStyles(styles.button, styles.buttonDestructive, { marginTop: '1rem' })}
						>
							Disable 2FA
						</button>
					)}

					{/* 2FA Setup Flow */}
					{showSetup2FA && totpQrCode && (
						<div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: `1px solid ${theme.colorBorder}` }}>
							<h5 style={{ margin: '0 0 0.5rem', fontWeight: 500 }}>Setup Instructions</h5>
							<ol style={mergeStyles(styles.textSm, { paddingLeft: '1.25rem', margin: '0 0 1rem', color: theme.colorMutedForeground })}>
								<li>Download an authenticator app (Google Authenticator, Authy, etc.)</li>
								<li>Scan the QR code below or enter the secret key</li>
								<li>Enter the 6-digit code from the app</li>
							</ol>

							<div style={mergeStyles(styles.flexCenter, { marginBottom: '1rem' })}>
								<img
									src={totpQrCode}
									alt="2FA QR Code"
									style={{ width: '160px', height: '160px', border: `1px solid ${theme.colorBorder}`, borderRadius: theme.borderRadius }}
								/>
							</div>

							{totpSecret && (
								<div style={{ marginBottom: '1rem' }}>
									<p style={mergeStyles(styles.textSm, styles.textMuted, { margin: '0 0 0.25rem' })}>
										Or enter this secret manually:
									</p>
									<code
										style={{
											display: 'block',
											padding: '0.5rem',
											backgroundColor: theme.colorMuted,
											borderRadius: theme.borderRadiusSm,
											fontSize: theme.fontSizeSm,
											fontFamily: 'monospace',
											wordBreak: 'break-all',
										}}
									>
										{totpSecret}
									</code>
								</div>
							)}

							<form onSubmit={handleEnable2FA}>
								<div style={styles.formGroup}>
									<label style={styles.label}>Verification Code</label>
									<input
										type="text"
										value={verifyCode}
										onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
										placeholder="000000"
										maxLength={6}
										style={mergeStyles(styles.input, { textAlign: 'center', letterSpacing: '0.5em', fontSize: theme.fontSizeLg })}
									/>
								</div>
								<div style={mergeStyles(styles.flexRow, { gap: '0.5rem' })}>
									<button
										type="submit"
										disabled={isEnabling2FA || verifyCode.length !== 6}
										style={mergeStyles(
											styles.button,
											styles.buttonPrimary,
											(isEnabling2FA || verifyCode.length !== 6) ? styles.buttonDisabled : {}
										)}
									>
										{isEnabling2FA ? (
											<>
												<span style={styles.spinner} />
												Verifying...
											</>
										) : (
											'Verify & Enable'
										)}
									</button>
									<button
										type="button"
										onClick={() => {
											setShowSetup2FA(false)
											setVerifyCode('')
										}}
										style={mergeStyles(styles.button, styles.buttonOutline)}
									>
										Cancel
									</button>
								</div>
							</form>
						</div>
					)}
				</div>
			)}

			{/* Password */}
			{showPassword && (
				<div style={cardStyles}>
					<div style={styles.flexBetween}>
						<div>
							<h4 style={{ margin: 0, fontWeight: 500 }}>Password</h4>
							<p style={mergeStyles(styles.textSm, styles.textMuted, { margin: '0.25rem 0 0' })}>
								Change your account password
							</p>
						</div>
						{!showPasswordChange && (
							<button
								type="button"
								onClick={() => setShowPasswordChange(true)}
								style={mergeStyles(styles.button, styles.buttonOutline)}
							>
								Change
							</button>
						)}
					</div>

					{showPasswordChange && (
						<form onSubmit={handlePasswordChange} style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${theme.colorBorder}` }}>
							<div style={styles.formGroup}>
								<label style={styles.label}>Current Password</label>
								<input
									type="password"
									value={currentPassword}
									onChange={(e) => setCurrentPassword(e.target.value)}
									required
									style={styles.input}
								/>
							</div>
							<div style={styles.formGroup}>
								<label style={styles.label}>New Password</label>
								<input
									type="password"
									value={newPassword}
									onChange={(e) => setNewPassword(e.target.value)}
									minLength={8}
									required
									style={styles.input}
								/>
							</div>
							<div style={styles.formGroup}>
								<label style={styles.label}>Confirm New Password</label>
								<input
									type="password"
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									minLength={8}
									required
									style={styles.input}
								/>
							</div>
							<div style={mergeStyles(styles.flexRow, { gap: '0.5rem' })}>
								<button
									type="submit"
									disabled={isChangingPassword}
									style={mergeStyles(styles.button, styles.buttonPrimary, isChangingPassword ? styles.buttonDisabled : {})}
								>
									{isChangingPassword ? (
										<>
											<span style={styles.spinner} />
											Changing...
										</>
									) : (
										'Change Password'
									)}
								</button>
								<button
									type="button"
									onClick={() => {
										setShowPasswordChange(false)
										setCurrentPassword('')
										setNewPassword('')
										setConfirmPassword('')
									}}
									style={mergeStyles(styles.button, styles.buttonOutline)}
								>
									Cancel
								</button>
							</div>
						</form>
					)}
				</div>
			)}

			{/* Active Sessions */}
			{showSessions && (
				<div style={cardStyles}>
					<div style={styles.flexBetween}>
						<div>
							<h4 style={{ margin: 0, fontWeight: 500 }}>Active Sessions</h4>
							<p style={mergeStyles(styles.textSm, styles.textMuted, { margin: '0.25rem 0 0' })}>
								{sessions.length} active session{sessions.length !== 1 ? 's' : ''}
							</p>
						</div>
						{sessions.length > 1 && (
							<button
								type="button"
								onClick={handleRevokeAllSessions}
								style={mergeStyles(styles.button, styles.buttonOutline)}
							>
								Sign Out All Others
							</button>
						)}
					</div>

					<div style={{ marginTop: '1rem' }}>
						{sessions.map((session) => (
							<div
								key={session.id}
								style={{
									padding: '0.75rem',
									backgroundColor: session.current ? `${theme.colorPrimary}08` : 'transparent',
									borderRadius: theme.borderRadiusSm,
									marginBottom: '0.5rem',
									border: session.current ? `1px solid ${theme.colorPrimary}30` : `1px solid ${theme.colorBorder}`,
								}}
							>
								<div style={styles.flexBetween}>
									<div style={mergeStyles(styles.flexRow, { gap: '0.75rem', alignItems: 'flex-start' })}>
										<DeviceIcon device={session.device} theme={theme} />
										<div>
											<div style={mergeStyles(styles.flexRow, { gap: '0.5rem', alignItems: 'center' })}>
												<span style={{ fontWeight: 500, fontSize: theme.fontSizeSm }}>
													{session.browser} on {session.device}
												</span>
												{session.current && (
													<span style={mergeStyles(styles.badge, styles.badgePrimary)}>
														Current
													</span>
												)}
											</div>
											<div style={mergeStyles(styles.textXs, styles.textMuted, { marginTop: '0.25rem' })}>
												{session.location && `${session.location} · `}
												{session.ip} · Last active {session.lastActive ? formatTimeAgo(session.lastActive) : 'Unknown'}
											</div>
										</div>
									</div>
									{!session.current && (
										<button
											type="button"
											onClick={() => handleRevokeSession(session.id)}
											style={mergeStyles(styles.button, styles.buttonGhost, { color: theme.colorDestructive })}
										>
											Revoke
										</button>
									)}
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Login History */}
			{showLoginHistory && loginHistory.length > 0 && (
				<div style={cardStyles}>
					<h4 style={{ margin: '0 0 1rem', fontWeight: 500 }}>Recent Login Activity</h4>
					<div style={{ maxHeight: '300px', overflowY: 'auto' }}>
						{loginHistory.slice(0, 10).map((entry) => (
							<div
								key={entry.id}
								style={{
									padding: '0.5rem 0',
									borderBottom: `1px solid ${theme.colorBorder}`,
									display: 'flex',
									alignItems: 'center',
									gap: '0.75rem',
								}}
							>
								<div
									style={{
										width: '8px',
										height: '8px',
										borderRadius: '50%',
										backgroundColor: entry.success ? theme.colorSuccess : theme.colorDestructive,
									}}
								/>
								<div style={{ flex: 1 }}>
									<div style={{ fontSize: theme.fontSizeSm }}>
										{entry.browser} on {entry.device}
									</div>
									<div style={mergeStyles(styles.textXs, styles.textMuted)}>
										{entry.location && `${entry.location} · `}
										{entry.ip} · {formatTimeAgo(entry.createdAt)}
									</div>
								</div>
								<span
									style={mergeStyles(
										styles.badge,
										entry.success ? styles.badgeSuccess : styles.badgeDestructive
									)}
								>
									{entry.success ? 'Success' : 'Failed'}
								</span>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	)
}

// Helper functions
function formatTimeAgo(dateString: string): string {
	const date = new Date(dateString)
	const now = new Date()
	const diffMs = now.getTime() - date.getTime()
	const diffMins = Math.floor(diffMs / 60000)
	const diffHours = Math.floor(diffMs / 3600000)
	const diffDays = Math.floor(diffMs / 86400000)

	if (diffMins < 1) return 'just now'
	if (diffMins < 60) return `${diffMins}m ago`
	if (diffHours < 24) return `${diffHours}h ago`
	if (diffDays < 7) return `${diffDays}d ago`
	return date.toLocaleDateString()
}

// Icons
function ShieldIcon({ size = 24 }: { size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
		</svg>
	)
}

function DeviceIcon({ device, theme }: { device: string; theme: ThemeVariables }) {
	const isMobile = device.toLowerCase().includes('mobile') || device.toLowerCase().includes('phone')

	if (isMobile) {
		return (
			<svg
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke={theme.colorMutedForeground}
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
				<line x1="12" y1="18" x2="12.01" y2="18" />
			</svg>
		)
	}

	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke={theme.colorMutedForeground}
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
			<line x1="8" y1="21" x2="16" y2="21" />
			<line x1="12" y1="17" x2="12" y2="21" />
		</svg>
	)
}
