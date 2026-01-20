/**
 * Database Hooks
 *
 * @deprecated These hooks are NOT SUPPORTED. Use @sylphx/platform-sdk/db instead.
 *
 * The Database service uses direct Neon connection with DATABASE_URL from the Console.
 * Do not use these hooks - they will throw errors at runtime.
 *
 * Correct usage:
 * ```ts
 * // lib/db/index.ts
 * import { createDatabase } from '@sylphx/platform-sdk/db'
 * import * as schema from './schema'
 *
 * export const db = createDatabase(schema)
 * ```
 *
 * See: https://sylphx.com/docs/database
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { useDatabaseContext, type QueryResult } from './services-context'

// Re-export types for convenience
export type { QueryResult }

// ============================================
// useQuery
// ============================================

export interface UseQueryOptions<T> {
	/** SQL query string */
	sql: string
	/** Query parameters */
	params?: unknown[]
	/** Whether to skip initial fetch */
	skip?: boolean
	/** Refetch interval in ms */
	refetchInterval?: number
	/** Transform function for results */
	transform?: (rows: unknown[]) => T[]
}

export interface UseQueryReturn<T> {
	/** Query results */
	data: T[] | null
	/** Row count */
	rowCount: number
	/** Whether query is loading */
	isLoading: boolean
	/** Whether initial load is complete */
	isInitialized: boolean
	/** Last error */
	error: Error | null
	/** Refetch the query */
	refetch: () => Promise<void>
}

/**
 * Hook for executing database queries with automatic state management
 *
 * @example
 * ```tsx
 * function UserList() {
 *   const { data: users, isLoading, error, refetch } = useQuery<User>({
 *     sql: 'SELECT * FROM users WHERE active = $1 LIMIT $2',
 *     params: [true, 10],
 *   })
 *
 *   if (isLoading) return <Spinner />
 *   if (error) return <Error message={error.message} />
 *
 *   return (
 *     <div>
 *       <button onClick={refetch}>Refresh</button>
 *       {users?.map(user => (
 *         <div key={user.id}>{user.name}</div>
 *       ))}
 *     </div>
 *   )
 * }
 * ```
 */
export function useQuery<T = unknown>(options: UseQueryOptions<T>): UseQueryReturn<T> {
	const ctx = useDatabaseContext()
	const [data, setData] = useState<T[] | null>(null)
	const [rowCount, setRowCount] = useState(0)
	const [isLoading, setIsLoading] = useState(!options.skip)
	const [isInitialized, setIsInitialized] = useState(false)
	const [error, setError] = useState<Error | null>(null)

	const refetch = useCallback(async () => {
		setIsLoading(true)
		setError(null)

		try {
			const result = await ctx.query<T>(options.sql, options.params)
			const rows = options.transform ? options.transform(result.rows as unknown[]) : result.rows
			setData(rows)
			setRowCount(result.rowCount)
			setIsInitialized(true)
		} catch (err) {
			const error = err instanceof Error ? err : new Error('Query failed')
			setError(error)
		} finally {
			setIsLoading(false)
		}
	}, [ctx, options.sql, options.params, options.transform])

	// Initial fetch
	useEffect(() => {
		if (!options.skip) {
			refetch()
		}
	}, [options.skip, refetch])

	// Refetch interval
	useEffect(() => {
		if (options.refetchInterval && options.refetchInterval > 0) {
			const interval = setInterval(refetch, options.refetchInterval)
			return () => clearInterval(interval)
		}
	}, [options.refetchInterval, refetch])

	return {
		data,
		rowCount,
		isLoading,
		isInitialized,
		error,
		refetch,
	}
}

// ============================================
// useMutation
// ============================================

export interface UseMutationReturn {
	/** Execute a mutation query */
	mutate: (sql: string, params?: unknown[]) => Promise<{ rowCount: number }>
	/** Whether mutation is in progress */
	isLoading: boolean
	/** Whether mutation was successful */
	isSuccess: boolean
	/** Last error */
	error: Error | null
	/** Number of rows affected by last mutation */
	rowCount: number | null
	/** Reset state */
	reset: () => void
}

/**
 * Hook for executing database mutations (INSERT, UPDATE, DELETE)
 *
 * @example
 * ```tsx
 * function CreateUser() {
 *   const { mutate, isLoading, isSuccess, error } = useMutation()
 *   const [name, setName] = useState('')
 *
 *   const handleSubmit = async (e: React.FormEvent) => {
 *     e.preventDefault()
 *     await mutate(
 *       'INSERT INTO users (name, created_at) VALUES ($1, NOW())',
 *       [name]
 *     )
 *   }
 *
 *   if (isSuccess) {
 *     return <p>User created!</p>
 *   }
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <input value={name} onChange={(e) => setName(e.target.value)} />
 *       <button type="submit" disabled={isLoading}>
 *         Create User
 *       </button>
 *       {error && <p className="error">{error.message}</p>}
 *     </form>
 *   )
 * }
 * ```
 */
