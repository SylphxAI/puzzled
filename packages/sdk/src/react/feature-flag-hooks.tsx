/**
 * Feature Flag Hooks
 *
 * React hooks for feature flag management.
 * Enables gradual rollouts, A/B testing, and feature gating.
 */

'use client'

import { useState, useEffect, useCallback, useRef, createContext, useContext, type ReactNode } from 'react'
import type { EvaluationReason, FeatureFlagDetailResult } from '../types'

// ============================================
// Types
// ============================================

export type FlagValue = boolean | string | number | Record<string, unknown>

export interface FeatureFlag {
	key: string
	value: FlagValue
	enabled: boolean
	variant?: string
	payload?: Record<string, unknown>
}

export interface FlagOverrides {
	[key: string]: FlagValue
}

export interface FeatureFlagContextValue {
	/** Get a flag value */
	getFlag: (key: string) => FlagValue | undefined
	/** Check if a boolean flag is enabled */
	isEnabled: (key: string) => boolean
	/** Get flag variant (for A/B tests) */
	getVariant: (key: string) => string | undefined
	/** All loaded flags */
	flags: Map<string, FeatureFlag>
	/** Whether flags are loading */
	isLoading: boolean
	/** Error loading flags */
	error: Error | null
	/** Refresh flags from server */
	refresh: () => Promise<void>
	/** Local overrides for testing */
	overrides: FlagOverrides
	/** Set a local override */
	setOverride: (key: string, value: FlagValue) => void
	/** Clear all overrides */
	clearOverrides: () => void
}

// ============================================
// Context
// ============================================

const FeatureFlagContext = createContext<FeatureFlagContextValue | null>(null)

export interface FeatureFlagProviderProps {
	children: ReactNode
	/** API endpoint to fetch flags */
	endpoint?: string
	/** Initial flags (for SSR) */
	initialFlags?: FeatureFlag[]
	/** User context for flag evaluation */
	userContext?: {
		userId?: string
		email?: string
		attributes?: Record<string, unknown>
	}
	/** Refresh interval in ms (0 to disable) */
	refreshInterval?: number
	/** Enable localStorage caching */
	enableCache?: boolean
}

const CACHE_KEY = 'sylphx_feature_flags'

/**
 * Feature Flag Provider
 *
 * @example
 * ```tsx
 * <FeatureFlagProvider
 *   endpoint="/api/flags"
 *   userContext={{ userId: user.id }}
 * >
 *   <App />
 * </FeatureFlagProvider>
 * ```
 */
export function FeatureFlagProvider({
	children,
	endpoint = '/api/flags',
	initialFlags = [],
	userContext,
	refreshInterval = 0,
	enableCache = true,
}: FeatureFlagProviderProps) {
	const [flags, setFlags] = useState<Map<string, FeatureFlag>>(() => {
		const map = new Map<string, FeatureFlag>()
		initialFlags.forEach(flag => map.set(flag.key, flag))
		return map
	})
	const [isLoading, setIsLoading] = useState(!initialFlags.length)
	const [error, setError] = useState<Error | null>(null)
	const [overrides, setOverrides] = useState<FlagOverrides>(() => {
		if (typeof window === 'undefined') return {}
		try {
			const stored = localStorage.getItem(`${CACHE_KEY}_overrides`)
			return stored ? JSON.parse(stored) : {}
		} catch {
			return {}
		}
	})

	const userContextRef = useRef(userContext)
	userContextRef.current = userContext

	// Load cached flags on mount
	useEffect(() => {
		if (!enableCache || typeof window === 'undefined') return
		try {
			const cached = localStorage.getItem(CACHE_KEY)
			if (cached && !initialFlags.length) {
				const parsed = JSON.parse(cached) as FeatureFlag[]
				const map = new Map<string, FeatureFlag>()
				parsed.forEach(flag => map.set(flag.key, flag))
				setFlags(map)
			}
		} catch {
			// Ignore cache errors
		}
	}, [enableCache, initialFlags.length])

	// Fetch flags from server
	const fetchFlags = useCallback(async () => {
		try {
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ context: userContextRef.current }),
			})

			if (!response.ok) {
				throw new Error(`Failed to fetch flags: ${response.status}`)
			}

			const data = await response.json()
			const flagList = data.flags as FeatureFlag[]

			const map = new Map<string, FeatureFlag>()
			flagList.forEach(flag => map.set(flag.key, flag))
			setFlags(map)
			setError(null)

			// Cache flags
			if (enableCache && typeof window !== 'undefined') {
				localStorage.setItem(CACHE_KEY, JSON.stringify(flagList))
			}
		} catch (err) {
			setError(err instanceof Error ? err : new Error('Failed to fetch flags'))
		} finally {
			setIsLoading(false)
		}
	}, [endpoint, enableCache])

	// Initial fetch
	useEffect(() => {
		if (!initialFlags.length) {
			fetchFlags()
		}
	}, [fetchFlags, initialFlags.length])

	// Refresh interval
	useEffect(() => {
		if (refreshInterval <= 0) return
		const interval = setInterval(fetchFlags, refreshInterval)
		return () => clearInterval(interval)
	}, [refreshInterval, fetchFlags])

	// Get flag value (with override support)
	const getFlag = useCallback(
		(key: string): FlagValue | undefined => {
			if (key in overrides) {
				return overrides[key]
			}
			const flag = flags.get(key)
			return flag?.value
		},
		[flags, overrides]
	)

	// Check if boolean flag is enabled
	const isEnabled = useCallback(
		(key: string): boolean => {
			if (key in overrides) {
				return Boolean(overrides[key])
			}
			const flag = flags.get(key)
			return flag?.enabled ?? false
		},
		[flags, overrides]
	)

	// Get variant for A/B tests
	const getVariant = useCallback(
		(key: string): string | undefined => {
			const flag = flags.get(key)
			return flag?.variant
		},
		[flags]
	)

	// Override management
	const setOverride = useCallback((key: string, value: FlagValue) => {
		setOverrides(prev => {
			const next = { ...prev, [key]: value }
			if (typeof window !== 'undefined') {
				localStorage.setItem(`${CACHE_KEY}_overrides`, JSON.stringify(next))
			}
			return next
		})
	}, [])

	const clearOverrides = useCallback(() => {
		setOverrides({})
		if (typeof window !== 'undefined') {
			localStorage.removeItem(`${CACHE_KEY}_overrides`)
		}
	}, [])

	const value: FeatureFlagContextValue = {
		getFlag,
		isEnabled,
		getVariant,
		flags,
		isLoading,
		error,
		refresh: fetchFlags,
		overrides,
		setOverride,
		clearOverrides,
	}

	return <FeatureFlagContext.Provider value={value}>{children}</FeatureFlagContext.Provider>
}

