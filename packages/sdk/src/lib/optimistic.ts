/**
 * SDK Optimistic Updates
 *
 * Lightweight optimistic update hooks for SDK UI components.
 * Works with any async function, without tRPC dependency.
 *
 * @example
 * ```tsx
 * import { useOptimisticAction } from '@sylphx/platform-sdk/react'
 *
 * function SessionsCard({ sessions: initialSessions }) {
 *   const ctx = useSecurityContext()
 *
 *   const { data: sessions, execute: revoke, isPending } = useOptimisticAction(
 *     initialSessions,
 *     ctx.revokeSession,
 *     {
 *       optimisticUpdate: (sessions, sessionId) =>
 *         sessions.filter(s => s.id !== sessionId),
 *       onRollback: () => toast.error('Session revoke failed'),
 *     }
 *   )
 *
 *   return (
 *     <ul>
 *       {sessions.map(session => (
 *         <li key={session.id}>
 *           {session.device}
 *           <button onClick={() => revoke(session.id)} disabled={isPending}>
 *             Revoke
 *           </button>
 *         </li>
 *       ))}
 *     </ul>
 *   )
 * }
 * ```
 *
 * @module @sylphx/platform-sdk
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ============================================================================
// Types
// ============================================================================

/**
 * Options for useOptimisticAction hook
 */
export interface UseOptimisticActionOptions<TData, TInput, TOutput> {
	/**
	 * How to update local state optimistically.
	 * Called immediately before the async action.
	 */
	optimisticUpdate: (data: TData, input: TInput) => TData

	/**
	 * Called on successful action completion.
	 * Can return new data to update state, or void to keep optimistic state.
	 */
	onSuccess?: (result: TOutput, input: TInput) => TData | void

	/**
	 * Called when the action fails.
	 */
	onError?: (error: Error, input: TInput) => void

	/**
	 * Called when rollback occurs after failure.
	 */
	onRollback?: (previousData: TData, input: TInput) => void

	/**
	 * Number of retry attempts before giving up.
	 * @default 0
	 */
	retry?: number

	/**
	 * Delay between retries in milliseconds.
	 * Can be a number or function for exponential backoff.
	 * @default (attempt) => Math.min(1000 * 2 ** attempt, 30000)
	 */
	retryDelay?: number | ((attempt: number) => number)

	/**
	 * Request timeout in milliseconds.
	 * If the action doesn't complete within this time, it will be aborted.
	 * @default 30000 (30 seconds)
	 */
	timeout?: number
}

/**
 * Return type for useOptimisticAction hook
 */
export interface UseOptimisticActionReturn<TData, TInput, TOutput> {
	/** Current data state (optimistically updated) */
	data: TData

	/** Execute the action with optimistic update */
	execute: (input: TInput) => Promise<TOutput>

	/** Whether action is currently pending */
	isPending: boolean

	/** Current error if any */
	error: Error | null

	/** Manually rollback to previous state */
	rollback: () => void

	/** Clear the error state */
	resetError: () => void

	/** Whether currently rolling back */
	isRollingBack: boolean
}

// ============================================================================
// Constants
// ============================================================================

/** Default timeout in milliseconds */
const DEFAULT_TIMEOUT = 30000

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Custom error class for timeout errors
 */
export class TimeoutError extends Error {
	constructor(timeout: number) {
		super(`Request timed out after ${timeout}ms`)
		this.name = 'TimeoutError'
	}
}

/**
 * Default exponential backoff delay with jitter.
 *
 * Adds 0-30% random jitter to prevent thundering herd when multiple
 * actions fail and retry simultaneously.
 *
 * @param attempt - Current attempt number (0-indexed)
 * @returns Delay in milliseconds (max 30s + jitter)
 */
function defaultRetryDelay(attempt: number): number {
	const baseDelay = Math.min(1000 * 2 ** attempt, 30000)
	const jitter = Math.random() * baseDelay * 0.3 // 0-30% jitter
	return Math.floor(baseDelay + jitter)
}

/**
 * Determines if an error is retriable.
 * Network errors and timeouts are retriable, auth/validation errors are not.
 */
