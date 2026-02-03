/**
 * Feature Flags React Hooks (SOTA - State of the Art)
 *
 * Production-grade feature flags with:
 * - SSE streaming for real-time updates
 * - Local evaluation with complex targeting rules
 * - Consistent bucketing for A/B tests
 * - ExperimentManager for experiment tracking
 *
 * ## When to Use This vs Simple Flags
 *
 * USE THIS (SOTA):
 * - Real-time flag updates via SSE streaming
 * - Complex targeting rules and segments
 * - A/B testing with ExperimentManager
 * - Local evaluation with consistent bucketing
 *
 * USE SIMPLE FLAGS (feature-flag-hooks.tsx):
 * - Simple flag checks without complex targeting
 * - Apps that prefer polling over streaming
 * - When React Query is already your data layer
 *
 * @see feature-flag-hooks.tsx for simple polling implementation
 *
 * @example
 * ```tsx
 * // 1. Wrap your app with the provider
 * function App() {
 *   return (
 *     <FeatureFlagsProvider
 *       config={{
 *         streamEndpoint: '/api/flags/stream',
 *       }}
 *       context={{
 *         userId: user?.id,
 *         email: user?.email,
 *       }}
 *     >
 *       <YourApp />
 *     </FeatureFlagsProvider>
 *   )
 * }
 *
 * // 2. Use flags in components
 * function MyComponent() {
 *   const { isEnabled, getString } = useFeatureFlags()
 *
 *   if (isEnabled('new-feature')) {
 *     return <NewFeature />
 *   }
 *
 *   const variant = getString('button-text', 'Click me')
 *   return <button>{variant}</button>
 * }
 *
 * // 3. Or use individual flag hooks
 * function OtherComponent() {
 *   const showBanner = useFlag('show-banner', false)
 *   const theme = useFlagString('theme', 'light')
 *
 *   return showBanner ? <Banner theme={theme} /> : null
 * }
 * ```
 */

'use client'

import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from 'react'
import {
	LocalEvaluator,
	initFeatureFlags,
	resetEvaluator,
	FlagStream,
	createFlagStream,
	ExperimentManager,
	getExperimentManager,
} from '../../lib/flags'
import type {
	EvaluationContext,
	EvaluationResult,
	FeatureFlagsConfig,
	FlagClientEvent,
	FlagDefinition,
	FlagValue,
} from '../../lib/flags/types'

// ==========================================
// Context Types
// ==========================================

