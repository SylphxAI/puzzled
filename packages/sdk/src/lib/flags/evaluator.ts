/**
 * Local Flag Evaluator
 *
 * Zero-latency client-side flag evaluation with:
 * - In-memory caching with TTL
 * - Consistent bucketing
 * - Targeting rules evaluation
 * - Offline support with localStorage fallback
 */

import {
	FLAGS_CACHE_TTL_MS,
	FLAGS_STALE_WHILE_REVALIDATE_MS,
} from "../../constants";
import { getUserBucket, isInPercentage, selectVariant } from "./hash";
import { findMatchingRule, mergeContext } from "./targeting";
import type {
	DEFAULT_FLAGS_CONFIG,
	EvaluationContext,
	EvaluationResult,
	FeatureFlagsConfig,
	FlagDefinition,
	FlagValue,
	FlagVariant,
} from "./types";

// ==========================================
// Cache Types
// ==========================================

interface CachedEvaluation {
	result: EvaluationResult;
	timestamp: number;
	contextHash: string;
}

interface FlagsState {
	flags: Map<string, FlagDefinition>;
	fetchedAt: number;
	version: number;
}

// ==========================================
// Local Evaluator
// ==========================================

/**
 * Local Flag Evaluator
 *
 * Evaluates feature flags entirely on the client with zero network latency.
 * Syncs flag definitions via SSE for real-time updates.
 */
export class LocalEvaluator {
	private state: FlagsState = {
		flags: new Map(),
		fetchedAt: 0,
		version: 0,
	};

	private evaluationCache: Map<string, CachedEvaluation> = new Map();
	private context: EvaluationContext = {};
	private config: FeatureFlagsConfig;

	constructor(config: FeatureFlagsConfig = {}) {
		this.config = config;

		// Load persisted flags on init
		if (config.offlineSupport !== false) {
			this.loadFromStorage();
		}
	}

	// ==========================================
	// Flag Management
	// ==========================================

	/**
	 * Set flags from server response
	 */
	setFlags(flags: FlagDefinition[]): void {
		const now = Date.now();

		this.state.flags.clear();
		for (const flag of flags) {
			this.state.flags.set(flag.key, flag);
		}
		this.state.fetchedAt = now;
		this.state.version++;

		// Clear evaluation cache
		this.evaluationCache.clear();

		// Persist for offline use
		this.saveToStorage();

		// Notify listener
		this.config.onFlagsUpdated?.(flags);

		this.debug("Flags updated", {
			count: flags.length,
			version: this.state.version,
		});
	}

	/**
	 * Update a single flag
	 */
	updateFlag(flag: FlagDefinition): void {
		this.state.flags.set(flag.key, flag);
		this.state.version++;

		// Clear cache for this flag
		// Use Array.from to avoid iterator invalidation when deleting during iteration
		// Use exact prefix match with delimiter to avoid matching similar flag keys
		// (e.g., "flag" vs "flag-v2" - we use "flag:" as prefix so "flag-v2:" won't match)
		const cachePrefix = flag.key + ":";
		const keysToDelete = Array.from(this.evaluationCache.keys()).filter((key) =>
			key.startsWith(cachePrefix),
		);
		for (const key of keysToDelete) {
			this.evaluationCache.delete(key);
		}

		this.saveToStorage();
		this.config.onFlagsUpdated?.(Array.from(this.state.flags.values()));

		this.debug("Flag updated", {
			key: flag.key,
			cacheEntriesCleared: keysToDelete.length,
		});
	}

	/**
	 * Remove a flag
	 */
	removeFlag(key: string): void {
		this.state.flags.delete(key);
		this.state.version++;

		// Clear cache for this flag
		// Use Array.from to avoid iterator invalidation when deleting during iteration
		const cachePrefix = key + ":";
		const keysToDelete = Array.from(this.evaluationCache.keys()).filter(
			(cacheKey) => cacheKey.startsWith(cachePrefix),
		);
		for (const cacheKey of keysToDelete) {
			this.evaluationCache.delete(cacheKey);
		}

		this.saveToStorage();
		this.config.onFlagsUpdated?.(Array.from(this.state.flags.values()));

		this.debug("Flag removed", {
			key,
			cacheEntriesCleared: keysToDelete.length,
		});
	}

	/**
	 * Get all flag definitions
	 */
	getFlags(): FlagDefinition[] {
		return Array.from(this.state.flags.values());
	}

	/**
	 * Get a specific flag definition
	 */
	getFlag(key: string): FlagDefinition | undefined {
		return this.state.flags.get(key);
	}

	// ==========================================
	// Context Management
	// ==========================================

	/**
	 * Set evaluation context
	 */
	setContext(context: EvaluationContext): void {
		this.context = context;
		// Clear cache when context changes
		this.evaluationCache.clear();
		this.debug("Context updated", context);
	}

