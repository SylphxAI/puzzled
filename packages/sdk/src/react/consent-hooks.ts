/**
 * Consent Hooks
 *
 * React hooks for GDPR/CCPA consent management.
 * Uses server as Single Source of Truth (SSOT) - no local localStorage duplication.
 *
 * Uses proper React Context pattern (no module singletons).
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import {
	useConsentContext,
	type ConsentCategory,
	type ConsentType,
	type UserConsent,
} from './services-context'

// Re-export types from services-context for convenience
export type { ConsentCategory, ConsentType, UserConsent }

// ============================================
// useConsent
// ============================================

export interface UseConsentReturn {
	/** All consent types for this app */
	types: ConsentType[]
	/** User's current consent values by type ID */
	consents: Record<string, boolean>
	/** Whether consent data is loading */
	isLoading: boolean
	/** Error from consent operations */
	error: Error | null
	/** Whether consent banner should be shown */
	showBanner: boolean
	/** Whether user has given any consent */
	hasConsented: boolean
	/** Check if a specific category is consented */
	hasConsent: (category: ConsentCategory) => boolean
	/** Set consent for a single type */
	setConsent: (typeId: string, value: boolean) => void
	/** Set multiple consents at once */
	setConsents: (consents: Record<string, boolean>) => void
	/** Accept all consents */
	acceptAll: () => Promise<void>
	/** Decline optional consents (keep only required) */
	declineOptional: () => Promise<void>
	/** Save current consent selections */
	saveConsents: () => Promise<void>
	/** Open consent preferences modal/banner */
	openPreferences: () => void
	/** Close consent banner */
	closeBanner: () => void
}

/**
 * Hook for consent management
 *
 * Server is the Single Source of Truth (SSOT) for consent data.
 * Local state is only used for optimistic updates during user interaction.
 *
 * @example
 * ```tsx
 * function CookieBanner() {
 *   const {
 *     showBanner,
 *     types,
 *     consents,
 *     acceptAll,
 *     declineOptional,
 *     setConsent,
 *     saveConsents,
 *   } = useConsent()
 *
 *   if (!showBanner) return null
 *
 *   return (
 *     <div className="cookie-banner">
 *       <h3>We use cookies</h3>
 *       <p>We use cookies to improve your experience.</p>
 *
 *       {types.map(type => (
 *         <label key={type.id}>
 *           <input
 *             type="checkbox"
 *             checked={consents[type.id] ?? type.defaultValue}
 *             disabled={type.required}
 *             onChange={(e) => setConsent(type.id, e.target.checked)}
 *           />
 *           {type.name}
 *         </label>
 *       ))}
 *
 *       <button onClick={declineOptional}>Decline Optional</button>
 *       <button onClick={saveConsents}>Save Preferences</button>
 *       <button onClick={acceptAll}>Accept All</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useConsent(): UseConsentReturn {
	const ctx = useConsentContext()
	const [types, setTypes] = useState<ConsentType[]>([])
	const [consents, setConsentsState] = useState<Record<string, boolean>>({})
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<Error | null>(null)
	const [showBanner, setShowBanner] = useState(false)
	const [initialized, setInitialized] = useState(false)

	// Load consent types and user consents from server on mount
	useEffect(() => {
		async function loadConsent() {
			setIsLoading(true)
			setError(null)

			try {
				// Load consent types
				const typesResponse = await ctx.getConsentTypes()
				setTypes(typesResponse)

				// Load user consents from server (SSOT)
				try {
					const consentsResponse = await ctx.getUserConsents()
					const consentsMap: Record<string, boolean> = {}
					for (const consent of consentsResponse) {
						consentsMap[consent.slug] = consent.granted
					}
					setConsentsState(consentsMap)

					// Show banner if no consents have been given
					setShowBanner(Object.keys(consentsMap).length === 0)
				} catch {
					// No server consents (probably not signed in), show banner
					setShowBanner(true)
				}

				setInitialized(true)
			} catch (err) {
				setError(err instanceof Error ? err : new Error('Failed to load consent'))
			} finally {
				setIsLoading(false)
			}
		}

		loadConsent()
	}, [ctx])

	const hasConsented = Object.keys(consents).length > 0

	const hasConsent = useCallback(
		(category: ConsentCategory): boolean => {
			// Necessary is always consented
			if (category === 'necessary') return true

			// Check if any consent type in this category is consented
			const categoryTypes = types.filter((t) => t.category === category)
			return categoryTypes.some((t) => consents[t.slug] ?? t.defaultEnabled)
		},
		[types, consents]
	)

	const setConsent = useCallback((typeId: string, value: boolean) => {
		setConsentsState((prev) => ({ ...prev, [typeId]: value }))
	}, [])

	const setConsents = useCallback((newConsents: Record<string, boolean>) => {
		setConsentsState((prev) => ({ ...prev, ...newConsents }))
	}, [])

	const saveConsents = useCallback(async () => {
		setIsLoading(true)
		setError(null)

		try {
			// Build consent list
			const consentList = types.map((type) => ({
				slug: type.slug,
				granted: consents[type.slug] ?? type.defaultEnabled,
			}))

			// Save to server (SSOT)
			await ctx.setConsents(consentList)

			// Update local state to reflect saved values
			const consentsMap: Record<string, boolean> = {}
			for (const consent of consentList) {
				consentsMap[consent.slug] = consent.granted
			}
			setConsentsState(consentsMap)

			setShowBanner(false)
		} catch (err) {
			setError(err instanceof Error ? err : new Error('Failed to save consent'))
			throw err
		} finally {
			setIsLoading(false)
		}
	}, [ctx, types, consents])

	const acceptAll = useCallback(async () => {
		setIsLoading(true)
		setError(null)

		try {
			// Save to server (SSOT)
			await ctx.acceptAll()

			// Set all consents to true locally
			const allConsents: Record<string, boolean> = {}
			for (const type of types) {
				allConsents[type.slug] = true
			}
			setConsentsState(allConsents)

			setShowBanner(false)
		} catch (err) {
			setError(err instanceof Error ? err : new Error('Failed to accept consents'))
			throw err
		} finally {
			setIsLoading(false)
		}
	}, [ctx, types])

	const declineOptional = useCallback(async () => {
		setIsLoading(true)
		setError(null)

		try {
			// Save to server (SSOT)
			await ctx.declineOptional()

			// Set only required consents to true
			const requiredConsents: Record<string, boolean> = {}
			for (const type of types) {
				requiredConsents[type.slug] = type.required
			}
			setConsentsState(requiredConsents)

			setShowBanner(false)
		} catch (err) {
			setError(err instanceof Error ? err : new Error('Failed to decline consents'))
			throw err
		} finally {
			setIsLoading(false)
		}
	}, [ctx, types])

	const openPreferences = useCallback(() => {
		setShowBanner(true)
	}, [])

	const closeBanner = useCallback(() => {
		setShowBanner(false)
	}, [])

	return {
		types,
		consents,
		isLoading,
		error,
		showBanner,
		hasConsented,
		hasConsent,
		setConsent,
		setConsents,
		acceptAll,
		declineOptional,
		saveConsents,
		openPreferences,
		closeBanner,
	}
}

// ============================================
// useConsentGate
// ============================================

export interface UseConsentGateOptions {
	/** Required consent category */
	category: ConsentCategory
	/** Called when consent is granted */
	onConsent?: () => void
	/** Called when consent is denied */
	onDeny?: () => void
}

