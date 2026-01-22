/**
 * Platform Balance Component
 *
 * Displays organization's platform credit balance, health status,
 * and provides a CTA to add credits.
 *
 * Uses the platform billing endpoints via SDK.
 */

'use client'

import { useEffect, useCallback, useContext } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PlatformContext } from '../platform-context'
import {
	type ThemeVariables,
	defaultTheme,
	baseStyles,
	mergeStyles,
	injectGlobalStyles,
} from '../ui/styles'

interface BalanceData {
	balance: {
		current: number
		currentFormatted: string
		creditLimit: number
		creditLimitFormatted: string
		lifetimeCredits: number
		lifetimeUsage: number
	}
	status: {
		level: 'healthy' | 'low' | 'critical' | 'blocked'
		isHealthy: boolean
		isLow: boolean
		threshold: number
		available: number
		availableFormatted: string
	}
	alertThreshold: number
	isAdminOrg: boolean
}

export interface PlatformBalanceCardProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Callback when add credits is clicked */
	onAddCredits?: () => void
	/** URL for add credits page (if not using callback) */
	addCreditsUrl?: string
	/** Show add credits button */
	showAddCredits?: boolean
	/** Show usage breakdown */
	showUsage?: boolean
	/** Custom class name */
	className?: string
	/** Card variant */
	variant?: 'default' | 'compact' | 'detailed'
}

/**
 * Platform balance card showing organization's credit balance
 *
 * @example
 * ```tsx
 * <PlatformBalanceCard
 *   onAddCredits={() => router.push('/settings/billing/add-credits')}
 *   showUsage
 * />
 * ```
 */