// ============================================
// useFeatureFlag
// ============================================

export interface UseFeatureFlagOptions<T extends FlagValue = boolean> {
	/** Default value if flag not found */
	defaultValue?: T
	/** Track flag exposure for analytics */
	trackExposure?: boolean
}

export interface UseFeatureFlagReturn<T extends FlagValue = boolean> {
	/** Flag value */
	value: T
	/** Whether flag is enabled (for boolean flags) */
	isEnabled: boolean
	/** Flag variant (for A/B tests) */
	variant: string | undefined
	/** Whether flags are loading */
	isLoading: boolean
	/** Error loading flags */
	error: Error | null
}

/**
 * Hook to get a feature flag value
 *
 * @example
 * ```tsx
 * function NewFeature() {
 *   const { isEnabled, isLoading } = useFeatureFlag('new-dashboard')
 *
 *   if (isLoading) return <Skeleton />
 *
 *   if (!isEnabled) {
 *     return <OldDashboard />
 *   }
 *
 *   return <NewDashboard />
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With A/B testing
 * function PricingPage() {
 *   const { variant, isLoading } = useFeatureFlag('pricing-experiment')
 *
 *   if (isLoading) return <Skeleton />
 *
 *   switch (variant) {
 *     case 'control': return <OriginalPricing />
 *     case 'variant-a': return <NewPricingA />
 *     case 'variant-b': return <NewPricingB />
 *     default: return <OriginalPricing />
 *   }
 * }
 * ```
 */
export function useFeatureFlag<T extends FlagValue = boolean>(
	key: string,
	options: UseFeatureFlagOptions<T> = {}
): UseFeatureFlagReturn<T> {
	const context = useContext(FeatureFlagContext)

	if (!context) {
		// Return default if no provider (for testing/SSR)
		return {
			value: (options.defaultValue ?? false) as T,
			isEnabled: Boolean(options.defaultValue),
			variant: undefined,
			isLoading: false,
			error: null,
		}
	}

	const { getFlag, isEnabled, getVariant, isLoading, error } = context

	const flagValue = getFlag(key)
	const value = (flagValue ?? options.defaultValue ?? false) as T
	const enabled = isEnabled(key)
	const variant = getVariant(key)

	return {
		value,
		isEnabled: enabled,
		variant,
		isLoading,
		error,
	}
}

// ============================================
// useFeatureFlags (bulk)
// ============================================

/**
 * Hook to get multiple feature flags at once
 *
 * @example
 * ```tsx
 * function App() {
 *   const flags = useFeatureFlags(['new-ui', 'dark-mode', 'beta-features'])
 *
 *   return (
 *     <div className={flags['dark-mode'] ? 'dark' : ''}>
 *       {flags['new-ui'] ? <NewUI /> : <OldUI />}
 *     </div>
 *   )
 * }
 * ```
 */
