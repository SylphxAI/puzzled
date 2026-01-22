/**
 * BillingCard Component
 *
 * Displays current subscription status with manage options.
 * Shows plan name, status, renewal date, and upgrade CTA.
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { useBilling } from '../platform-hooks'
import {
	type ThemeVariables,
	defaultTheme,
	baseStyles,
	mergeStyles,
	injectGlobalStyles,
} from '../ui/styles'

export interface BillingCardProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** URL to pricing page */
	pricingUrl?: string
	/** Show manage subscription button */
	showManageButton?: boolean
	/** Show upgrade CTA for free users */
	showUpgradeCta?: boolean
	/** Callback when portal is opened */
	onPortalOpen?: () => void
	/** Callback on error */
	onError?: (error: string) => void
	/** Custom class name */
	className?: string
	/** Card variant */
	variant?: 'default' | 'compact' | 'detailed'
}

/**
 * BillingCard component for subscription status display
 *
 * @example
 * ```tsx
 * <BillingCard
 *   showUpgradeCta
 *   pricingUrl="/pricing"
 * />
 * ```
 */
export function BillingCard({
	theme = defaultTheme,
	pricingUrl = '/pricing',
	showManageButton = true,
	showUpgradeCta = true,
	onPortalOpen,
	onError,
	className,
	variant = 'default',
}: BillingCardProps) {
	const { subscription, isLoading, isPremium, isTrialing, openPortal, plans } = useBilling()
	const styles = baseStyles(theme)

	const [isOpeningPortal, setIsOpeningPortal] = useState(false)

	// Inject global styles
	useEffect(() => {
		injectGlobalStyles()
	}, [])

	const handleManageSubscription = useCallback(async () => {
		setIsOpeningPortal(true)
		onPortalOpen?.()

		try {
			await openPortal()
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to open billing portal'
			onError?.(message)
		} finally {
			setIsOpeningPortal(false)
		}
	}, [openPortal, onPortalOpen, onError])

	if (isLoading) {
		return (
			<div style={styles.card} className={className}>
				<div style={mergeStyles(styles.cardContent, styles.flexCenter, { padding: '2rem' })}>
					<span style={mergeStyles(styles.spinner, { width: '1.5rem', height: '1.5rem' })} />
				</div>
			</div>
		)
	}

	// Get status badge color
	const getStatusBadge = () => {
		if (!subscription) return null

		const statusConfig: Record<string, { bg: string; color: string; label: string }> = {
			active: {
				bg: `${theme.colorSuccess}15`,
				color: theme.colorSuccess,
				label: 'Active',
			},
			trialing: {
				bg: `${theme.colorPrimary}15`,
				color: theme.colorPrimary,
				label: 'Trial',
			},
			past_due: {
				bg: `${theme.colorWarning}15`,
				color: theme.colorWarning,
				label: 'Past Due',
			},
			canceled: {
				bg: `${theme.colorMutedForeground}15`,
				color: theme.colorMutedForeground,
				label: 'Canceled',
			},
			unpaid: {
				bg: `${theme.colorDestructive}15`,
				color: theme.colorDestructive,
				label: 'Unpaid',
			},
		}

		const config = statusConfig[subscription.status] || statusConfig.active
		return (
			<span
				style={{
					display: 'inline-flex',
					alignItems: 'center',
					padding: '0.125rem 0.5rem',
					fontSize: theme.fontSizeXs,
					fontWeight: 500,
					borderRadius: '9999px',
					backgroundColor: config.bg,
					color: config.color,
				}}
			>
				{config.label}
			</span>
		)
	}

	// Format date
	const formatDate = (dateStr: string | null | undefined) => {
		if (!dateStr) return 'N/A'
		return new Date(dateStr).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		})
	}

	// Compact variant
	if (variant === 'compact') {
		return (
			<div
				style={mergeStyles(styles.flexBetween, {
					padding: '0.75rem 1rem',
					backgroundColor: theme.colorMuted,
					borderRadius: theme.borderRadius,
				})}
				className={className}
			>
				<div style={styles.flexRow}>
					<span style={{ fontWeight: 500, marginRight: '0.5rem' }}>
						{subscription?.planSlug || 'Free'}
					</span>
					{getStatusBadge()}
				</div>
				{isPremium && showManageButton && (
					<button
						type="button"
						onClick={handleManageSubscription}
						disabled={isOpeningPortal}
						style={mergeStyles(styles.link, { fontSize: theme.fontSizeSm })}
					>
						{isOpeningPortal ? 'Opening...' : 'Manage'}
					</button>
				)}
				{!isPremium && showUpgradeCta && (
					<a
						href={pricingUrl}
						style={mergeStyles(styles.button, styles.buttonPrimary, {
							padding: '0.25rem 0.75rem',
							fontSize: theme.fontSizeXs,
						})}
					>
						Upgrade
					</a>
				)}
			</div>
		)
	}

	// Free user - show upgrade CTA
	if (!isPremium && showUpgradeCta) {
		// Find the best plan to highlight (first paid plan or 'pro')
		const highlightPlan = plans.find((p) => p.slug === 'pro') || plans.find((p) => p.monthlyPrice > 0)

		return (
			<div style={styles.card} className={className}>
				<div style={styles.cardContent}>
					<div style={styles.flexBetween}>
						<div>
							<h3 style={mergeStyles(styles.cardTitle, { marginBottom: '0.25rem' })}>Free Plan</h3>
							<p style={mergeStyles(styles.textSm, styles.textMuted, { margin: 0 })}>
								Upgrade to unlock premium features
							</p>
						</div>
						<CrownIcon color={theme.colorWarning} size={32} />
					</div>

					<div
						style={{
							marginTop: '1rem',
							padding: '0.75rem',
							backgroundColor: theme.colorMuted,
							borderRadius: theme.borderRadius,
						}}
					>
						<ul
							style={{
								listStyle: 'none',
								padding: 0,
								margin: 0,
								fontSize: theme.fontSizeSm,
							}}
						>
							{highlightPlan?.features?.slice(0, 3).map((feature: string, i: number) => (
								<li
									key={i}
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: '0.5rem',
										marginBottom: '0.5rem',
									}}
								>
									<CheckIcon color={theme.colorSuccess} size={16} />
									{feature}
								</li>
							))}
						</ul>
					</div>

					<a
						href={pricingUrl}
						style={mergeStyles(styles.button, styles.buttonPrimary, styles.buttonFullWidth, {
							marginTop: '1rem',
						})}
					>
						<SparklesIcon size={16} />
						Upgrade Now
					</a>
				</div>
			</div>
		)
	}

	// Premium user - show subscription details
	return (
		<div style={styles.card} className={className}>
			<div style={styles.cardContent}>
				{/* Header */}
				<div style={mergeStyles(styles.flexBetween, { marginBottom: '1rem' })}>
					<div>
						<div style={mergeStyles(styles.flexRow, { gap: '0.5rem', alignItems: 'center' })}>
							<h3 style={mergeStyles(styles.cardTitle, { margin: 0 })}>
								{subscription?.planSlug || 'Free'}
							</h3>
							{getStatusBadge()}
						</div>
						{subscription?.interval && (
							<p style={mergeStyles(styles.textSm, styles.textMuted, { margin: '0.25rem 0 0' })}>
								Billed {subscription.interval}
							</p>
						)}
					</div>
					{isPremium && <CrownIcon color={theme.colorWarning} size={28} />}
				</div>

				{/* Detailed variant - show more info */}
				{variant === 'detailed' && subscription && (
					<div
						style={{
							display: 'grid',
							gridTemplateColumns: 'repeat(2, 1fr)',
							gap: '1rem',
							marginBottom: '1rem',
							padding: '1rem',
							backgroundColor: theme.colorMuted,
							borderRadius: theme.borderRadius,
						}}
					>
						<div>
							<p style={mergeStyles(styles.textXs, styles.textMuted, { margin: 0 })}>Plan</p>
							<p style={mergeStyles(styles.textSm, { margin: '0.25rem 0 0', fontWeight: 500 })}>
								{subscription.planSlug}
							</p>
						</div>
						<div>
							<p style={mergeStyles(styles.textXs, styles.textMuted, { margin: 0 })}>
								{subscription.cancelAtPeriodEnd ? 'Ends' : 'Renews'}
							</p>
							<p style={mergeStyles(styles.textSm, { margin: '0.25rem 0 0', fontWeight: 500 })}>
								{formatDate(subscription.currentPeriodEnd)}
							</p>
						</div>
					</div>
				)}

				{/* Trial banner */}
				{isTrialing && subscription?.trialEnd && (
					<div
						style={{
							marginBottom: '1rem',
							padding: '0.75rem',
							backgroundColor: `${theme.colorPrimary}10`,
							borderRadius: theme.borderRadius,
							border: `1px solid ${theme.colorPrimary}30`,
						}}
					>
						<div style={mergeStyles(styles.flexRow, { gap: '0.5rem', alignItems: 'center' })}>
							<ClockIcon color={theme.colorPrimary} size={16} />
							<span style={{ fontSize: theme.fontSizeSm, color: theme.colorPrimary }}>
								Trial ends {formatDate(subscription.trialEnd)}
							</span>
						</div>
					</div>
				)}

				{/* Cancellation warning */}
				{subscription?.cancelAtPeriodEnd && (
					<div
						style={{
							marginBottom: '1rem',
							padding: '0.75rem',
							backgroundColor: `${theme.colorWarning}10`,
							borderRadius: theme.borderRadius,
							border: `1px solid ${theme.colorWarning}30`,
						}}
					>
						<div style={mergeStyles(styles.flexRow, { gap: '0.5rem', alignItems: 'center' })}>
							<AlertIcon color={theme.colorWarning} size={16} />
							<span style={{ fontSize: theme.fontSizeSm, color: theme.colorWarning }}>
								Your subscription will end on {formatDate(subscription.currentPeriodEnd)}
							</span>
						</div>
					</div>
				)}

				{/* Action buttons */}
				{showManageButton && (
					<button
						type="button"
						onClick={handleManageSubscription}
						disabled={isOpeningPortal}
						style={mergeStyles(
							styles.button,
							styles.buttonOutline,
							styles.buttonFullWidth,
							isOpeningPortal ? styles.buttonDisabled : {}
						)}
					>
						{isOpeningPortal ? (
							<>
								<span style={styles.spinner} />
								Opening...
							</>
						) : (
							<>
								<SettingsIcon size={16} />
								Manage Subscription
							</>
						)}
					</button>
				)}
			</div>
		</div>
	)
}

// Icons
function CrownIcon({ color, size = 24 }: { color: string; size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill={color}
			stroke="none"
			style={{ flexShrink: 0 }}
		>
			<path d="M2 4l3 12h14l3-12-6 7-4-9-4 9-6-7zm3 14h14v2H5v-2z" />
		</svg>
	)
}

function SparklesIcon({ size = 24 }: { size?: number }) {
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
			<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
			<path d="M5 3v4" />
			<path d="M19 17v4" />
			<path d="M3 5h4" />
			<path d="M17 19h4" />
		</svg>
	)
}

function CheckIcon({ color, size = 24 }: { color: string; size?: number }) {
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
			<path d="M20 6 9 17l-5-5" />
		</svg>
	)
}

function ClockIcon({ color, size = 24 }: { color: string; size?: number }) {
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
			<circle cx="12" cy="12" r="10" />
			<polyline points="12 6 12 12 16 14" />
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

function SettingsIcon({ size = 24 }: { size?: number }) {
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
			<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
			<circle cx="12" cy="12" r="3" />
		</svg>
	)
}
