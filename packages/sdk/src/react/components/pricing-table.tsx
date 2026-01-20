/**
 * PricingTable Component
 *
 * Displays available plans with pricing and features.
 * Matches Clerk's pricing table pattern but for billing.
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

export interface PricingTableProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Billing interval to show by default */
	defaultInterval?: 'monthly' | 'annual' | 'lifetime'
	/** Show interval toggle */
	showIntervalToggle?: boolean
	/** Highlight this plan slug */
	highlightPlan?: string
	/** Called when checkout starts */
	onCheckoutStart?: (planSlug: string, interval: 'monthly' | 'annual' | 'lifetime') => void
	/** Called on checkout error */
	onError?: (error: string) => void
	/** Custom class name */
	className?: string
	/** Show annual savings badge */
	showAnnualSavings?: boolean
	/** Feature comparison mode */
	showFeatureComparison?: boolean
}

/**
 * PricingTable component for displaying subscription plans
 *
 * @example
 * ```tsx
 * <PricingTable
 *   defaultInterval="annual"
 *   highlightPlan="pro"
 *   showAnnualSavings
 * />
 * ```
 */
export function PricingTable({
	theme = defaultTheme,
	defaultInterval = 'monthly',
	showIntervalToggle = true,
	highlightPlan,
	onCheckoutStart,
	onError,
	className,
	showAnnualSavings = true,
	showFeatureComparison = false,
}: PricingTableProps) {
	const { plans, plansLoading, subscription, isPremium, createCheckout } = useBilling()
	const styles = baseStyles(theme)

	const [interval, setInterval] = useState<'monthly' | 'annual' | 'lifetime'>(defaultInterval)
	const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

	// Inject global styles
	useEffect(() => {
		injectGlobalStyles()
	}, [])

	const handleCheckout = useCallback(
		async (planSlug: string) => {
			setLoadingPlan(planSlug)
			onCheckoutStart?.(planSlug, interval)

			try {
				const checkoutUrl = await createCheckout(planSlug, interval)
				if (typeof window !== 'undefined') {
					window.location.href = checkoutUrl
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Failed to start checkout'
				onError?.(message)
			} finally {
				setLoadingPlan(null)
			}
		},
		[interval, createCheckout, onCheckoutStart, onError]
	)

	if (plansLoading) {
		return (
			<div style={mergeStyles(styles.flexCenter, { padding: '3rem' })}>
				<span style={mergeStyles(styles.spinner, { width: '2rem', height: '2rem' })} />
			</div>
		)
	}

	if (!plans || plans.length === 0) {
		return (
			<div style={mergeStyles(styles.textCenter, styles.textMuted, { padding: '2rem' })}>
				No plans available
			</div>
		)
	}

	// Get price for a plan based on interval
	const getPlanPrice = (plan: (typeof plans)[0], int: 'monthly' | 'annual' | 'lifetime') => {
		switch (int) {
			case 'monthly':
				return plan.priceMonthly || 0
			case 'annual':
				return plan.priceAnnual || 0
			case 'lifetime':
				return plan.priceLifetime || 0
			default:
				return 0
		}
	}

	// Calculate annual savings
	const getAnnualSavings = (plan: (typeof plans)[0]) => {
		const monthly = plan.priceMonthly || 0
		const annual = plan.priceAnnual || 0
		if (monthly > 0 && annual > 0) {
			const yearlyFromMonthly = monthly * 12
			const savings = Math.round(((yearlyFromMonthly - annual) / yearlyFromMonthly) * 100)
			return savings > 0 ? savings : 0
		}
		return 0
	}

	const containerStyles: React.CSSProperties = {
		display: 'grid',
		gridTemplateColumns: `repeat(${Math.min(plans.length, 3)}, 1fr)`,
		gap: '1.5rem',
		maxWidth: '1000px',
		margin: '0 auto',
	}

	const planCardStyles = (isHighlighted: boolean): React.CSSProperties => ({
		backgroundColor: theme.colorBackground,
		borderRadius: theme.borderRadiusLg,
		border: `${isHighlighted ? '2px' : '1px'} solid ${isHighlighted ? theme.colorPrimary : theme.colorBorder}`,
		padding: '1.5rem',
		display: 'flex',
		flexDirection: 'column',
		position: 'relative',
		boxShadow: isHighlighted
			? `0 8px 30px ${theme.colorPrimary}20`
			: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
	})

	const badgeStyles: React.CSSProperties = {
		position: 'absolute',
		top: '-0.75rem',
		left: '50%',
		transform: 'translateX(-50%)',
		backgroundColor: theme.colorPrimary,
		color: theme.colorPrimaryForeground,
		padding: '0.25rem 0.75rem',
		borderRadius: '9999px',
		fontSize: theme.fontSizeXs,
		fontWeight: 600,
		textTransform: 'uppercase',
		letterSpacing: '0.05em',
		whiteSpace: 'nowrap',
	}

	const priceStyles: React.CSSProperties = {
		fontSize: '2.5rem',
		fontWeight: 700,
		color: theme.colorForeground,
		lineHeight: 1,
	}

	const intervalTextStyles: React.CSSProperties = {
		fontSize: theme.fontSizeSm,
		color: theme.colorMutedForeground,
		marginLeft: '0.25rem',
	}

	const featureListStyles: React.CSSProperties = {
		listStyle: 'none',
		padding: 0,
		margin: '1.5rem 0',
		flex: 1,
	}

	const featureItemStyles: React.CSSProperties = {
		display: 'flex',
		alignItems: 'flex-start',
		gap: '0.5rem',
		marginBottom: '0.75rem',
		fontSize: theme.fontSizeSm,
		color: theme.colorForeground,
	}

	return (
		<div className={className}>
			{/* Interval Toggle */}
			{showIntervalToggle && (
				<div style={mergeStyles(styles.flexCenter, { marginBottom: '2rem', gap: '0.5rem' })}>
					<div style={styles.tabs}>
						<button
							type="button"
							onClick={() => setInterval('monthly')}
							style={mergeStyles(styles.tab, interval === 'monthly' ? styles.tabActive : {})}
						>
							Monthly
						</button>
						<button
							type="button"
							onClick={() => setInterval('annual')}
							style={mergeStyles(styles.tab, interval === 'annual' ? styles.tabActive : {})}
						>
							Annual
							{showAnnualSavings && (
								<span
									style={{
										marginLeft: '0.5rem',
										backgroundColor: `${theme.colorSuccess}20`,
										color: theme.colorSuccess,
										padding: '0.125rem 0.375rem',
										borderRadius: '4px',
										fontSize: theme.fontSizeXs,
										fontWeight: 600,
									}}
								>
									Save up to 20%
								</span>
							)}
						</button>
					</div>
				</div>
			)}

			{/* Plans Grid */}
			<div style={containerStyles}>
				{plans.map((plan) => {
					const isHighlighted = plan.slug === highlightPlan || plan.slug === 'pro'
					const isCurrentPlan = subscription?.planSlug === plan.slug
					const price = getPlanPrice(plan, interval)
					const annualSavings = interval === 'monthly' ? getAnnualSavings(plan) : 0

					return (
						<div key={plan.id} style={planCardStyles(isHighlighted)}>
							{/* Popular Badge */}
							{isHighlighted && <div style={badgeStyles}>Most Popular</div>}

							{/* Plan Header */}
							<div style={{ marginBottom: '1rem' }}>
								<h3
									style={{
										fontSize: theme.fontSizeLg,
										fontWeight: 600,
										margin: 0,
										marginBottom: '0.25rem',
									}}
								>
									{plan.name}
								</h3>
								{plan.description && (
									<p style={mergeStyles(styles.textSm, styles.textMuted, { margin: 0 })}>
										{plan.description}
									</p>
								)}
							</div>

							{/* Price */}
							<div style={{ marginBottom: '1rem' }}>
								<span style={priceStyles}>
									{price === 0 ? (
										'Free'
									) : (
										<>
											${(price / 100).toFixed(price % 100 === 0 ? 0 : 2)}
											<span style={intervalTextStyles}>
												/{interval === 'lifetime' ? 'lifetime' : interval === 'annual' ? 'year' : 'mo'}
											</span>
										</>
									)}
								</span>
								{annualSavings > 0 && showAnnualSavings && (
									<div style={{ marginTop: '0.5rem' }}>
										<span
											style={{
												fontSize: theme.fontSizeXs,
												color: theme.colorSuccess,
												fontWeight: 500,
											}}
										>
											Switch to annual, save {annualSavings}%
										</span>
									</div>
								)}
							</div>

							{/* Features */}
							<ul style={featureListStyles}>
								{plan.features?.map((feature: string, index: number) => (
									<li key={index} style={featureItemStyles}>
										<CheckIcon color={theme.colorSuccess} size={18} />
										<span>{feature}</span>
									</li>
								))}
							</ul>

							{/* CTA Button */}
							{isCurrentPlan ? (
								<div
									style={mergeStyles(styles.button, styles.buttonOutline, styles.buttonFullWidth, {
										cursor: 'default',
									})}
								>
									<CheckIcon color={theme.colorSuccess} size={16} />
									Current Plan
								</div>
							) : price === 0 ? (
								<button
									type="button"
									disabled
									style={mergeStyles(
										styles.button,
										styles.buttonOutline,
										styles.buttonFullWidth,
										styles.buttonDisabled
									)}
								>
									Free Plan
								</button>
							) : (
								<button
									type="button"
									onClick={() => handleCheckout(plan.slug)}
									disabled={loadingPlan !== null}
									style={mergeStyles(
										styles.button,
										isHighlighted ? styles.buttonPrimary : styles.buttonOutline,
										styles.buttonFullWidth,
										loadingPlan !== null ? styles.buttonDisabled : {}
									)}
								>
									{loadingPlan === plan.slug ? (
										<>
											<span style={styles.spinner} />
											Processing...
										</>
									) : isPremium ? (
										'Switch Plan'
									) : (
										'Get Started'
									)}
								</button>
							)}
						</div>
					)
				})}
			</div>

			{/* Feature Comparison Table */}
			{showFeatureComparison && plans.length > 1 && (
				<div style={{ marginTop: '3rem' }}>
					<h3 style={mergeStyles(styles.textCenter, { marginBottom: '1.5rem' })}>
						Compare Plans
					</h3>
					<FeatureComparisonTable plans={plans} theme={theme} />
				</div>
			)}
		</div>
	)
}

// Feature comparison table component
function FeatureComparisonTable({
	plans,
	theme,
}: {
	plans: Array<{ name: string; features?: string[] | null }>
	theme: ThemeVariables
}) {
	// Extract all unique features across plans
	const allFeatures = Array.from(new Set(plans.flatMap((p) => p.features || [])))

	const cellStyles: React.CSSProperties = {
		padding: '0.75rem 1rem',
		borderBottom: `1px solid ${theme.colorBorder}`,
		fontSize: theme.fontSizeSm,
	}

	const headerCellStyles: React.CSSProperties = {
		...cellStyles,
		fontWeight: 600,
		backgroundColor: theme.colorMuted,
	}

	return (
		<table
			style={{
				width: '100%',
				borderCollapse: 'collapse',
				border: `1px solid ${theme.colorBorder}`,
				borderRadius: theme.borderRadius,
				overflow: 'hidden',
			}}
		>
			<thead>
				<tr>
					<th style={headerCellStyles}>Feature</th>
					{plans.map((plan) => (
						<th key={plan.name} style={mergeStyles(headerCellStyles, { textAlign: 'center' })}>
							{plan.name}
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{allFeatures.map((feature, index) => (
					<tr key={index}>
						<td style={cellStyles}>{feature}</td>
						{plans.map((plan) => (
							<td key={plan.name} style={mergeStyles(cellStyles, { textAlign: 'center' })}>
								{plan.features?.includes(feature) ? (
									<CheckIcon color={theme.colorSuccess} size={18} />
								) : (
									<XIcon color={theme.colorMutedForeground} size={18} />
								)}
							</td>
						))}
					</tr>
				))}
			</tbody>
		</table>
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

function XIcon({ color, size = 24 }: { color: string; size?: number }) {
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
			<path d="M18 6 6 18" />
			<path d="m6 6 12 12" />
		</svg>
	)
}
