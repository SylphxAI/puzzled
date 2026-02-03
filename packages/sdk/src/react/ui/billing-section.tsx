/**
 * Billing Section Component
 *
 * Current subscription display, plan management, and billing history.
 * Self-contained with CSS-in-JS styles.
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ThemeVariables } from './styles'
import {
	defaultTheme,
	baseStyles,
	mergeStyles,
	injectGlobalStyles,
} from './styles'
import { RequireSdk } from '../hooks'
import { useBilling } from '../platform-hooks'
import type { Subscription, Plan } from '../platform-context'
import { UI_NOTIFICATION_MS } from '../../constants'

export interface BillingSectionProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Called on successful action */
	onSuccess?: (message: string) => void
	/** Called on error */
	onError?: (error: string) => void
	/** Custom class name */
	className?: string
	/** Currency symbol */
	currencySymbol?: string
	/** Show current plan section */
	showCurrentPlan?: boolean
	/** Show available plans */
	showPlans?: boolean
	/** Allow plan changes */
	allowPlanChange?: boolean
}

/**
 * Complete billing management section
 *
 * @example
 * ```tsx
 * <BillingSection
 *   onSuccess={(msg) => toast.success(msg)}
 *   showHistory={true}
 * />
 * ```
 */
export function BillingSection(props: BillingSectionProps) {
	return (
		<RequireSdk services={['billing']} componentType="billing" theme={props.theme}>
			<BillingSectionInner {...props} />
		</RequireSdk>
	)
}