export function useFeatureFlags(keys: string[]): Record<string, boolean> {
	const context = useContext(FeatureFlagContext)

	if (!context) {
		return keys.reduce(
			(acc, key) => {
				acc[key] = false
				return acc
			},
			{} as Record<string, boolean>
		)
	}

	return keys.reduce(
		(acc, key) => {
			acc[key] = context.isEnabled(key)
			return acc
		},
		{} as Record<string, boolean>
	)
}

// ============================================
// useFlagOverrides (for dev/testing)
// ============================================

/**
 * Hook to manage flag overrides (for development/testing)
 *
 * @example
 * ```tsx
 * function DevTools() {
 *   const { overrides, setOverride, clearOverrides } = useFlagOverrides()
 *
 *   return (
 *     <div>
 *       <h3>Flag Overrides</h3>
 *       <button onClick={() => setOverride('new-feature', true)}>
 *         Enable new-feature
 *       </button>
 *       <button onClick={clearOverrides}>Clear All</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useFlagOverrides() {
	const context = useContext(FeatureFlagContext)

	if (!context) {
		return {
			overrides: {} as FlagOverrides,
			setOverride: () => {},
			clearOverrides: () => {},
		}
	}

	return {
		overrides: context.overrides,
		setOverride: context.setOverride,
		clearOverrides: context.clearOverrides,
	}
}

// ============================================
// useFeatureFlagWithDetail (detailed evaluation)
// ============================================

export interface UseFeatureFlagDetailOptions {
	/** Default value if flag not found */
	defaultValue?: boolean
	/** User context for targeting rules */
	userContext?: {
		isPremium?: boolean
		isAdmin?: boolean
	}
}

export interface UseFeatureFlagDetailReturn {
	/** Flag value */
	enabled: boolean
	/** Whether flags are loading */
	isLoading: boolean
	/** Error loading flags */
	error: Error | null
	/** Full evaluation detail (null while loading) */
	detail: FeatureFlagDetailResult | null
	/** Evaluation reason (null while loading) */
	reason: EvaluationReason | null
	/** Rollout bucket for this user (for debugging) */
	rolloutBucket: number | null
}

/**
 * Hook to get a feature flag with detailed evaluation information
 *
 * LaunchDarkly-style detailed evaluation with full reason metadata.
 * Useful for debugging, analytics, and understanding rollout behavior.
 *
 * @example
 * ```tsx
 * function DebugPanel() {
 *   const { enabled, reason, rolloutBucket, detail } = useFeatureFlagWithDetail('new-feature')
 *
 *   return (
 *     <div>
 *       <p>Enabled: {enabled ? 'Yes' : 'No'}</p>
 *       <p>Reason: {reason?.kind} - {reason?.description}</p>
 *       {rolloutBucket !== null && (
 *         <p>Rollout bucket: {rolloutBucket}/100</p>
 *       )}
 *     </div>
 *   )
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With user context for targeting
 * function PremiumFeature() {
 *   const { enabled, reason } = useFeatureFlagWithDetail('premium-feature', {
 *     userContext: { isPremium: true }
 *   })
 *
 *   if (!enabled) {
 *     console.log(`Feature disabled: ${reason?.description}`)
 *     return <UpgradePrompt />
 *   }
 *
 *   return <PremiumContent />
 * }
 * ```
 */
export function useFeatureFlagWithDetail(
	key: string,
	options: UseFeatureFlagDetailOptions = {}
): UseFeatureFlagDetailReturn {
	const [detail, setDetail] = useState<FeatureFlagDetailResult | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<Error | null>(null)

	const optionsRef = useRef(options)
	optionsRef.current = options

	useEffect(() => {
		let cancelled = false

		const fetchDetail = async () => {
			try {
				const response = await fetch(`/api/flags/${encodeURIComponent(key)}/detail`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ userContext: optionsRef.current.userContext }),
				})

				if (!response.ok) {
					throw new Error(`Failed to fetch flag detail: ${response.status}`)
				}

				const data = await response.json()
				if (!cancelled) {
					setDetail(data)
					setError(null)
				}
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err : new Error('Failed to fetch flag detail'))
				}
			} finally {
				if (!cancelled) {
					setIsLoading(false)
				}
			}
		}

		fetchDetail()

		return () => {
			cancelled = true
		}
	}, [key])

	const enabled = detail?.enabled ?? options.defaultValue ?? false
	const reason = detail?.reason ?? null
	const rolloutBucket =
		detail?.reason && typeof detail.reason === 'object' && 'rolloutBucket' in detail.reason
			? (detail.reason as { rolloutBucket?: number }).rolloutBucket ?? null
			: null

	return {
		enabled,
		isLoading,
		error,
		detail,
		reason,
		rolloutBucket,
	}
}

// Re-export types for convenience
export type { EvaluationReason, FeatureFlagDetailResult }