export function isRetriableError(error: Error): boolean {
	// Timeout errors are retriable
	if (error instanceof TimeoutError) {
		return true
	}

	// Abort errors are NOT retriable (user cancelled)
	if (error.name === 'AbortError') {
		return false
	}

	// Network errors are retriable
	if (error.name === 'NetworkError' || error.name === 'TypeError') {
		return true
	}

	// Check for common non-retriable patterns
	const message = error.message.toLowerCase()
	const nonRetriablePatterns = [
		'unauthorized',
		'forbidden',
		'not found',
		'validation',
		'invalid',
		'bad request',
		'401',
		'403',
		'404',
		'400',
		'422',
	]

	if (nonRetriablePatterns.some((pattern) => message.includes(pattern))) {
		return false
	}

	// Check for retriable patterns
	const retriablePatterns = [
		'network',
		'timeout',
		'connection',
		'econnrefused',
		'econnreset',
		'socket',
		'fetch failed',
		'500',
		'502',
		'503',
		'504',
	]

	return retriablePatterns.some((pattern) => message.includes(pattern))
}

/**
 * Wraps an async function with a timeout and abort support.
 * Uses Promise.race for true cancellation - the promise will reject
 * immediately on timeout/abort, even if the underlying request continues.
 *
 * @param fn - The async function to wrap
 * @param timeout - Timeout in milliseconds
 * @param externalSignal - Optional external abort signal (e.g., from unmount)
 * @returns The result of the function
 * @throws TimeoutError if the function times out
 * @throws Error with name 'AbortError' if externally aborted
 */
async function withTimeout<T>(
	fn: (signal: AbortSignal) => Promise<T>,
	timeout: number,
	externalSignal?: AbortSignal
): Promise<T> {
	const controller = new AbortController()

	// Track cleanup functions to avoid memory leaks
	const cleanupFns: (() => void)[] = []
	let timeoutId: ReturnType<typeof setTimeout> | null = null

	const cleanup = () => {
		// Clear timeout
		if (timeoutId !== null) {
			clearTimeout(timeoutId)
			timeoutId = null
		}
		// Remove all event listeners
		for (const fn of cleanupFns) {
			fn()
		}
		cleanupFns.length = 0
	}

	// Link external signal to our controller
	if (externalSignal) {
		if (externalSignal.aborted) {
			controller.abort()
		} else {
			const onExternalAbort = () => controller.abort()
			externalSignal.addEventListener('abort', onExternalAbort)
			cleanupFns.push(() => externalSignal.removeEventListener('abort', onExternalAbort))
		}
	}

	// Create timeout promise that rejects
	const timeoutPromise = new Promise<never>((_, reject) => {
		timeoutId = setTimeout(() => {
			controller.abort()
			reject(new TimeoutError(timeout))
		}, timeout)
	})

	// Create abort promise that rejects on external abort
	const abortPromise = new Promise<never>((_, reject) => {
		if (controller.signal.aborted) {
			reject(new DOMException('Aborted', 'AbortError'))
			return
		}
		const onAbort = () => reject(new DOMException('Aborted', 'AbortError'))
		controller.signal.addEventListener('abort', onAbort)
		cleanupFns.push(() => controller.signal.removeEventListener('abort', onAbort))
	})

	try {
		// Race between the actual function, timeout, and abort
		const result = await Promise.race([
			fn(controller.signal),
			timeoutPromise,
			abortPromise,
		])
		return result
	} finally {
		// Always cleanup to prevent memory leaks
		cleanup()
	}
}

/**
 * Deep clone utility (uses structuredClone when available)
 */