export interface UseConsentGateReturn {
	/** Whether the required consent is granted */
	hasConsent: boolean
	/** Whether consent data is loading */
	isLoading: boolean
	/** Request consent (opens preferences) */
	requestConsent: () => void
}

/**
 * Hook to gate functionality behind consent
 *
 * @example
 * ```tsx
 * function AnalyticsLoader() {
 *   const { hasConsent, isLoading } = useConsentGate({
 *     category: 'analytics',
 *     onConsent: () => initAnalytics(),
 *   })
 *
 *   if (isLoading) return null
 *   if (!hasConsent) return null
 *
 *   return <AnalyticsProvider />
 * }
 * ```
 */
export function useConsentGate(options: UseConsentGateOptions): UseConsentGateReturn {
	const { hasConsent: checkConsent, isLoading, openPreferences } = useConsent()
	const hasConsent = checkConsent(options.category)

	useEffect(() => {
		if (!isLoading) {
			if (hasConsent) {
				options.onConsent?.()
			} else {
				options.onDeny?.()
			}
		}
	}, [hasConsent, isLoading, options])

	return {
		hasConsent,
		isLoading,
		requestConsent: openPreferences,
	}
}

// ============================================
// ConsentGuard Component
// ============================================

export interface ConsentGuardProps {
	/** Required consent category */
	category: ConsentCategory
	/** Content to render when consent is granted */
	children: React.ReactNode
	/** Fallback content when consent is denied */
	fallback?: React.ReactNode
	/** Show loading state */
	loading?: React.ReactNode
}

/**
 * Component to gate children behind consent
 *
 * @example
 * ```tsx
 * <ConsentGuard
 *   category="marketing"
 *   fallback={<p>Enable marketing to see personalized content</p>}
 * >
 *   <MarketingBanner />
 * </ConsentGuard>
 * ```
 */
export function ConsentGuard({
	category,
	children,
	fallback = null,
	loading = null,
}: ConsentGuardProps): React.ReactNode {
	const { hasConsent, isLoading } = useConsentGate({ category })

	if (isLoading) return loading
	if (!hasConsent) return fallback
	return children
}

// The useConsent hook is the primary export for consent management.
// Additional exports:
// - useConsentGate for gating features behind consent
// - ConsentGuard for gating components behind consent
