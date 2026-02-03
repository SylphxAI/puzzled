/**
 * Consent Hooks
 *
 * React hooks for GDPR/CCPA consent management.
 * Uses server as Single Source of Truth (SSOT) - no local localStorage duplication.
 *
 * ## Architecture (ADR-004)
 *
 * Consent uses **Inline Defaults + Auto-Discovery + Console Override**:
 * - Code provides optional inline defaults when checking consent
 * - Platform auto-discovers/creates consent types when first referenced
 * - Console can override names, descriptions, requirements without deployment
 *
 * ## React Query Integration
 *
 * All hooks use React Query for:
 * - Automatic caching (5 min staleTime for consent data)
 * - Deduplication of concurrent requests
 * - Background refetching
 * - Optimistic updates via useMutation
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { STALE_TIME_STABLE_MS } from '../constants'
import { useContext } from 'react'
import {
	useConsentContext,
	ConsentContext,
	type ConsentCategory,
	type ConsentType,
	type UserConsent,
} from './services-context'
import type { ConsentPurposeDefaults } from '../consent'

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
	/**
	 * Grant consent for a category and save immediately (Google Consent Mode v2 pattern)
	 *
	 * Equivalent to: `gtag('consent', 'update', { analytics_storage: 'granted' })`
	 *
	 * @example
	 * ```typescript
	 * // Grant analytics consent when user clicks "Accept Analytics"
	 * await grantConsent('analytics')
	 * ```
	 */
	grantConsent: (category: ConsentCategory) => Promise<void>
	/**
	 * Revoke consent for a category and save immediately (Google Consent Mode v2 pattern)
	 *
	 * Equivalent to: `gtag('consent', 'update', { analytics_storage: 'denied' })`
	 *
	 * @example
	 * ```typescript
	 * // Revoke marketing consent
	 * await revokeConsent('marketing')
	 * ```
	 */
	revokeConsent: (category: ConsentCategory) => Promise<void>
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
	const queryClient = useQueryClient()

	// Local state for user selections (before saving)
	const [localConsents, setLocalConsentsState] = useState<Record<string, boolean>>({})
	const [showBanner, setShowBanner] = useState(false)
	const [initialized, setInitialized] = useState(false)

	// React Query for consent types
	// Use initialData for SSR hydration to avoid loading states
	const typesQuery = useQuery({
		queryKey: ['sylphx', 'consent', 'types'],
		queryFn: () => ctx.getConsentTypes(),
		staleTime: STALE_TIME_STABLE_MS, // 5 min
		initialData: ctx.initialConsentTypes,
	})

	// React Query for user consents
	// Note: Errors are NOT silently swallowed - GDPR compliance requires explicit handling
	const userConsentsQuery = useQuery({
		queryKey: ['sylphx', 'consent', 'user'],
		queryFn: async () => {
			const consentsResponse = await ctx.getUserConsents()
			const consentsMap: Record<string, boolean> = {}
			// Check if user has explicitly made any consent choices
			// If grantedAt is set, user has made an explicit choice
			let hasExplicitChoice = false
			for (const consent of consentsResponse) {
				consentsMap[consent.slug] = consent.granted ?? false
				if (consent.grantedAt) {
					hasExplicitChoice = true
				}
			}
			return { consents: consentsMap, hasExplicitChoice }
		},
		staleTime: STALE_TIME_STABLE_MS, // 5 min
		// Return empty object for unauthenticated users (explicit retry: false)
		retry: false,
	})

	// Initialize local state and banner visibility when data loads
	useEffect(() => {
		if (!typesQuery.isLoading && !userConsentsQuery.isLoading && !initialized) {
			const data = userConsentsQuery.data
			const serverConsents = data?.consents ?? {}
			const hasExplicitChoice = data?.hasExplicitChoice ?? false
			setLocalConsentsState(serverConsents)
			// Show banner if user has NOT made any explicit consent choices
			setShowBanner(!hasExplicitChoice)
			setInitialized(true)
		}
	}, [typesQuery.isLoading, userConsentsQuery.isLoading, userConsentsQuery.data, initialized])

	// Mutations for saving consents
	const saveConsentsMutation = useMutation({
		mutationFn: async (consentList: Array<{ slug: string; granted: boolean }>) => {
			await ctx.setConsents(consentList)
			return consentList
		},
		onSuccess: (consentList) => {
			// Update cache with saved values
			const consentsMap: Record<string, boolean> = {}
			for (const consent of consentList) {
				consentsMap[consent.slug] = consent.granted
			}
			queryClient.setQueryData(['sylphx', 'consent', 'user'], { consents: consentsMap, hasExplicitChoice: true })
			setLocalConsentsState(consentsMap)
			setShowBanner(false)
		},
	})

	const acceptAllMutation = useMutation({
		mutationFn: async () => {
			await ctx.acceptAll()
		},
		onSuccess: () => {
			// Set all consents to true
			const types = typesQuery.data ?? []
			const allConsents: Record<string, boolean> = {}
			for (const type of types) {
				allConsents[type.slug] = true
			}
			queryClient.setQueryData(['sylphx', 'consent', 'user'], { consents: allConsents, hasExplicitChoice: true })
			setLocalConsentsState(allConsents)
			setShowBanner(false)
		},
	})

	const declineOptionalMutation = useMutation({
		mutationFn: async () => {
			await ctx.declineOptional()
		},
		onSuccess: () => {
			// Set only required consents to true
			const types = typesQuery.data ?? []
			const requiredConsents: Record<string, boolean> = {}
			for (const type of types) {
				requiredConsents[type.slug] = type.required
			}
			queryClient.setQueryData(['sylphx', 'consent', 'user'], { consents: requiredConsents, hasExplicitChoice: true })
			setLocalConsentsState(requiredConsents)
			setShowBanner(false)
		},
	})

	const types = typesQuery.data ?? []
	const consents = localConsents
	const hasConsented = userConsentsQuery.data?.hasExplicitChoice ?? false
	const isLoading = typesQuery.isLoading || userConsentsQuery.isLoading
	const error = (typesQuery.error ?? userConsentsQuery.error ?? saveConsentsMutation.error ?? acceptAllMutation.error ?? declineOptionalMutation.error) as Error | null

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
		setLocalConsentsState((prev) => ({ ...prev, [typeId]: value }))
	}, [])

	const setConsents = useCallback((newConsents: Record<string, boolean>) => {
		setLocalConsentsState((prev) => ({ ...prev, ...newConsents }))
	}, [])

	const saveConsents = useCallback(async () => {
		const consentList = types.map((type) => ({
			slug: type.slug,
			granted: consents[type.slug] ?? type.defaultEnabled,
		}))
		await saveConsentsMutation.mutateAsync(consentList)
	}, [types, consents, saveConsentsMutation])

	const acceptAll = useCallback(async () => {
		await acceptAllMutation.mutateAsync()
	}, [acceptAllMutation])

	const declineOptional = useCallback(async () => {
		await declineOptionalMutation.mutateAsync()
	}, [declineOptionalMutation])

	const openPreferences = useCallback(() => {
		setShowBanner(true)
	}, [])

	const closeBanner = useCallback(() => {
		setShowBanner(false)
	}, [])

	/**
	 * Grant consent for a specific category and save immediately
	 * (Google Consent Mode v2 pattern: single call to grant and persist)
	 */
	const grantConsent = useCallback(
		async (category: ConsentCategory) => {
			// Find all types in this category
			const categoryTypes = types.filter((t) => t.category === category)
			if (categoryTypes.length === 0) return

			// Build updated consents
			const updatedConsents: Record<string, boolean> = { ...consents }
			for (const type of categoryTypes) {
				updatedConsents[type.slug] = true
			}
			setLocalConsentsState(updatedConsents)

			// Save immediately
			const consentList = types.map((type) => ({
				slug: type.slug,
				granted: updatedConsents[type.slug] ?? type.defaultEnabled,
			}))
			await saveConsentsMutation.mutateAsync(consentList)
		},
		[types, consents, saveConsentsMutation]
	)

	/**
	 * Revoke consent for a specific category and save immediately
	 * (Google Consent Mode v2 pattern: single call to revoke and persist)
	 */
	const revokeConsent = useCallback(
		async (category: ConsentCategory) => {
			// Find all types in this category
			const categoryTypes = types.filter((t) => t.category === category)
			if (categoryTypes.length === 0) return

			// Build updated consents (only revoke non-required types)
			const updatedConsents: Record<string, boolean> = { ...consents }
			for (const type of categoryTypes) {
				// Required consents cannot be revoked
				if (!type.required) {
					updatedConsents[type.slug] = false
				}
			}
			setLocalConsentsState(updatedConsents)

			// Save immediately
			const consentList = types.map((type) => ({
				slug: type.slug,
				granted: updatedConsents[type.slug] ?? type.defaultEnabled,
			}))
			await saveConsentsMutation.mutateAsync(consentList)
		},
		[types, consents, saveConsentsMutation]
	)

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
		grantConsent,
		revokeConsent,
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