function deepClone<T>(data: T): T {
	if (typeof structuredClone === 'function') {
		return structuredClone(data)
	}
	// Fallback for older environments
	return JSON.parse(JSON.stringify(data))
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Optimistic action hook for SDK UI components.
 *
 * Provides automatic optimistic updates with rollback on failure.
 * Works with any async function, without requiring tRPC or React Query.
 *
 * @typeParam TData - Shape of the data being managed
 * @typeParam TInput - Input type for the action
 * @typeParam TOutput - Output type from the action
 *
 * @param initialData - Initial data state
 * @param action - Async function to execute
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * const { data: items, execute: deleteItem, isPending } = useOptimisticAction(
 *   initialItems,
 *   (id) => api.deleteItem(id),
 *   {
 *     optimisticUpdate: (items, id) => items.filter(i => i.id !== id),
 *     onRollback: () => showError('Delete failed, item restored'),
 *   }
 * )
 * ```
 */
export function useOptimisticAction<TData, TInput, TOutput>(
	initialData: TData,
	action: (input: TInput) => Promise<TOutput>,
	options: UseOptimisticActionOptions<TData, TInput, TOutput>
): UseOptimisticActionReturn<TData, TInput, TOutput> {
	const {
		optimisticUpdate,
		onSuccess,
		onError,
		onRollback,
		retry = 0,
		retryDelay = defaultRetryDelay,
		timeout = DEFAULT_TIMEOUT,
	} = options

	// State
	const [data, setData] = useState<TData>(initialData)
	const [isPending, setIsPending] = useState(false)
	const [isRollingBack, setIsRollingBack] = useState(false)
	const [error, setError] = useState<Error | null>(null)

	// Use ref to track latest data to avoid stale closures
	const latestDataRef = useRef<TData>(data)
	useEffect(() => {
		latestDataRef.current = data
	}, [data])

	// Snapshot for rollback - use Map to track multiple concurrent mutations
	const snapshotsRef = useRef<Map<string, { snapshot: TData; input: TInput }>>(new Map())
	const mutationCounterRef = useRef(0)

	// AbortController for cleanup on unmount
	const abortControllerRef = useRef<AbortController | null>(null)
	// Track if component is mounted to prevent state updates after unmount
	const isMountedRef = useRef(true)

	// Cleanup on unmount - abort all pending actions
	useEffect(() => {
		isMountedRef.current = true
		return () => {
			isMountedRef.current = false
			// Abort any in-flight requests
			abortControllerRef.current?.abort()
			// Clear all snapshots
			snapshotsRef.current.clear()
		}
	}, [])

	// Sync with new initial data (in useEffect to avoid race conditions)
	const prevInitialDataRef = useRef(initialData)
	useEffect(() => {
		if (initialData !== prevInitialDataRef.current && snapshotsRef.current.size === 0) {
			// Only sync if not in the middle of a mutation
			setData(initialData)
			prevInitialDataRef.current = initialData
		}
	}, [initialData])

	/**
	 * Execute the action with optimistic update
	 */
	const execute = useCallback(
		async (input: TInput): Promise<TOutput> => {
			// Generate unique mutation ID for this execution
			const mutationId = `mut_${++mutationCounterRef.current}_${Date.now()}`

			// Create abort controller for this action
			const actionController = new AbortController()
			abortControllerRef.current = actionController

			// Take snapshot BEFORE optimistic update using latest data ref
			const currentData = latestDataRef.current
			snapshotsRef.current.set(mutationId, {
				snapshot: deepClone(currentData),
				input,
			})

			// Apply optimistic update
			const optimisticData = optimisticUpdate(currentData, input)

			if (isMountedRef.current) {
				setData(optimisticData)
				setError(null)
				setIsPending(true)
			}

			let currentRetry = 0
			const maxRetries = retry

			const attemptAction = async (): Promise<TOutput> => {
				try {
					// Check if already aborted (e.g., component unmounted)
					if (actionController.signal.aborted) {
						throw new DOMException('Aborted', 'AbortError')
					}

					// Execute action with timeout and abort signal
					const result = await withTimeout(
						(signal) => action(input),
						timeout,
						actionController.signal
					)

					// Success! Apply server data if provided (only if mounted)
					if (isMountedRef.current) {
						const newData = onSuccess?.(result, input)
						if (newData !== undefined) {
							setData(newData)
						}
					}

					// Clear this mutation's snapshot
					snapshotsRef.current.delete(mutationId)

					return result
				} catch (err) {
					const actionError = err instanceof Error ? err : new Error(String(err))

					// Don't retry if aborted (component unmounted)
					if (actionError.name === 'AbortError') {
						// Rollback silently using this mutation's snapshot
						const mutationData = snapshotsRef.current.get(mutationId)
						if (mutationData) {
							setData(mutationData.snapshot)
							snapshotsRef.current.delete(mutationId)
						}
						throw actionError
					}

					// Check if error is retriable and we have retries left
					const shouldRetry =
						currentRetry < maxRetries && isRetriableError(actionError)

					if (shouldRetry) {
						currentRetry++

						// Calculate delay with jitter
						const delay =
							typeof retryDelay === 'function'
								? retryDelay(currentRetry)
								: retryDelay

						// Wait and retry (check for abort during wait)
						await new Promise<void>((resolve, reject) => {
							const timeoutId = setTimeout(resolve, delay)
							actionController.signal.addEventListener('abort', () => {
								clearTimeout(timeoutId)
								reject(new DOMException('Aborted', 'AbortError'))
							})
						})

						return attemptAction()
					}

					// No more retries - rollback using this mutation's snapshot
					if (isMountedRef.current) {
						setIsRollingBack(true)
					}

					const mutationData = snapshotsRef.current.get(mutationId)
					if (mutationData) {
						if (isMountedRef.current) {
							setData(mutationData.snapshot)
							onRollback?.(mutationData.snapshot, mutationData.input)
						}
						snapshotsRef.current.delete(mutationId)
					}

					if (isMountedRef.current) {
						setError(actionError)
						onError?.(actionError, input)
						setIsRollingBack(false)
					}

					throw actionError
				}
			}

			try {
				return await attemptAction()
			} finally {
				if (isMountedRef.current) {
					setIsPending(snapshotsRef.current.size > 0)
				}
				// Clear the controller reference
				if (abortControllerRef.current === actionController) {
					abortControllerRef.current = null
				}
			}
		},
		[data, action, optimisticUpdate, onSuccess, onError, onRollback, retry, retryDelay, timeout]
	)

	/**
	 * Manual rollback to previous state
	 * Rolls back all pending mutations to the earliest snapshot.
	 */
	const rollback = useCallback(() => {
		const snapshots = snapshotsRef.current
		if (snapshots.size === 0) return

		setIsRollingBack(true)

		// Get the oldest snapshot (first entry in the Map preserves insertion order)
		const entries = Array.from(snapshots.entries())
		const oldestEntry = entries[0]
		if (oldestEntry) {
			const [_mutationId, { snapshot, input }] = oldestEntry
			setData(snapshot)
			onRollback?.(snapshot, input)
		}

		// Clear all snapshots since we're rolling everything back
		snapshots.clear()
		setIsRollingBack(false)
	}, [onRollback])

	/**
	 * Clear error state
	 */
	const resetError = useCallback(() => {
		setError(null)
	}, [])

	return {
		data,
		execute,
		isPending,
		error,
		rollback,
		resetError,
		isRollingBack,
	}
}

// ============================================================================
// Convenience Hooks
// ============================================================================

/**
 * Options for useOptimisticValue hook
 */
export interface UseOptimisticValueOptions<T> {
	/** Called on successful update */
	onSuccess?: () => void

	/** Called on update failure */
	onError?: (error: Error) => void

	/** Called when rollback occurs */
	onRollback?: (previousValue: T) => void

	/** Number of retry attempts */
	retry?: number
}

/**
 * Simplified hook for single value optimistic updates.
 *
 * @example
 * ```tsx
 * const { value, update, isPending } = useOptimisticValue(
 *   initialName,
 *   (name) => api.updateName(name),
 *   { onRollback: () => toast.error('Update failed') }
 * )
 *
 * return (
 *   <input
 *     value={value}
 *     onChange={(e) => update(e.target.value)}
 *     disabled={isPending}
 *   />
 * )
 * ```
 */
export function useOptimisticValue<T>(
	initialValue: T,
	updateFn: (value: T) => Promise<void>,
	options?: UseOptimisticValueOptions<T>
) {
	const { data, execute, isPending, error, rollback, isRollingBack } = useOptimisticAction<
		T,
		T,
		void
	>(initialValue, updateFn, {
		optimisticUpdate: (_prev, newValue) => newValue,
		onSuccess: options?.onSuccess ? () => options.onSuccess!() : undefined,
		onError: options?.onError,
		onRollback: options?.onRollback,
		retry: options?.retry,
	})

	const update = useCallback(
		(newValue: T) => {
			execute(newValue).catch(() => {
				// Error already handled
			})
		},
		[execute]
	)

	return {
		value: data,
		update,
		isPending,
		error,
		rollback,
		isRollingBack,
	}
}

/**
 * Options for useOptimisticToggle hook
 */
export interface UseOptimisticToggleOptions {
	/** Called on successful toggle */
	onSuccess?: () => void

	/** Called on toggle failure */
	onError?: (error: Error) => void

	/** Called when rollback occurs */
	onRollback?: (previousValue: boolean) => void
}

/**
 * Hook for optimistic boolean toggle.
 *
 * @example
 * ```tsx
 * const { value: isEnabled, toggle, isPending } = useOptimisticToggle(
 *   initialEnabled,
 *   (enabled) => api.setEnabled(enabled),
 *   { onRollback: () => toast.error('Toggle failed') }
 * )
 *
 * return (
 *   <Switch
 *     checked={isEnabled}
 *     onCheckedChange={toggle}
 *     disabled={isPending}
 *   />
 * )
 * ```
 */
export function useOptimisticToggle(
	initialValue: boolean,
	toggleFn: (value: boolean) => Promise<void>,
	options?: UseOptimisticToggleOptions
) {
	const { value, update, isPending, error, rollback, isRollingBack } = useOptimisticValue(
		initialValue,
		toggleFn,
		options
	)

	const toggle = useCallback(() => {
		update(!value)
	}, [update, value])

	return {
		value,
		toggle,
		isPending,
		error,
		rollback,
		isRollingBack,
	}
}

/**
 * Options for useOptimisticList hook
 */
export interface UseOptimisticListOptions<TItem> {
	/** Called on any operation error */
	onError?: (error: Error, operation: 'add' | 'remove' | 'update') => void

	/** Called when rollback occurs */
	onRollback?: (previousItems: TItem[], operation: 'add' | 'remove' | 'update') => void
}

/**
 * Operations for useOptimisticList
 */
export interface ListOperations<TItem extends { id: string | number }> {
	/** Add a new item */
	add?: (item: Omit<TItem, 'id'>) => Promise<TItem>

	/** Remove an item by ID */
	remove?: (id: TItem['id']) => Promise<void>

	/** Update an item by ID */
	update?: (id: TItem['id'], data: Partial<TItem>) => Promise<TItem>
}

/**
 * Hook for optimistic list operations.
 *
 * Uses Map-based snapshots to correctly handle concurrent mutations.
 * Each operation gets its own snapshot, preventing race conditions where
 * multiple simultaneous operations could overwrite each other's rollback state.
 *
 * @example
 * ```tsx
 * const { items, add, remove, update, isPending } = useOptimisticList(
 *   initialTodos,
 *   {
 *     add: (todo) => api.addTodo(todo),
 *     remove: (id) => api.deleteTodo(id),
 *     update: (id, data) => api.updateTodo(id, data),
 *   }
 * )
 * ```
 */
export function useOptimisticList<TItem extends { id: string | number }>(
	initialItems: TItem[],
	operations: ListOperations<TItem>,
	options?: UseOptimisticListOptions<TItem>
) {
	const [items, setItems] = useState(initialItems)
	const [isPending, setIsPending] = useState(false)

	// Use Map to track snapshots for concurrent mutations (prevents race conditions)
	const snapshotsRef = useRef<
		Map<
			string,
			{
				snapshot: TItem[]
				operation: 'add' | 'remove' | 'update'
				tempId?: string
			}
		>
	>(new Map())
	const mutationCounterRef = useRef(0)

	// Track latest items for snapshot creation
	const latestItemsRef = useRef(items)
	useEffect(() => {
		latestItemsRef.current = items
	}, [items])

	// Add operation
	const add = useCallback(
		async (item: Omit<TItem, 'id'>) => {
			if (!operations.add) {
				throw new Error('Add operation not provided')
			}

			const mutationId = `add_${++mutationCounterRef.current}_${Date.now()}`
			const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`
			const tempItem = { ...item, id: tempId } as TItem

			// Snapshot BEFORE applying optimistic update
			snapshotsRef.current.set(mutationId, {
				snapshot: deepClone(latestItemsRef.current),
				operation: 'add',
				tempId,
			})

			setItems((prev) => [...prev, tempItem])
			setIsPending(true)

			try {
				const result = await operations.add(item)
				// Replace temp item with real item
				setItems((prev) => prev.map((i) => (i.id === tempId ? result : i)))
				snapshotsRef.current.delete(mutationId)
				return result
			} catch (err) {
				const error = err instanceof Error ? err : new Error(String(err))
				const snapshotData = snapshotsRef.current.get(mutationId)
				if (snapshotData) {
					setItems(snapshotData.snapshot)
					options?.onRollback?.(snapshotData.snapshot, 'add')
					snapshotsRef.current.delete(mutationId)
				}
				options?.onError?.(error, 'add')
				throw error
			} finally {
				setIsPending(snapshotsRef.current.size > 0)
			}
		},
		[operations, options]
	)

	// Remove operation
	const remove = useCallback(
		async (id: TItem['id']) => {
			if (!operations.remove) {
				throw new Error('Remove operation not provided')
			}

			const mutationId = `remove_${++mutationCounterRef.current}_${Date.now()}`

			// Snapshot BEFORE applying optimistic update
			snapshotsRef.current.set(mutationId, {
				snapshot: deepClone(latestItemsRef.current),
				operation: 'remove',
			})

			setItems((prev) => prev.filter((i) => i.id !== id))
			setIsPending(true)

			try {
				await operations.remove(id)
				snapshotsRef.current.delete(mutationId)
			} catch (err) {
				const error = err instanceof Error ? err : new Error(String(err))
				const snapshotData = snapshotsRef.current.get(mutationId)
				if (snapshotData) {
					setItems(snapshotData.snapshot)
					options?.onRollback?.(snapshotData.snapshot, 'remove')
					snapshotsRef.current.delete(mutationId)
				}
				options?.onError?.(error, 'remove')
				throw error
			} finally {
				setIsPending(snapshotsRef.current.size > 0)
			}
		},
		[operations, options]
	)

	// Update operation
	const update = useCallback(
		async (id: TItem['id'], data: Partial<TItem>) => {
			if (!operations.update) {
				throw new Error('Update operation not provided')
			}

			const mutationId = `update_${++mutationCounterRef.current}_${Date.now()}`

			// Snapshot BEFORE applying optimistic update
			snapshotsRef.current.set(mutationId, {
				snapshot: deepClone(latestItemsRef.current),
				operation: 'update',
			})

			setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...data } : i)))
			setIsPending(true)

			try {
				const result = await operations.update(id, data)
				setItems((prev) => prev.map((i) => (i.id === id ? result : i)))
				snapshotsRef.current.delete(mutationId)
				return result
			} catch (err) {
				const error = err instanceof Error ? err : new Error(String(err))
				const snapshotData = snapshotsRef.current.get(mutationId)
				if (snapshotData) {
					setItems(snapshotData.snapshot)
					options?.onRollback?.(snapshotData.snapshot, 'update')
					snapshotsRef.current.delete(mutationId)
				}
				options?.onError?.(error, 'update')
				throw error
			} finally {
				setIsPending(snapshotsRef.current.size > 0)
			}
		},
		[operations, options]
	)

	return {
		items,
		add: operations.add ? add : undefined,
		remove: operations.remove ? remove : undefined,
		update: operations.update ? update : undefined,
		isPending,
	}
}