export function PlatformBalanceCard({
	theme = defaultTheme,
	onAddCredits,
	addCreditsUrl = '/settings/billing/add-credits',
	showAddCredits = true,
	showUsage = false,
	className,
	variant = 'default',
}: PlatformBalanceCardProps) {
	const ctx = useContext(PlatformContext)
	const styles = baseStyles(theme)

	// Inject global styles
	useEffect(() => {
		injectGlobalStyles()
	}, [])

	// Fetch balance data with React Query
	const balanceQuery = useQuery({
		queryKey: ['sylphx', 'billing', 'balance'],
		queryFn: async (): Promise<BalanceData> => {
			if (!ctx) throw new Error('Platform context not available')
			const data = await ctx.getBillingBalance()
			// Map to expected format
			return {
				balance: {
					current: data.balance.current,
					currentFormatted: data.balance.currentFormatted,
					creditLimit: data.spendingCap ?? 0,
					creditLimitFormatted: data.spendingCap ? `$${(data.spendingCap / 1_000_000).toFixed(2)}` : '$0.00',
					lifetimeCredits: 0, // Not available in new API
					lifetimeUsage: data.currentMonthSpend,
				},
				status: {
					level: data.status.level as 'healthy' | 'low' | 'critical' | 'blocked',
					isHealthy: data.status.isHealthy,
					isLow: data.status.isLow,
					threshold: data.status.alertThreshold,
					available: data.balance.current,
					availableFormatted: data.balance.currentFormatted,
				},
				alertThreshold: data.status.alertThreshold,
				isAdminOrg: data.isAdminOrg,
			}
		},
		enabled: !!ctx,
		staleTime: 60 * 1000, // 1 min - balance may change frequently
	})

	const balance = balanceQuery.data ?? null
	const isLoading = balanceQuery.isLoading
	const error = balanceQuery.error instanceof Error
		? balanceQuery.error.message
		: balanceQuery.error ? 'Failed to load balance' : null

	const handleAddCredits = useCallback(() => {
		if (onAddCredits) {
			onAddCredits()
		} else if (addCreditsUrl) {
			window.location.href = addCreditsUrl
		}
	}, [onAddCredits, addCreditsUrl])

	// Status colors
	const getStatusColor = (level: string) => {
		switch (level) {
			case 'healthy':
				return theme.colorSuccess
			case 'low':
				return theme.colorWarning
			case 'critical':
			case 'blocked':
				return theme.colorDestructive
			default:
				return theme.colorMutedForeground
		}
	}

	const getStatusBg = (level: string) => {
		switch (level) {
			case 'healthy':
				return `${theme.colorSuccess}15`
			case 'low':
				return `${theme.colorWarning}15`
			case 'critical':
			case 'blocked':
				return `${theme.colorDestructive}15`
			default:
				return theme.colorMuted
		}
	}

	if (isLoading) {
		return (
			<div style={styles.card} className={className}>
				<div style={mergeStyles(styles.cardContent, styles.flexCenter, { padding: '2rem' })}>
					<span style={mergeStyles(styles.spinner, { width: '1.5rem', height: '1.5rem' })} />
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div style={styles.card} className={className}>
				<div style={mergeStyles(styles.cardContent, { padding: '1.5rem' })}>
					<div style={mergeStyles(styles.alert, styles.alertError)}>
						{error}
					</div>
				</div>
			</div>
		)
	}

	if (!balance) return null

	const { status } = balance

	// Compact variant
	if (variant === 'compact') {
		return (
			<div
				style={mergeStyles(styles.flexBetween, {
					padding: '0.75rem 1rem',
					backgroundColor: getStatusBg(status.level),
					borderRadius: theme.borderRadius,
				})}
				className={className}
			>
				<div style={styles.flexRow}>
					<WalletIcon size={18} color={getStatusColor(status.level)} />
					<span style={{ fontWeight: 600, marginLeft: '0.5rem', fontSize: theme.fontSizeLg }}>
						{balance.balance.currentFormatted}
					</span>
					<span
						style={{
							marginLeft: '0.5rem',
							padding: '0.125rem 0.5rem',
							fontSize: theme.fontSizeXs,
							fontWeight: 500,
							borderRadius: '9999px',
							backgroundColor: getStatusBg(status.level),
							color: getStatusColor(status.level),
							textTransform: 'capitalize',
						}}
					>
						{status.level}
					</span>
				</div>
				{showAddCredits && !balance.isAdminOrg && (
					<button
						type="button"
						onClick={handleAddCredits}
						style={mergeStyles(styles.button, styles.buttonPrimary, {
							padding: '0.25rem 0.75rem',
							fontSize: theme.fontSizeXs,
						})}
					>
						Add Credits
					</button>
				)}
			</div>
		)
	}

	return (
		<div style={styles.card} className={className}>
			<div style={styles.cardContent}>
				{/* Header */}
				<div style={mergeStyles(styles.flexBetween, { marginBottom: '1rem' })}>
					<div style={styles.flexRow}>
						<WalletIcon size={24} color={getStatusColor(status.level)} />
						<div style={{ marginLeft: '0.75rem' }}>
							<h3 style={mergeStyles(styles.cardTitle, { margin: 0 })}>Platform Credits</h3>
							<p style={mergeStyles(styles.textSm, styles.textMuted, { margin: '0.125rem 0 0' })}>
								{balance.isAdminOrg ? 'Admin organization (unlimited)' : 'Available balance'}
							</p>
						</div>
					</div>
					<span
						style={{
							padding: '0.25rem 0.75rem',
							fontSize: theme.fontSizeXs,
							fontWeight: 500,
							borderRadius: '9999px',
							backgroundColor: getStatusBg(status.level),
							color: getStatusColor(status.level),
							textTransform: 'capitalize',
						}}
					>
						{status.level}
					</span>
				</div>

				{/* Balance Display */}
				<div
					style={{
						padding: '1.5rem',
						backgroundColor: theme.colorMuted,
						borderRadius: theme.borderRadius,
						textAlign: 'center',
					}}
				>
					<div style={{ fontSize: '2.5rem', fontWeight: 700, color: theme.colorForeground }}>
						{balance.balance.currentFormatted}
					</div>
					{balance.balance.creditLimit > 0 && (
						<p style={mergeStyles(styles.textSm, styles.textMuted, { margin: '0.5rem 0 0' })}>
							Credit limit: {balance.balance.creditLimitFormatted}
						</p>
					)}
				</div>

				{/* Status Alert */}
				{(status.level === 'low' || status.level === 'critical' || status.level === 'blocked') && (
					<div
						style={{
							marginTop: '1rem',
							padding: '0.75rem',
							backgroundColor: getStatusBg(status.level),
							borderRadius: theme.borderRadius,
							border: `1px solid ${getStatusColor(status.level)}30`,
						}}
					>
						<div style={mergeStyles(styles.flexRow, { gap: '0.5rem', alignItems: 'center' })}>
							<AlertIcon color={getStatusColor(status.level)} size={16} />
							<span style={{ fontSize: theme.fontSizeSm, color: getStatusColor(status.level) }}>
								{status.level === 'blocked'
									? 'Services suspended. Add credits to restore access.'
									: status.level === 'critical'
										? 'Balance critically low. Add credits soon.'
										: 'Balance running low. Consider adding credits.'}
							</span>
						</div>
					</div>
				)}

				{/* Detailed variant - show more stats */}
				{variant === 'detailed' && (
					<div
						style={{
							display: 'grid',
							gridTemplateColumns: 'repeat(2, 1fr)',
							gap: '1rem',
							marginTop: '1rem',
							paddingTop: '1rem',
							borderTop: `1px solid ${theme.colorBorder}`,
						}}
					>
						<div>
							<p style={mergeStyles(styles.textXs, styles.textMuted, { margin: 0 })}>
								Lifetime Credits
							</p>
							<p style={mergeStyles(styles.textSm, { margin: '0.25rem 0 0', fontWeight: 500 })}>
								${(balance.balance.lifetimeCredits / 1_000_000).toFixed(2)}
							</p>
						</div>
						<div>
							<p style={mergeStyles(styles.textXs, styles.textMuted, { margin: 0 })}>
								Lifetime Usage
							</p>
							<p style={mergeStyles(styles.textSm, { margin: '0.25rem 0 0', fontWeight: 500 })}>
								${(balance.balance.lifetimeUsage / 1_000_000).toFixed(2)}
							</p>
						</div>
						<div>
							<p style={mergeStyles(styles.textXs, styles.textMuted, { margin: 0 })}>
								Alert Threshold
							</p>
							<p style={mergeStyles(styles.textSm, { margin: '0.25rem 0 0', fontWeight: 500 })}>
								${(balance.alertThreshold / 1_000_000).toFixed(2)}
							</p>
						</div>
						<div>
							<p style={mergeStyles(styles.textXs, styles.textMuted, { margin: 0 })}>
								Available
							</p>
							<p style={mergeStyles(styles.textSm, { margin: '0.25rem 0 0', fontWeight: 500 })}>
								{status.availableFormatted}
							</p>
						</div>
					</div>
				)}

				{/* Add Credits Button */}
				{showAddCredits && !balance.isAdminOrg && (
					<button
						type="button"
						onClick={handleAddCredits}
						style={mergeStyles(
							styles.button,
							status.level === 'blocked' || status.level === 'critical'
								? styles.buttonDestructive
								: styles.buttonPrimary,
							styles.buttonFullWidth,
							{ marginTop: '1rem' }
						)}
					>
						<PlusIcon size={16} />
						Add Credits
					</button>
				)}
			</div>
		</div>
	)
}

// Icons
function WalletIcon({ size = 24, color }: { size?: number; color?: string }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke={color || 'currentColor'}
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			style={{ flexShrink: 0 }}
		>
			<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
			<path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
			<path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
		</svg>
	)
}

function AlertIcon({ color, size = 24 }: { color: string; size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			style={{ flexShrink: 0 }}
		>
			<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
			<line x1="12" y1="9" x2="12" y2="13" />
			<line x1="12" y1="17" x2="12.01" y2="17" />
		</svg>
	)
}

function PlusIcon({ size = 24 }: { size?: number }) {
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
			style={{ flexShrink: 0 }}
		>
			<line x1="12" y1="5" x2="12" y2="19" />
			<line x1="5" y1="12" x2="19" y2="12" />
		</svg>
	)
}
