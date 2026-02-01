/**
 * API Key Manager Components
 *
 * Create, view, and revoke API keys.
 */

'use client'

import { useState, useEffect, type CSSProperties, type FormEvent } from 'react'
import type { ThemeVariables } from './styles'
import { defaultTheme, baseStyles, mergeStyles, injectGlobalStyles } from './styles'
import {
	UI_COPY_FEEDBACK_MS,
	API_KEY_EXPIRY_1_DAY,
	API_KEY_EXPIRY_7_DAYS,
	API_KEY_EXPIRY_30_DAYS,
	API_KEY_EXPIRY_90_DAYS,
	API_KEY_EXPIRY_1_YEAR,
} from '../../constants'

// ============================================
// Types
// ============================================

export interface APIKey {
	id: string
	name: string
	prefix: string // First few chars for identification (e.g., "sk_live_abc")
	createdAt: string
	lastUsedAt?: string
	expiresAt?: string
	scopes?: string[]
	environment?: 'development' | 'staging' | 'production'
}

export interface NewAPIKey extends APIKey {
	/** Full key (only shown once at creation) */
	key: string
}

// ============================================
// APIKeyManager
// ============================================

export interface APIKeyManagerProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Custom class name */
	className?: string
	/** API keys to display */
	apiKeys?: APIKey[]
	/** Available scopes */
	availableScopes?: string[]
	/** Called when key is created */
	onCreate?: (data: { name: string; scopes: string[]; expiresIn?: number }) => Promise<NewAPIKey>
	/** Called when key is revoked */
	onRevoke?: (keyId: string) => Promise<void>
	/** Whether loading */
	isLoading?: boolean
	/** Title */
	title?: string
	/** Empty state message */
	emptyMessage?: string
	/** Show environment badge */
	showEnvironment?: boolean
}

const DEFAULT_SCOPES = [
	'read:users',
	'write:users',
	'read:billing',
	'write:billing',
	'read:analytics',
	'admin',
]

/**
 * API key management UI
 *
 * @example
 * ```tsx
 * <APIKeyManager
 *   apiKeys={keys}
 *   onCreate={async (data) => createKey(data)}
 *   onRevoke={async (id) => revokeKey(id)}
 * />
 * ```
 */