export function useMutation(): UseMutationReturn {
	const ctx = useDatabaseContext()
	const [isLoading, setIsLoading] = useState(false)
	const [isSuccess, setIsSuccess] = useState(false)
	const [error, setError] = useState<Error | null>(null)
	const [rowCount, setRowCount] = useState<number | null>(null)

	const reset = useCallback(() => {
		setIsSuccess(false)
		setError(null)
		setRowCount(null)
	}, [])

	const mutate = useCallback(
		async (sql: string, params?: unknown[]): Promise<{ rowCount: number }> => {
			setIsLoading(true)
			setError(null)
			setIsSuccess(false)

			try {
				const result = await ctx.execute(sql, params)
				setRowCount(result.rowCount)
				setIsSuccess(true)
				return result
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Mutation failed')
				setError(error)
				throw error
			} finally {
				setIsLoading(false)
			}
		},
		[ctx]
	)

	return {
		mutate,
		isLoading,
		isSuccess,
		error,
		rowCount,
		reset,
	}
}

// ============================================
// useTransaction
// ============================================

export interface UseTransactionReturn {
	/** Execute operations in a transaction */
	transaction: <T>(fn: (tx: TransactionClient) => Promise<T>) => Promise<T>
	/** Whether transaction is in progress */
	isLoading: boolean
	/** Last error */
	error: Error | null
}

export interface TransactionClient {
	/** Execute a query in the transaction */
	query: <T = unknown>(sql: string, params?: unknown[]) => Promise<QueryResult<T>>
	/** Execute a mutation in the transaction */
	execute: (sql: string, params?: unknown[]) => Promise<{ rowCount: number }>
}

/**
 * Hook for executing database transactions
 *
 * @example
 * ```tsx
 * function TransferFunds() {
 *   const { transaction, isLoading, error } = useTransaction()
 *
 *   const handleTransfer = async (from: string, to: string, amount: number) => {
 *     await transaction(async (tx) => {
 *       // Debit from source account
 *       await tx.execute(
 *         'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
 *         [amount, from]
 *       )
 *
 *       // Credit to destination account
 *       await tx.execute(
 *         'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
 *         [amount, to]
 *       )
 *
 *       // Record the transfer
 *       await tx.execute(
 *         'INSERT INTO transfers (from_id, to_id, amount) VALUES ($1, $2, $3)',
 *         [from, to, amount]
 *       )
 *     })
 *   }
 *
 *   return (
 *     <button onClick={() => handleTransfer('acc1', 'acc2', 100)} disabled={isLoading}>
 *       Transfer $100
 *     </button>
 *   )
 * }
 * ```
 */
export function useTransaction(): UseTransactionReturn {
	const ctx = useDatabaseContext()
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<Error | null>(null)

	const transaction = useCallback(
		async <T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> => {
			setIsLoading(true)
			setError(null)

			try {
				return await ctx.transaction(fn)
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Transaction failed')
				setError(error)
				throw error
			} finally {
				setIsLoading(false)
			}
		},
		[ctx]
	)

	return {
		transaction,
		isLoading,
		error,
	}
}

// ============================================
// useDatabase
// ============================================

export interface UseDatabaseReturn {
	/** Execute a query */
	query: <T = unknown>(sql: string, params?: unknown[]) => Promise<QueryResult<T>>
	/** Execute a mutation */
	execute: (sql: string, params?: unknown[]) => Promise<{ rowCount: number }>
	/** Execute operations in a transaction */
	transaction: <T>(fn: (tx: TransactionClient) => Promise<T>) => Promise<T>
	/** Whether any operation is in progress */
	isLoading: boolean
	/** Last error */
	error: Error | null
}

/**
 * Low-level hook for direct database access
 *
 * @example
 * ```tsx
 * function DataExplorer() {
 *   const { query, execute, isLoading } = useDatabase()
 *   const [results, setResults] = useState<unknown[]>([])
 *
 *   const runQuery = async (sql: string) => {
 *     const result = await query(sql)
 *     setResults(result.rows)
 *   }
 *
 *   return (
 *     <div>
 *       <button onClick={() => runQuery('SELECT * FROM users LIMIT 10')}>
 *         Load Users
 *       </button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useDatabase(): UseDatabaseReturn {
	const ctx = useDatabaseContext()
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<Error | null>(null)

	const query = useCallback(
		async <T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>> => {
			setIsLoading(true)
			setError(null)

			try {
				return await ctx.query<T>(sql, params)
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Query failed')
				setError(error)
				throw error
			} finally {
				setIsLoading(false)
			}
		},
		[ctx]
	)

	const execute = useCallback(
		async (sql: string, params?: unknown[]): Promise<{ rowCount: number }> => {
			setIsLoading(true)
			setError(null)

			try {
				return await ctx.execute(sql, params)
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Execute failed')
				setError(error)
				throw error
			} finally {
				setIsLoading(false)
			}
		},
		[ctx]
	)

	const transaction = useCallback(
		async <T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> => {
			setIsLoading(true)
			setError(null)

			try {
				return await ctx.transaction(fn)
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Transaction failed')
				setError(error)
				throw error
			} finally {
				setIsLoading(false)
			}
		},
		[ctx]
	)

	return {
		query,
		execute,
		transaction,
		isLoading,
		error,
	}
}