	/**
	 * Update context (merge with existing)
	 */
	updateContext(partial: Partial<EvaluationContext>): void {
		this.context = mergeContext(this.context, partial);
		this.evaluationCache.clear();
		this.debug("Context merged", partial);
	}

	/**
	 * Get current context
	 */
	getContext(): EvaluationContext {
		return { ...this.context };
	}

	// ==========================================
	// Evaluation
	// ==========================================

	/**
	 * Evaluate a boolean flag
	 */
	isEnabled(flagKey: string, defaultValue = false): boolean {
		const result = this.evaluate<boolean>(flagKey, defaultValue);
		return result.value;
	}

	/**
	 * Evaluate a string flag
	 */
	getString(flagKey: string, defaultValue = ""): string {
		const result = this.evaluate<string>(flagKey, defaultValue);
		return result.value;
	}

	/**
	 * Evaluate a number flag
	 */
	getNumber(flagKey: string, defaultValue = 0): number {
		const result = this.evaluate<number>(flagKey, defaultValue);
		return result.value;
	}

	/**
	 * Evaluate a JSON flag
	 */
	getJSON<T extends Record<string, unknown>>(
		flagKey: string,
		defaultValue: T,
	): T {
		const result = this.evaluate<T>(flagKey, defaultValue);
		return result.value;
	}

	/**
	 * Full evaluation with metadata
	 */
	evaluate<T = FlagValue>(
		flagKey: string,
		defaultValue: T,
		contextOverride?: EvaluationContext,
	): EvaluationResult<T> {
		const context = contextOverride
			? mergeContext(this.context, contextOverride)
			: this.context;

		// Check cache first
		const cacheKey = this.getCacheKey(flagKey, context);
		const cached = this.evaluationCache.get(cacheKey);

		if (
			cached &&
			Date.now() - cached.timestamp <
				(this.config.cacheTtl ?? FLAGS_CACHE_TTL_MS)
		) {
			this.debug("Cache hit", { flagKey });
			return cached.result as EvaluationResult<T>;
		}

		// Evaluate
		const result = this.evaluateFlag<T>(flagKey, defaultValue, context);

		// Cache result
		this.evaluationCache.set(cacheKey, {
			result: result as EvaluationResult,
			timestamp: Date.now(),
			contextHash: this.hashContext(context),
		});

		// Notify listener
		this.config.onEvaluation?.(flagKey, result as EvaluationResult);

		return result;
	}

	/**
	 * Evaluate multiple flags at once
	 */
	evaluateAll(
		flagKeys: string[],
		contextOverride?: EvaluationContext,
	): Map<string, EvaluationResult> {
		const results = new Map<string, EvaluationResult>();

		for (const key of flagKeys) {
			results.set(key, this.evaluate(key, null, contextOverride));
		}

		return results;
	}

	// ==========================================
	// Private Evaluation Logic
	// ==========================================

	private evaluateFlag<T = FlagValue>(
		flagKey: string,
		defaultValue: T,
		context: EvaluationContext,
	): EvaluationResult<T> {
		const flag = this.state.flags.get(flagKey);

		// Flag not found
		if (!flag) {
			this.debug("Flag not found", { flagKey });
			return {
				value: defaultValue,
				variant: "default",
				enabled: false,
				reason: "error",
			};
		}

		// Flag disabled
		if (!flag.enabled) {
			const variant = flag.variants.find((v) => v.key === flag.defaultVariant);
			return {
				value: (variant?.value as T) ?? defaultValue,
				variant: flag.defaultVariant,
				enabled: false,
				reason: "flag_disabled",
			};
		}

		// Evaluate targeting rules
		const matchedRule = findMatchingRule(flag.rules, context);

		if (matchedRule) {
			// Check percentage rollout within rule
			if (
				matchedRule.percentage !== undefined &&
				matchedRule.percentage < 100
			) {
				const bucket = getUserBucket(
					flagKey,
					context.userId,
					context.anonymousId,
					flag.salt,
				);

				if (!isInPercentage(bucket, matchedRule.percentage)) {
					// Not in rollout percentage, use default
					const variant = flag.variants.find(
						(v) => v.key === flag.defaultVariant,
					);
					return {
						value: (variant?.value as T) ?? defaultValue,
						variant: flag.defaultVariant,
						enabled: true,
						matchedRule: matchedRule.id,
						reason: "percentage_rollout",
					};
				}
			}

			// Return rule's variant
			const variant = flag.variants.find((v) => v.key === matchedRule.variant);
			return {
				value: (variant?.value as T) ?? defaultValue,
				variant: matchedRule.variant,
				enabled: true,
				matchedRule: matchedRule.id,
				reason: "rule_match",
			};
		}

		// No rules matched - use weighted variant selection
		if (flag.variants.length > 1) {
			const bucket = getUserBucket(
				flagKey,
				context.userId,
				context.anonymousId,
				flag.salt,
			);
			const variantsWithWeights = flag.variants.map((v) => ({
				key: v.key,
				weight: v.weight ?? 100 / flag.variants.length,
			}));

			const selectedKey = selectVariant(variantsWithWeights, bucket);
			const variant = flag.variants.find((v) => v.key === selectedKey);

			return {
				value: (variant?.value as T) ?? defaultValue,
				variant: selectedKey,
				enabled: true,
				reason: "percentage_rollout",
			};
		}

		// Single variant or default
		const variant = flag.variants.find((v) => v.key === flag.defaultVariant);
		return {
			value: (variant?.value as T) ?? defaultValue,
			variant: flag.defaultVariant,
			enabled: true,
			reason: "default",
		};
	}

