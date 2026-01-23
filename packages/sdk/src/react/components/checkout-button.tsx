/**
 * CheckoutButton Component
 *
 * Simple button to initiate checkout for a specific plan.
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { RequireSdk } from '../hooks'
import { useBilling } from '../platform-hooks'
import {
	type ThemeVariables,
	defaultTheme,
	baseStyles,
	mergeStyles,
	injectGlobalStyles,
} from '../ui/styles'

export interface CheckoutButtonProps {
	/** Plan slug to checkout */
	planSlug: string
	/** Billing interval */
	interval?: 'monthly' | 'annual' | 'lifetime'
	/** Theme variables */
	theme?: ThemeVariables
	/** Button variant */
	variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
	/** Button size */
	size?: 'sm' | 'md' | 'lg'
	/** Custom button text */
	children?: React.ReactNode
	/** Called before checkout starts */
	onCheckoutStart?: () => void
	/** Called on error */
	onError?: (error: string) => void
	/** Disabled state */
	disabled?: boolean
	/** Full width */
	fullWidth?: boolean
	/** Custom class name */
	className?: string
}

/**
 * CheckoutButton for quick plan checkout
 *
 * @example
 * ```tsx
 * <CheckoutButton planSlug="pro" interval="annual">
 *   Upgrade to Pro
 * </CheckoutButton>
 * ```
 */
export function CheckoutButton(props: CheckoutButtonProps) {
	return (
		<RequireSdk services={['billing']} componentType="billing" theme={props.theme}>
			<CheckoutButtonInner {...props} />
		</RequireSdk>
	)
}

/** Inner component that safely uses platform hooks */
function CheckoutButtonInner({
	planSlug,
	interval = 'monthly',
	theme = defaultTheme,
	variant = 'primary',
	size = 'md',
	children,
	onCheckoutStart,
	onError,
	disabled = false,
	fullWidth = false,
	className,
}: CheckoutButtonProps) {
	const { plans, createCheckout, isPremium, subscription } = useBilling()
	const styles = baseStyles(theme)

	const [isLoading, setIsLoading] = useState(false)

	// Inject global styles
	useEffect(() => {
		injectGlobalStyles()
	}, [])

	const handleClick = useCallback(async () => {
		setIsLoading(true)
		onCheckoutStart?.()

		try {
			const checkoutUrl = await createCheckout(planSlug, interval)
			if (typeof window !== 'undefined') {
				window.location.href = checkoutUrl
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to start checkout'
			onError?.(message)
		} finally {
			setIsLoading(false)
		}
	}, [planSlug, interval, createCheckout, onCheckoutStart, onError])

	// Check if user is already on this plan
	const isCurrentPlan = subscription?.planSlug === planSlug

	// Get plan info for default text
	const plan = plans.find((p) => p.slug === planSlug)

	// Get size styles
	const sizeStyles: Record<string, React.CSSProperties> = {
		sm: { padding: '0.375rem 0.75rem', fontSize: theme.fontSizeXs },
		md: { padding: '0.5rem 1rem', fontSize: theme.fontSizeSm },
		lg: { padding: '0.75rem 1.5rem', fontSize: theme.fontSizeBase },
	}

	// Get variant styles
	const variantStyleMap: Record<string, React.CSSProperties> = {
		primary: styles.buttonPrimary,
		secondary: styles.buttonSecondary,
		outline: styles.buttonOutline,
		ghost: styles.buttonGhost,
	}

	const buttonStyles = mergeStyles(
		styles.button,
		variantStyleMap[variant],
		sizeStyles[size],
		fullWidth ? styles.buttonFullWidth : {},
		isLoading || disabled || isCurrentPlan ? styles.buttonDisabled : {}
	)

	const defaultText = isCurrentPlan
		? 'Current Plan'
		: isPremium
			? `Switch to ${plan?.name || planSlug}`
			: `Get ${plan?.name || planSlug}`

	return (
		<button
			type="button"
			onClick={handleClick}
			disabled={isLoading || disabled || isCurrentPlan}
			className={className}
			style={buttonStyles}
		>
			{isLoading ? (
				<>
					<span style={styles.spinner} />
					Processing...
				</>
			) : isCurrentPlan ? (
				<>
					<CheckIcon size={16} />
					{children || 'Current Plan'}
				</>
			) : (
				children || defaultText
			)}
		</button>
	)
}

function CheckIcon({ size = 24 }: { size?: number }) {
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
			<path d="M20 6 9 17l-5-5" />
		</svg>
	)
}