/** Inner component that safely uses platform hooks */
function BillingSectionInner({
	theme = defaultTheme,
	onSuccess,
	onError,
	className,
	currencySymbol = '$',
	showCurrentPlan = true,
	showPlans = true,
	allowPlanChange = true,
}: BillingSectionProps) {
	const {
		subscription,
		plans,
		isLoading,
		error: billingError,
		isPremium,
		isTrialing,
		createCheckout,
		openPortal,
		refresh,
	} = useBilling()
	const styles = baseStyles(theme)

	const [selectedInterval, setSelectedInterval] = useState<'monthly' | 'annual'>('monthly')
	const [processingPlan, setProcessingPlan] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [success, setSuccess] = useState<string | null>(null)

	// Inject global styles
	useEffect(() => {
		injectGlobalStyles()
	}, [])

	// Clear messages after timeout
	useEffect(() => {
		if (success || error) {
			const timer = setTimeout(() => {
				setSuccess(null)
				setError(null)
			}, UI_NOTIFICATION_MS)
			return () => clearTimeout(timer)
		}
	}, [success, error])

	// Format price
	const formatPrice = (cents: number | null | undefined) => {
		if (!cents) return 'Free'
		return `${currencySymbol}${(cents / 100).toFixed(2)}`
	}

	// Handle checkout
	const handleCheckout = async (planSlug: string) => {
		setProcessingPlan(planSlug)
		setError(null)

		try {
			const url = await createCheckout(planSlug, selectedInterval)
			window.location.href = url
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to start checkout'
			setError(message)
			onError?.(message)
		} finally {
			setProcessingPlan(null)
		}
	}

	// Handle manage billing
	const handleManageBilling = async () => {
		try {
			await openPortal()
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to open billing portal'
			setError(message)
			onError?.(message)
		}
	}

	const cardStyles: React.CSSProperties = mergeStyles(styles.card, {
		padding: '1.25rem',
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
			{(error || billingError) && (
				<div style={mergeStyles(styles.alert, styles.alertError, styles.mb4)}>
					{error || billingError?.message}
				</div>
			)}

			{/* Current Subscription */}
			{showCurrentPlan && (
				<div style={cardStyles}>
					<div style={styles.flexBetween}>
						<div>
							<h4 style={{ margin: 0, fontWeight: 600, fontSize: theme.fontSizeLg }}>
								{subscription ? subscription.planSlug : 'Free Plan'}
							</h4>
							<p style={mergeStyles(styles.textSm, styles.textMuted, { margin: '0.25rem 0 0' })}>
								{subscription ? (
									<>
										{subscription.status === 'active' && 'Active subscription'}
										{subscription.status === 'trialing' && (
											<>
												Trial ends{' '}
												{subscription.currentPeriodEnd &&
													new Date(subscription.currentPeriodEnd).toLocaleDateString()}
											</>
										)}
										{subscription.status === 'past_due' && (
											<span style={{ color: theme.colorDestructive }}>Payment past due</span>
										)}
										{subscription.cancelAtPeriodEnd && (
											<span style={{ color: theme.colorWarning }}>
												{' '}
												· Cancels{' '}
												{subscription.currentPeriodEnd &&
													new Date(subscription.currentPeriodEnd).toLocaleDateString()}
											</span>
										)}
									</>
								) : (
									'Upgrade to unlock premium features'
								)}
							</p>
						</div>
						<div style={mergeStyles(styles.flexRow, { gap: '0.5rem', alignItems: 'center' })}>
							{subscription && (
								<span
									style={mergeStyles(
										styles.badge,
										subscription.status === 'active'
											? styles.badgeSuccess
											: subscription.status === 'trialing'
											? styles.badgePrimary
											: subscription.status === 'past_due'
											? styles.badgeDestructive
											: styles.badgeWarning
									)}
								>
									{subscription.status === 'trialing' ? 'Trial' : subscription.status}
								</span>
							)}
						</div>
					</div>

					{subscription && (
						<div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${theme.colorBorder}` }}>
							<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
								<div>
									<div style={mergeStyles(styles.textXs, styles.textMuted)}>Billing Cycle</div>
									<div style={{ fontWeight: 500, marginTop: '0.25rem' }}>
										{subscription.interval === 'monthly'
											? 'Monthly'
											: subscription.interval === 'annual'
											? 'Annual'
											: 'Lifetime'}
									</div>
								</div>
								<div>
									<div style={mergeStyles(styles.textXs, styles.textMuted)}>Next Billing</div>
									<div style={{ fontWeight: 500, marginTop: '0.25rem' }}>
										{subscription.cancelAtPeriodEnd
											? 'N/A'
											: subscription.currentPeriodEnd
											? new Date(subscription.currentPeriodEnd).toLocaleDateString()
											: 'N/A'}
									</div>
								</div>
								<div>
									<div style={mergeStyles(styles.textXs, styles.textMuted)}>Amount</div>
									<div style={{ fontWeight: 500, marginTop: '0.25rem' }}>
										{formatPrice(
											subscription.interval === 'monthly'
												? plans.find((p) => p.slug === subscription.planSlug)?.priceMonthly
												: plans.find((p) => p.slug === subscription.planSlug)?.priceAnnual
										)}
										{subscription.interval !== 'lifetime' && `/${subscription.interval === 'monthly' ? 'mo' : 'yr'}`}
									</div>
								</div>
							</div>

							<button
								type="button"
								onClick={handleManageBilling}
								style={mergeStyles(styles.button, styles.buttonOutline, { marginTop: '1rem' })}
							>
								<CreditCardIcon size={16} />
								Manage Billing
							</button>
						</div>
					)}
				</div>
			)}

			{/* Available Plans */}
			{showPlans && allowPlanChange && plans.length > 0 && (
				<div style={{ marginBottom: '1.5rem' }}>
					<div style={styles.flexBetween}>
						<h4 style={{ margin: '0 0 1rem', fontWeight: 500 }}>
							{subscription ? 'Change Plan' : 'Choose a Plan'}
						</h4>
						<div style={mergeStyles(styles.tabs, { marginBottom: 0, padding: '0.125rem' })}>
							<button
								type="button"
								onClick={() => setSelectedInterval('monthly')}
								style={mergeStyles(
									styles.tab,
									{ padding: '0.375rem 0.75rem' },
									selectedInterval === 'monthly' ? styles.tabActive : {}
								)}
							>
								Monthly
							</button>
							<button
								type="button"
								onClick={() => setSelectedInterval('annual')}
								style={mergeStyles(
									styles.tab,
									{ padding: '0.375rem 0.75rem' },
									selectedInterval === 'annual' ? styles.tabActive : {}
								)}
							>
								Annual
								<span
									style={{
										marginLeft: '0.25rem',
										fontSize: theme.fontSizeXs,
										color: theme.colorSuccess,
									}}
								>
									Save 20%
								</span>
							</button>
						</div>
					</div>

					<div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(plans.length, 3)}, 1fr)`, gap: '1rem' }}>
						{plans.map((plan) => {
							const isCurrentPlan = subscription?.planSlug === plan.slug
							const price = selectedInterval === 'monthly' ? plan.priceMonthly : plan.priceAnnual

							return (
								<div
									key={plan.id}
									style={mergeStyles(cardStyles, {
										marginBottom: 0,
										border: isCurrentPlan
											? `2px solid ${theme.colorPrimary}`
											: `1px solid ${theme.colorBorder}`,
									})}
								>
									{isCurrentPlan && (
										<div
											style={{
												marginBottom: '0.75rem',
												paddingBottom: '0.75rem',
												borderBottom: `1px solid ${theme.colorBorder}`,
											}}
										>
											<span style={mergeStyles(styles.badge, styles.badgePrimary)}>
												Current Plan
											</span>
										</div>
									)}

									<h5 style={{ margin: 0, fontSize: theme.fontSizeLg, fontWeight: 600 }}>
										{plan.name}
									</h5>

									<div style={{ marginTop: '0.5rem' }}>
										<span style={{ fontSize: '2rem', fontWeight: 700 }}>
											{formatPrice(price)}
										</span>
										{price && (
											<span style={mergeStyles(styles.textSm, styles.textMuted)}>
												/{selectedInterval === 'monthly' ? 'mo' : 'yr'}
											</span>
										)}
									</div>

									{plan.description && (
										<p style={mergeStyles(styles.textSm, styles.textMuted, { margin: '0.5rem 0' })}>
											{plan.description}
										</p>
									)}

									{plan.features && plan.features.length > 0 && (
										<ul style={{ margin: '1rem 0', padding: 0, listStyle: 'none' }}>
											{plan.features.map((feature: string, i: number) => (
												<li
													key={i}
													style={mergeStyles(styles.flexRow, {
														gap: '0.5rem',
														alignItems: 'flex-start',
														marginBottom: '0.5rem',
														fontSize: theme.fontSizeSm,
													})}
												>
													<CheckIcon color={theme.colorSuccess} />
													<span>{feature}</span>
												</li>
											))}
										</ul>
									)}

									{!isCurrentPlan && price && (
										<button
											type="button"
											onClick={() => handleCheckout(plan.slug)}
											disabled={processingPlan === plan.slug}
											style={mergeStyles(
												styles.button,
												styles.buttonPrimary,
												styles.buttonFullWidth,
												processingPlan === plan.slug ? styles.buttonDisabled : {}
											)}
										>
											{processingPlan === plan.slug ? (
												<>
													<span style={styles.spinner} />
													Processing...
												</>
											) : subscription ? (
												'Switch Plan'
											) : (
												'Subscribe'
											)}
										</button>
									)}

									{isCurrentPlan && (
										<button
											type="button"
											onClick={handleManageBilling}
											style={mergeStyles(styles.button, styles.buttonOutline, styles.buttonFullWidth)}
										>
											Manage
										</button>
									)}
								</div>
							)
						})}
					</div>
				</div>
			)}

			{/* Empty state for no subscription and no plans */}
			{!subscription && plans.length === 0 && (
				<div style={mergeStyles(styles.textCenter, { padding: '2rem' })}>
					<p style={styles.textMuted}>No subscription plans available</p>
				</div>
			)}
		</div>
	)
}

// Icons
function CreditCardIcon({ size = 24 }: { size?: number }) {
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
			<rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
			<line x1="1" y1="10" x2="23" y2="10" />
		</svg>
	)
}

function CheckIcon({ color }: { color: string }) {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			style={{ flexShrink: 0, marginTop: '2px' }}
		>
			<polyline points="20 6 9 17 4 12" />
		</svg>
	)
}