	// ==========================================
	// Persistence
	// ==========================================

	private loadFromStorage(): void {
		if (typeof window === "undefined") return;

		try {
			const key = this.config.storageKey ?? "sylphx_flags";
			const stored = localStorage.getItem(key);

			if (stored) {
				const data = JSON.parse(stored) as {
					flags: FlagDefinition[];
					fetchedAt: number;
					version: number;
				};

				for (const flag of data.flags) {
					this.state.flags.set(flag.key, flag);
				}
				this.state.fetchedAt = data.fetchedAt;
				this.state.version = data.version;

				this.debug("Loaded from storage", { count: data.flags.length });
			}
		} catch (error) {
			this.debug("Failed to load from storage", { error });
		}
	}

	private saveToStorage(): void {
		if (typeof window === "undefined") return;
		if (this.config.offlineSupport === false) return;

		try {
			const key = this.config.storageKey ?? "sylphx_flags";
			const data = {
				flags: Array.from(this.state.flags.values()),
				fetchedAt: this.state.fetchedAt,
				version: this.state.version,
			};

			localStorage.setItem(key, JSON.stringify(data));
		} catch (error) {
			this.debug("Failed to save to storage", { error });
		}
	}

	// ==========================================
	// Utilities
	// ==========================================

	private getCacheKey(flagKey: string, context: EvaluationContext): string {
		return `${flagKey}:${this.hashContext(context)}`;
	}

	private hashContext(context: EvaluationContext): string {
		// Simple hash based on key identifiers
		const parts = [
			context.userId ?? "",
			context.anonymousId ?? "",
			context.email ?? "",
			JSON.stringify(context.attributes ?? {}),
		];
		return parts.join(":");
	}

	private debug(message: string, data?: unknown): void {
		if (this.config.debug) {
			console.log(`[FeatureFlags] ${message}`, data ?? "");
		}
	}

	/**
	 * Get evaluator state for debugging
	 */
	getState(): {
		flagCount: number;
		cacheSize: number;
		fetchedAt: number;
		version: number;
		isStale: boolean;
	} {
		const staleThreshold =
			(this.config.cacheTtl ?? FLAGS_CACHE_TTL_MS) +
			(this.config.staleWhileRevalidate ?? FLAGS_STALE_WHILE_REVALIDATE_MS);
		const isStale = Date.now() - this.state.fetchedAt > staleThreshold;

		return {
			flagCount: this.state.flags.size,
			cacheSize: this.evaluationCache.size,
			fetchedAt: this.state.fetchedAt,
			version: this.state.version,
			isStale,
		};
	}

	/**
	 * Clear all caches
	 */
	clearCache(): void {
		this.evaluationCache.clear();
	}

	/**
	 * Reset evaluator state
	 */
	reset(): void {
		this.state.flags.clear();
		this.state.fetchedAt = 0;
		this.state.version = 0;
		this.evaluationCache.clear();
		this.context = {};

		if (typeof window !== "undefined" && this.config.offlineSupport !== false) {
			const key = this.config.storageKey ?? "sylphx_flags";
			localStorage.removeItem(key);
		}
	}
}

// ==========================================
// Singleton Instance
// ==========================================

let evaluatorInstance: LocalEvaluator | null = null;

/**
 * Get or create the evaluator instance
 */
export function getEvaluator(config?: FeatureFlagsConfig): LocalEvaluator {
	if (!evaluatorInstance) {
		evaluatorInstance = new LocalEvaluator(config);
	}
	return evaluatorInstance;
}

/**
 * Initialize feature flags with configuration
 */
export function initFeatureFlags(config?: FeatureFlagsConfig): LocalEvaluator {
	evaluatorInstance = new LocalEvaluator(config);
	return evaluatorInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetEvaluator(): void {
	evaluatorInstance?.reset();
	evaluatorInstance = null;
}