export function APIKeyManager({
	theme = defaultTheme,
	className,
	apiKeys = [],
	availableScopes = DEFAULT_SCOPES,
	onCreate,
	onRevoke,
	isLoading = false,
	title = 'API Keys',
	emptyMessage = 'No API keys created',
	showEnvironment = true,
}: APIKeyManagerProps) {
	const [showCreate, setShowCreate] = useState(false)
	const [name, setName] = useState('')
	const [selectedScopes, setSelectedScopes] = useState<string[]>([])
	const [expiresIn, setExpiresIn] = useState<number | undefined>(undefined)
	const [isCreating, setIsCreating] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [newKey, setNewKey] = useState<NewAPIKey | null>(null)
	const [revokingId, setRevokingId] = useState<string | null>(null)
	const [copied, setCopied] = useState(false)

	const styles = baseStyles(theme)

	useEffect(() => {
		injectGlobalStyles()
	}, [])

	useEffect(() => {
		if (copied) {
			const timer = setTimeout(() => setCopied(false), UI_COPY_FEEDBACK_MS)
			return () => clearTimeout(timer)
		}
	}, [copied])

	const handleCreate = async (e: FormEvent) => {
		e.preventDefault()
		if (!onCreate || !name) return

		setIsCreating(true)
		setError(null)

		try {
			const key = await onCreate({
				name,
				scopes: selectedScopes,
				expiresIn,
			})
			setNewKey(key)
			setShowCreate(false)
			setName('')
			setSelectedScopes([])
			setExpiresIn(undefined)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to create API key')
		} finally {
			setIsCreating(false)
		}
	}

	const handleRevoke = async (keyId: string) => {
		if (!onRevoke) return
		setRevokingId(keyId)
		try {
			await onRevoke(keyId)
		} finally {
			setRevokingId(null)
		}
	}

	const copyToClipboard = async (text: string) => {
		try {
			await navigator.clipboard.writeText(text)
			setCopied(true)
		} catch {
			// Fallback
			const textarea = document.createElement('textarea')
			textarea.value = text
			document.body.appendChild(textarea)
			textarea.select()
			document.execCommand('copy')
			document.body.removeChild(textarea)
			setCopied(true)
		}
	}

	const toggleScope = (scope: string) => {
		setSelectedScopes((prev) =>
			prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
		)
	}

	const envColors: Record<string, { bg: string; text: string }> = {
		development: { bg: `${theme.colorWarning}20`, text: theme.colorWarning },
		staging: { bg: `${theme.colorPrimary}20`, text: theme.colorPrimary },
		production: { bg: `${theme.colorSuccess}20`, text: theme.colorSuccess },
	}

	const containerStyle: CSSProperties = {
		fontFamily: theme.fontFamily,
	}

	const keyCardStyle: CSSProperties = {
		padding: '1rem',
		border: `1px solid ${theme.colorBorder}`,
		borderRadius: theme.borderRadius,
		marginBottom: '0.75rem',
	}

	const inputStyle: CSSProperties = {
		width: '100%',
		padding: '0.75rem',
		border: `1px solid ${theme.colorBorder}`,
		borderRadius: theme.borderRadius,
		backgroundColor: theme.colorBackground,
		color: theme.colorForeground,
		fontSize: theme.fontSizeSm,
		fontFamily: theme.fontFamily,
	}

	return (
		<div style={containerStyle} className={className}>
			{/* Header */}
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
				<div>
					<h3 style={{ margin: 0, fontSize: theme.fontSizeLg, fontWeight: 600 }}>{title}</h3>
					<p style={{ margin: '0.25rem 0 0', fontSize: theme.fontSizeXs, color: theme.colorMutedForeground }}>
						Manage your API keys for programmatic access
					</p>
				</div>
				<button
					type="button"
					onClick={() => setShowCreate(true)}
					style={mergeStyles(styles.button, styles.buttonPrimary)}
				>
					<PlusIcon color={theme.colorPrimaryForeground} /> Create Key
				</button>
			</div>

			{/* New Key Display (shown once after creation) */}
			{newKey && (
				<div
					style={{
						...keyCardStyle,
						backgroundColor: `${theme.colorSuccess}10`,
						borderColor: theme.colorSuccess,
						marginBottom: '1.5rem',
					}}
				>
					<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
						<CheckIcon color={theme.colorSuccess} />
						<span style={{ fontWeight: 600, color: theme.colorSuccess }}>API Key Created</span>
					</div>
					<p style={{ margin: '0 0 0.75rem', fontSize: theme.fontSizeSm, color: theme.colorMutedForeground }}>
						Copy this key now. You won't be able to see it again.
					</p>
					<div style={{ display: 'flex', gap: '0.5rem' }}>
						<input
							type="text"
							value={newKey.key}
							readOnly
							style={{
								...inputStyle,
								flex: 1,
								fontFamily: 'monospace',
								backgroundColor: theme.colorBackground,
							}}
						/>
						<button
							type="button"
							onClick={() => copyToClipboard(newKey.key)}
							style={mergeStyles(styles.button, styles.buttonPrimary)}
						>
							{copied ? 'Copied!' : 'Copy'}
						</button>
					</div>
					<button
						type="button"
						onClick={() => setNewKey(null)}
						style={{
							marginTop: '0.75rem',
							padding: '0.25rem 0.5rem',
							fontSize: theme.fontSizeXs,
							border: 'none',
							backgroundColor: 'transparent',
							color: theme.colorMutedForeground,
							cursor: 'pointer',
							textDecoration: 'underline',
						}}
					>
						Dismiss
					</button>
				</div>
			)}

			{/* Create Form */}
			{showCreate && (
				<div style={{ ...keyCardStyle, backgroundColor: theme.colorMuted, marginBottom: '1.5rem' }}>
					<h4 style={{ margin: '0 0 1rem', fontSize: theme.fontSizeSm, fontWeight: 600 }}>New API Key</h4>

					{error && (
						<div style={mergeStyles(styles.alert, styles.alertError, { marginBottom: '1rem' })}>
							{error}
						</div>
					)}

					<form onSubmit={handleCreate}>
						<div style={{ marginBottom: '1rem' }}>
							<label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: theme.fontSizeSm }}>
								Key Name *
							</label>
							<input
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								style={inputStyle}
								placeholder="My API Key"
								required
							/>
							<p style={{ margin: '0.25rem 0 0', fontSize: theme.fontSizeXs, color: theme.colorMutedForeground }}>
								A friendly name to identify this key
							</p>
						</div>

						<div style={{ marginBottom: '1rem' }}>
							<label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: theme.fontSizeSm }}>
								Scopes
							</label>
							<div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
								{availableScopes.map((scope) => (
									<button
										key={scope}
										type="button"
										onClick={() => toggleScope(scope)}
										style={{
											padding: '0.375rem 0.75rem',
											fontSize: theme.fontSizeXs,
											border: `1px solid ${selectedScopes.includes(scope) ? theme.colorPrimary : theme.colorBorder}`,
											borderRadius: theme.borderRadiusSm,
											backgroundColor: selectedScopes.includes(scope) ? `${theme.colorPrimary}10` : 'transparent',
											color: selectedScopes.includes(scope) ? theme.colorPrimary : theme.colorForeground,
											cursor: 'pointer',
										}}
									>
										{scope}
									</button>
								))}
							</div>
							<p style={{ margin: '0.25rem 0 0', fontSize: theme.fontSizeXs, color: theme.colorMutedForeground }}>
								Leave empty for full access
							</p>
						</div>

						<div style={{ marginBottom: '1.5rem' }}>
							<label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: theme.fontSizeSm }}>
								Expiration
							</label>
							<select
								value={expiresIn ?? ''}
								onChange={(e) => setExpiresIn(e.target.value ? parseInt(e.target.value) : undefined)}
								style={inputStyle}
							>
								<option value="">Never expires</option>
								<option value={API_KEY_EXPIRY_1_DAY}>1 day</option>
								<option value={API_KEY_EXPIRY_7_DAYS}>7 days</option>
								<option value={API_KEY_EXPIRY_30_DAYS}>30 days</option>
								<option value={API_KEY_EXPIRY_90_DAYS}>90 days</option>
								<option value={API_KEY_EXPIRY_1_YEAR}>1 year</option>
							</select>
						</div>

						<div style={{ display: 'flex', gap: '0.75rem' }}>
							<button
								type="button"
								onClick={() => {
									setShowCreate(false)
									setName('')
									setSelectedScopes([])
									setExpiresIn(undefined)
									setError(null)
								}}
								style={mergeStyles(styles.button, styles.buttonOutline)}
							>
								Cancel
							</button>
							<button
								type="submit"
								disabled={isCreating || !name}
								style={mergeStyles(styles.button, styles.buttonPrimary)}
							>
								{isCreating ? <span style={styles.spinner} /> : 'Create API Key'}
							</button>
						</div>
					</form>
				</div>
			)}

			{/* Key List */}
			{isLoading ? (
				<div style={{ padding: '2rem', textAlign: 'center' }}>
					<span style={styles.spinner} />
				</div>
			) : apiKeys.length === 0 ? (
				<div
					style={{
						padding: '3rem',
						textAlign: 'center',
						color: theme.colorMutedForeground,
						border: `1px solid ${theme.colorBorder}`,
						borderRadius: theme.borderRadius,
					}}
				>
					<KeyIcon color={theme.colorMuted} size={48} />
					<p style={{ margin: '1rem 0 0' }}>{emptyMessage}</p>
				</div>
			) : (
				apiKeys.map((key) => (
					<div key={key.id} style={keyCardStyle}>
						<div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
							<div style={{ flex: 1, minWidth: 0 }}>
								<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
									<span style={{ fontWeight: 600, fontSize: theme.fontSizeSm }}>{key.name}</span>
									{showEnvironment && key.environment && (
										<span
											style={{
												padding: '0.125rem 0.375rem',
												fontSize: '0.625rem',
												borderRadius: theme.borderRadiusSm,
												backgroundColor: envColors[key.environment]?.bg ?? theme.colorMuted,
												color: envColors[key.environment]?.text ?? theme.colorForeground,
												textTransform: 'capitalize',
											}}
										>
											{key.environment}
										</span>
									)}
								</div>
								<div style={{ fontFamily: 'monospace', fontSize: theme.fontSizeSm, color: theme.colorMutedForeground, marginBottom: '0.5rem' }}>
									{key.prefix}...
								</div>
								{key.scopes && key.scopes.length > 0 && (
									<div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.5rem' }}>
										{key.scopes.map((scope) => (
											<span
												key={scope}
												style={{
													padding: '0.125rem 0.375rem',
													fontSize: '0.625rem',
													backgroundColor: theme.colorMuted,
													borderRadius: theme.borderRadiusSm,
													color: theme.colorMutedForeground,
												}}
											>
												{scope}
											</span>
										))}
									</div>
								)}
								<div style={{ fontSize: theme.fontSizeXs, color: theme.colorMutedForeground }}>
									Created {new Date(key.createdAt).toLocaleDateString()}
									{key.lastUsedAt && ` • Last used ${new Date(key.lastUsedAt).toLocaleString()}`}
									{key.expiresAt && (
										<span style={{ color: new Date(key.expiresAt) < new Date() ? theme.colorDestructive : 'inherit' }}>
											{' '}• {new Date(key.expiresAt) < new Date() ? 'Expired' : `Expires ${new Date(key.expiresAt).toLocaleDateString()}`}
										</span>
									)}
								</div>
							</div>
							{onRevoke && (
								<button
									type="button"
									onClick={() => handleRevoke(key.id)}
									disabled={revokingId === key.id}
									style={{
										padding: '0.25rem 0.5rem',
										fontSize: theme.fontSizeXs,
										border: `1px solid ${theme.colorDestructive}`,
										borderRadius: theme.borderRadiusSm,
										backgroundColor: 'transparent',
										color: theme.colorDestructive,
										cursor: 'pointer',
										marginLeft: '1rem',
									}}
								>
									{revokingId === key.id ? <span style={styles.spinner} /> : 'Revoke'}
								</button>
							)}
						</div>
					</div>
				))
			)}
		</div>
	)
}

// ============================================
// Icons
// ============================================

function KeyIcon({ color, size = 24 }: { color: string; size?: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
		</svg>
	)
}

function PlusIcon({ color }: { color: string }) {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.25rem' }}>
			<line x1="12" y1="5" x2="12" y2="19" />
			<line x1="5" y1="12" x2="19" y2="12" />
		</svg>
	)
}

function CheckIcon({ color }: { color: string }) {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<polyline points="20 6 9 17 4 12" />
		</svg>
	)
}