// ============================================
// useConsentCheck (Auto-Discovery)
// ============================================

// Re-export ConsentPurposeDefaults for convenience


export interface UseConsentCheckOptions {
	/** Consent purpose slug (e.g., 'analytics', 'marketing') */
	purposeSlug: string
	/** Optional inline defaults for auto-discovery */
	defaults?: ConsentPurposeDefaults
}

export interface UseConsentCheckReturn {
	/** Whether consent is granted */
	hasConsent: boolean
	/** Whether consent check is loading */
	isLoading: boolean
	/** Error if any */
	error: Error | null
	/** Refresh consent status */
	refresh: () => Promise<void>
}

/**
 * Hook to check consent for a specific purpose with auto-discovery support
 *
 * If the consent type doesn't exist, it will be auto-discovered with the provided defaults.
 * Console can override any values without deployment.
 *
 * @param options - Purpose slug and optional inline defaults
 *
 * @example
 * ```tsx
 * function AnalyticsTracker() {
 *   const { hasConsent, isLoading } = useConsentCheck({
 *     purposeSlug: 'analytics',
 *     defaults: {
 *       name: 'Analytics Cookies',
 *       description: 'Help us understand how visitors use our site',
 *       category: 'analytics',
 *       required: false,
 *     },
 *   })
 *
 *   useEffect(() => {
 *     if (!isLoading && hasConsent) {
 *       // Initialize analytics
 *       track('page_view')
 *     }
 *   }, [hasConsent, isLoading])
 *
 *   return null
 * }
 * ```
 */