interface FeatureFlagsContextValue {
	/** The evaluator instance */
	evaluator: LocalEvaluator
	/** The stream instance (if streaming enabled) */
	stream: FlagStream | null
	/** The experiment manager */
	experiments: ExperimentManager
	/** Whether flags are ready */
	isReady: boolean
	/** Whether currently loading */
	isLoading: boolean
	/** Current error (if any) */
	error: Error | null
	/** All flag definitions */
	flags: FlagDefinition[]
	/** Update version (increments on flag updates) */
	updateVersion: number
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(null)

// ==========================================
// Provider Props
// ==========================================

export interface FeatureFlagsProviderProps {
	children: React.ReactNode
	/** Feature flags configuration */
	config?: FeatureFlagsConfig
	/** Initial evaluation context */
	context?: EvaluationContext
	/** Initial flags (for SSR) */
	initialFlags?: FlagDefinition[]
	/** Enable SSE streaming (default: true) */
	enableStreaming?: boolean
	/** Callback when flags are ready */
	onReady?: (flags: FlagDefinition[]) => void
	/** Callback on error */
	onError?: (error: Error) => void
}

// ==========================================
// Provider Component
// ==========================================

/**
 * Feature Flags Provider
 *
 * Provides feature flag context to your app.
 * Handles initialization, streaming, and context updates.
 */
export function FeatureFlagsProvider({
	children,
	config = {},
	context,
	initialFlags,
	enableStreaming = true,
	onReady,
	onError,
}: FeatureFlagsProviderProps) {
	const [isReady, setIsReady] = useState(!!initialFlags?.length)
	const [isLoading, setIsLoading] = useState(!initialFlags?.length)
	const [error, setError] = useState<Error | null>(null)
	const [updateVersion, setUpdateVersion] = useState(0)

	const evaluatorRef = useRef<LocalEvaluator | null>(null)
	const streamRef = useRef<FlagStream | null>(null)
	const experimentsRef = useRef<ExperimentManager | null>(null)

	// Initialize evaluator
	useEffect(() => {
		if (evaluatorRef.current) return

		const evaluator = initFeatureFlags({
			...config,
			onFlagsUpdated: (flags) => {
				setUpdateVersion((v) => v + 1)
				config.onFlagsUpdated?.(flags)
			},
		})

		// Set initial context
		if (context) {
			evaluator.setContext(context)
		}

		// Set initial flags if provided (SSR)
		if (initialFlags?.length) {
			evaluator.setFlags(initialFlags)
		}

		evaluatorRef.current = evaluator
		experimentsRef.current = getExperimentManager(evaluator, {
			onExposure: config.onExposure,
			debug: config.debug,
		})

		// Setup streaming if enabled
		if (enableStreaming && config.streamEndpoint) {
			const stream = createFlagStream(evaluator, {
				endpoint: config.streamEndpoint,
				environmentKey: config.environmentKey,
				debug: config.debug,
			})

			const unsubscribe = stream.subscribe((event) => {
				handleStreamEvent(event)
			})

			stream.connect()
			streamRef.current = stream

			return () => {
				unsubscribe()
				stream.disconnect()
			}
		} else {
			// No streaming - just mark as ready
			setIsReady(true)
			setIsLoading(false)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// Update context when it changes
	useEffect(() => {
		if (context && evaluatorRef.current) {
			evaluatorRef.current.setContext(context)
		}
	}, [context])

	// Handle stream events
	const handleStreamEvent = useCallback(
		(event: FlagClientEvent) => {
			switch (event.type) {
				case 'ready':
					setIsReady(true)
					setIsLoading(false)
					setError(null)
					onReady?.(event.flags)
					break

				case 'updated':
					setUpdateVersion((v) => v + 1)
					break

				case 'error':
					const err = new Error(event.error.message)
					setError(err)
					onError?.(err)
					break

				case 'stale':
					// Could show a warning to user
					break

				case 'reconnected':
					setError(null)
					break
			}
		},
		[onReady, onError]
	)

	// Build context value
	const value = useMemo<FeatureFlagsContextValue>(
		() => ({
			evaluator: evaluatorRef.current!,
			stream: streamRef.current,
			experiments: experimentsRef.current!,
			isReady,
			isLoading,
			error,
			flags: evaluatorRef.current?.getFlags() ?? [],
			updateVersion,
		}),
		[isReady, isLoading, error, updateVersion]
	)

	// Don't render until evaluator is initialized
	if (!evaluatorRef.current) {
		return null
	}

	return (
		<FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>
	)
}

// ==========================================
// Main Hook
// ==========================================

export interface UseFeatureFlagsReturn {
	/** Check if a boolean flag is enabled */
	isEnabled: (flagKey: string, defaultValue?: boolean) => boolean
	/** Get a string flag value */
	getString: (flagKey: string, defaultValue?: string) => string
	/** Get a number flag value */
	getNumber: (flagKey: string, defaultValue?: number) => number
	/** Get a JSON flag value */
	getJSON: <T extends Record<string, unknown>>(flagKey: string, defaultValue: T) => T
	/** Full evaluation with metadata */
	evaluate: <T = FlagValue>(
		flagKey: string,
		defaultValue: T,
		contextOverride?: EvaluationContext
	) => EvaluationResult<T>
	/** Whether flags are ready */
	isReady: boolean
	/** Whether currently loading */
	isLoading: boolean
	/** Current error */
	error: Error | null
	/** All flag definitions */
	flags: FlagDefinition[]
	/** Update context */
	setContext: (context: EvaluationContext) => void
	/** Update context (merge) */
	updateContext: (partial: Partial<EvaluationContext>) => void
}

/**
 * Main feature flags hook
 *
 * Provides access to flag evaluation and status.
 */
export function useFeatureFlags(): UseFeatureFlagsReturn {
	const ctx = useContext(FeatureFlagsContext)

	if (!ctx) {
		throw new Error('useFeatureFlags must be used within a FeatureFlagsProvider')
	}

	const { evaluator, isReady, isLoading, error, flags, updateVersion } = ctx

	// Create stable callbacks that re-evaluate when flags update
	const isEnabled = useCallback(
		(flagKey: string, defaultValue = false) => {
			// updateVersion ensures re-evaluation on flag changes
			void updateVersion
			return evaluator.isEnabled(flagKey, defaultValue)
		},
		[evaluator, updateVersion]
	)

	const getString = useCallback(
		(flagKey: string, defaultValue = '') => {
			void updateVersion
			return evaluator.getString(flagKey, defaultValue)
		},
		[evaluator, updateVersion]
	)

	const getNumber = useCallback(
		(flagKey: string, defaultValue = 0) => {
			void updateVersion
			return evaluator.getNumber(flagKey, defaultValue)
		},
		[evaluator, updateVersion]
	)

	const getJSON = useCallback(
		<T extends Record<string, unknown>>(flagKey: string, defaultValue: T) => {
			void updateVersion
			return evaluator.getJSON(flagKey, defaultValue)
		},
		[evaluator, updateVersion]
	)

	const evaluate = useCallback(
		<T = FlagValue>(
			flagKey: string,
			defaultValue: T,
			contextOverride?: EvaluationContext
		) => {
			void updateVersion
			return evaluator.evaluate(flagKey, defaultValue, contextOverride)
		},
		[evaluator, updateVersion]
	)

	const setContext = useCallback(
		(context: EvaluationContext) => {
			evaluator.setContext(context)
		},
		[evaluator]
	)

	const updateContext = useCallback(
		(partial: Partial<EvaluationContext>) => {
			evaluator.updateContext(partial)
		},
		[evaluator]
	)

	return {
		isEnabled,
		getString,
		getNumber,
		getJSON,
		evaluate,
		isReady,
		isLoading,
		error,
		flags,
		setContext,
		updateContext,
	}
}

// ==========================================
// Individual Flag Hooks
// ==========================================

/**
 * Hook for a single boolean flag
 */
export function useFlag(flagKey: string, defaultValue = false): boolean {
	const { isEnabled, updateVersion } = useFeatureFlagsContext()
	// Include updateVersion in deps to trigger re-render on flag changes
	return useMemo(
		() => isEnabled(flagKey, defaultValue),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[flagKey, defaultValue, updateVersion]
	)
}

/**
 * Hook for a single string flag
 */
export function useFlagString(flagKey: string, defaultValue = ''): string {
	const { getString, updateVersion } = useFeatureFlagsContext()
	return useMemo(
		() => getString(flagKey, defaultValue),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[flagKey, defaultValue, updateVersion]
	)
}

/**
 * Hook for a single number flag
 */
export function useFlagNumber(flagKey: string, defaultValue = 0): number {
	const { getNumber, updateVersion } = useFeatureFlagsContext()
	return useMemo(
		() => getNumber(flagKey, defaultValue),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[flagKey, defaultValue, updateVersion]
	)
}

/**
 * Hook for a single JSON flag
 */
export function useFlagJSON<T extends Record<string, unknown>>(
	flagKey: string,
	defaultValue: T
): T {
	const { getJSON, updateVersion } = useFeatureFlagsContext()
	return useMemo(
		() => getJSON(flagKey, defaultValue),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[flagKey, defaultValue, updateVersion]
	)
}

/**
 * Hook for full flag evaluation result
 */
export function useFlagEvaluation<T = FlagValue>(
	flagKey: string,
	defaultValue: T,
	contextOverride?: EvaluationContext
): EvaluationResult<T> {
	const { evaluate, updateVersion } = useFeatureFlagsContext()
	return useMemo(
		() => evaluate(flagKey, defaultValue, contextOverride),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[flagKey, defaultValue, contextOverride, updateVersion]
	)
}

// ==========================================
// Experiment Hooks
// ==========================================

interface UseExperimentReturn {
	/** Assigned variant */
	variant: string
	/** Whether user is in the experiment */
	inExperiment: boolean
	/** Variant payload (if any) */
	payload?: Record<string, unknown>
}

/**
 * Hook for A/B test experiments
 */
export function useExperiment(experimentKey: string): UseExperimentReturn {
	const ctx = useContext(FeatureFlagsContext)

	if (!ctx) {
		throw new Error('useExperiment must be used within a FeatureFlagsProvider')
	}

	const { experiments, updateVersion } = ctx

	return useMemo(() => {
		const result = experiments.getVariant(experimentKey)
		return {
			variant: result.variant,
			inExperiment: result.inExperiment,
			payload: result.payload,
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [experiments, experimentKey, updateVersion])
}

/**
 * Check if user is in a specific variant
 */
export function useIsInVariant(experimentKey: string, variant: string): boolean {
	const { variant: assignedVariant, inExperiment } = useExperiment(experimentKey)
	return inExperiment && assignedVariant === variant
}

/**
 * Check if user is in treatment (any non-control variant)
 */
export function useIsInTreatment(experimentKey: string): boolean {
	const { variant, inExperiment } = useExperiment(experimentKey)
	return inExperiment && variant !== 'control'
}

// ==========================================
// Utility Hooks
// ==========================================

/**
 * Low-level context access (for advanced use)
 */
function useFeatureFlagsContext() {
	const ctx = useContext(FeatureFlagsContext)

	if (!ctx) {
		throw new Error('Feature flags hooks must be used within a FeatureFlagsProvider')
	}

	const { evaluator, updateVersion } = ctx

	return {
		isEnabled: (key: string, defaultValue: boolean) => evaluator.isEnabled(key, defaultValue),
		getString: (key: string, defaultValue: string) => evaluator.getString(key, defaultValue),
		getNumber: (key: string, defaultValue: number) => evaluator.getNumber(key, defaultValue),
		getJSON: <T extends Record<string, unknown>>(key: string, defaultValue: T) =>
			evaluator.getJSON(key, defaultValue),
		evaluate: <T = FlagValue>(
			key: string,
			defaultValue: T,
			contextOverride?: EvaluationContext
		) => evaluator.evaluate(key, defaultValue, contextOverride),
		updateVersion,
	}
}

/**
 * Hook to track flag loading state
 */
export function useFlagsReady(): { isReady: boolean; isLoading: boolean; error: Error | null } {
	const ctx = useContext(FeatureFlagsContext)

	if (!ctx) {
		return { isReady: false, isLoading: true, error: null }
	}

	return {
		isReady: ctx.isReady,
		isLoading: ctx.isLoading,
		error: ctx.error,
	}
}

// ==========================================
// Types Export
// ==========================================