export function useConsentCheck(options: UseConsentCheckOptions): UseConsentCheckReturn {
	const ctx = useConsentContext()
	const queryClient = useQueryClient()

	// React Query for consent check
	const consentQuery = useQuery({
		queryKey: ['sylphx', 'consent', 'check', options.purposeSlug, options.defaults],
		queryFn: () => ctx.checkConsent(options.purposeSlug, options.defaults),
		staleTime: STALE_TIME_STABLE_MS, // 5 min
	})

	// Refresh via React Query
	const refresh = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: ['sylphx', 'consent', 'check', options.purposeSlug],
		})
	}, [queryClient, options.purposeSlug])

	return {
		hasConsent: consentQuery.data ?? false,
		isLoading: consentQuery.isLoading,
		error: consentQuery.error as Error | null,
		refresh,
	}
}

// ============================================
// Safe Versions (for SSR/prerendering)
// ============================================

// No-op async function for safe hooks
const noopAsync = async () => {}

/** Safe return type for useConsent when outside provider */
export interface UseSafeConsentReturn {
	types: ConsentType[]
	consents: Record<string, boolean>
	isLoading: boolean
	error: Error | null
	showBanner: boolean
	hasConsented: boolean
	hasConsent: (category: ConsentCategory) => boolean
	setConsent: (typeId: string, value: boolean) => void
	setConsents: (consents: Record<string, boolean>) => void
	acceptAll: () => Promise<void>
	declineOptional: () => Promise<void>
	saveConsents: () => Promise<void>
	openPreferences: () => void
	closeBanner: () => void
	grantConsent: (category: ConsentCategory) => Promise<void>
	revokeConsent: (category: ConsentCategory) => Promise<void>
	isConfigured: boolean
}

/**
 * SSR-safe version of useConsent
 *
 * Returns safe defaults when called outside SylphxProvider.
 * Use this in components that may render during static generation.
 */
export function useSafeConsent(): UseSafeConsentReturn {
	const ctx = useContext(ConsentContext)

	// If no context, return safe defaults
	if (!ctx) {
		return {
			types: [],
			consents: {},
			isLoading: false,
			error: null,
			showBanner: false,
			hasConsented: false,
			hasConsent: () => false,
			setConsent: () => {},
			setConsents: () => {},
			acceptAll: noopAsync,
			declineOptional: noopAsync,
			saveConsents: noopAsync,
			openPreferences: () => {},
			closeBanner: () => {},
			grantConsent: noopAsync,
			revokeConsent: noopAsync,
			isConfigured: false,
		}
	}

	// Use the standard hook when context is available
	const queryClient = useQueryClient()

	// Local state for user selections (before saving)
	const [localConsents, setLocalConsentsState] = useState<Record<string, boolean>>({})
	const [showBanner, setShowBanner] = useState(false)
	const [initialized, setInitialized] = useState(false)

	// React Query for consent types
	// Use initialData for SSR hydration to avoid loading states
	const typesQuery = useQuery({
		queryKey: ['sylphx', 'consent', 'types'],
		queryFn: () => ctx.getConsentTypes(),
		staleTime: STALE_TIME_STABLE_MS,
		initialData: ctx.initialConsentTypes,
	})

	// React Query for user consents
	// Note: Errors are NOT silently swallowed - GDPR compliance requires explicit handling
	const userConsentsQuery = useQuery({
		queryKey: ['sylphx', 'consent', 'user'],
		queryFn: async () => {
			const consentsResponse = await ctx.getUserConsents()
			const consentsMap: Record<string, boolean> = {}
			// Check if user has explicitly made any consent choices
			let hasExplicitChoice = false
			for (const consent of consentsResponse) {
				consentsMap[consent.slug] = consent.granted ?? false
				if (consent.grantedAt) {
					hasExplicitChoice = true
				}
			}
			return { consents: consentsMap, hasExplicitChoice }
		},
		staleTime: STALE_TIME_STABLE_MS,
		// Return empty object for unauthenticated users (explicit retry: false)
		retry: false,
	})

	// Initialize local state and banner visibility when data loads
	useEffect(() => {
		if (!typesQuery.isLoading && !userConsentsQuery.isLoading && !initialized) {
			const data = userConsentsQuery.data
			const serverConsents = data?.consents ?? {}
			const hasExplicitChoice = data?.hasExplicitChoice ?? false
			setLocalConsentsState(serverConsents)
			// Show banner if user has NOT made any explicit consent choices
			setShowBanner(!hasExplicitChoice)
			setInitialized(true)
		}
	}, [typesQuery.isLoading, userConsentsQuery.isLoading, userConsentsQuery.data, initialized])

	// Mutations for saving consents
	const saveConsentsMutation = useMutation({
		mutationFn: async (consentList: Array<{ slug: string; granted: boolean }>) => {
			await ctx.setConsents(consentList)
			return consentList
		},
		onSuccess: (consentList) => {
			const consentsMap: Record<string, boolean> = {}
			for (const consent of consentList) {
				consentsMap[consent.slug] = consent.granted
			}
			queryClient.setQueryData(['sylphx', 'consent', 'user'], { consents: consentsMap, hasExplicitChoice: true })
			setLocalConsentsState(consentsMap)
			setShowBanner(false)
		},
	})

	const acceptAllMutation = useMutation({
		mutationFn: async () => {
			await ctx.acceptAll()
		},
		onSuccess: () => {
			const types = typesQuery.data ?? []
			const allConsents: Record<string, boolean> = {}
			for (const type of types) {
				allConsents[type.slug] = true
			}
			queryClient.setQueryData(['sylphx', 'consent', 'user'], { consents: allConsents, hasExplicitChoice: true })
			setLocalConsentsState(allConsents)
			setShowBanner(false)
		},
	})

	const declineOptionalMutation = useMutation({
		mutationFn: async () => {
			await ctx.declineOptional()
		},
		onSuccess: () => {
			const types = typesQuery.data ?? []
			const requiredConsents: Record<string, boolean> = {}
			for (const type of types) {
				requiredConsents[type.slug] = type.required
			}
			queryClient.setQueryData(['sylphx', 'consent', 'user'], { consents: requiredConsents, hasExplicitChoice: true })
			setLocalConsentsState(requiredConsents)
			setShowBanner(false)
		},
	})

	const types = typesQuery.data ?? []
	const consents = localConsents
	const hasConsented = userConsentsQuery.data?.hasExplicitChoice ?? false
	const isLoading = typesQuery.isLoading || userConsentsQuery.isLoading
	const error = (typesQuery.error ?? userConsentsQuery.error ?? saveConsentsMutation.error ?? acceptAllMutation.error ?? declineOptionalMutation.error) as Error | null

	const hasConsentFn = useCallback(
		(category: ConsentCategory): boolean => {
			if (category === 'necessary') return true
			const categoryTypes = types.filter((t) => t.category === category)
			return categoryTypes.some((t) => consents[t.slug] ?? t.defaultEnabled)
		},
		[types, consents]
	)

	const setConsent = useCallback((typeId: string, value: boolean) => {
		setLocalConsentsState((prev) => ({ ...prev, [typeId]: value }))
	}, [])

	const setConsents = useCallback((newConsents: Record<string, boolean>) => {
		setLocalConsentsState((prev) => ({ ...prev, ...newConsents }))
	}, [])

	const saveConsents = useCallback(async () => {
		const consentList = types.map((type) => ({
			slug: type.slug,
			granted: consents[type.slug] ?? type.defaultEnabled,
		}))
		await saveConsentsMutation.mutateAsync(consentList)
	}, [types, consents, saveConsentsMutation])

	const acceptAll = useCallback(async () => {
		await acceptAllMutation.mutateAsync()
	}, [acceptAllMutation])

	const declineOptional = useCallback(async () => {
		await declineOptionalMutation.mutateAsync()
	}, [declineOptionalMutation])

	const openPreferences = useCallback(() => {
		setShowBanner(true)
	}, [])

	const closeBanner = useCallback(() => {
		setShowBanner(false)
	}, [])

	/**
	 * Grant consent for a specific category and save immediately
	 */
	const grantConsent = useCallback(
		async (category: ConsentCategory) => {
			const categoryTypes = types.filter((t) => t.category === category)
			if (categoryTypes.length === 0) return

			const updatedConsents: Record<string, boolean> = { ...consents }
			for (const type of categoryTypes) {
				updatedConsents[type.slug] = true
			}
			setLocalConsentsState(updatedConsents)

			const consentList = types.map((type) => ({
				slug: type.slug,
				granted: updatedConsents[type.slug] ?? type.defaultEnabled,
			}))
			await saveConsentsMutation.mutateAsync(consentList)
		},
		[types, consents, saveConsentsMutation]
	)

	/**
	 * Revoke consent for a specific category and save immediately
	 */
	const revokeConsent = useCallback(
		async (category: ConsentCategory) => {
			const categoryTypes = types.filter((t) => t.category === category)
			if (categoryTypes.length === 0) return

			const updatedConsents: Record<string, boolean> = { ...consents }
			for (const type of categoryTypes) {
				if (!type.required) {
					updatedConsents[type.slug] = false
				}
			}
			setLocalConsentsState(updatedConsents)

			const consentList = types.map((type) => ({
				slug: type.slug,
				granted: updatedConsents[type.slug] ?? type.defaultEnabled,
			}))
			await saveConsentsMutation.mutateAsync(consentList)
		},
		[types, consents, saveConsentsMutation]
	)

	return {
		types,
		consents,
		isLoading,
		error,
		showBanner,
		hasConsented,
		hasConsent: hasConsentFn,
		setConsent,
		setConsents,
		acceptAll,
		declineOptional,
		saveConsents,
		openPreferences,
		closeBanner,
		grantConsent,
		revokeConsent,
		isConfigured: true,
	}
}

// The useConsent hook is the primary export for consent management.
// Additional exports:
// - useConsentGate for gating features behind consent
// - ConsentGuard for gating components behind consent
// - useConsentCheck for checking specific purposes with auto-discovery
// - useSafeConsent for SSR-safe consent management
