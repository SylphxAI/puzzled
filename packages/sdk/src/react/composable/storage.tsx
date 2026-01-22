/**
 * Storage Hooks
 *
 * Composable hooks for file uploads.
 * No provider needed - uses config directly.
 *
 * ## React Query Integration
 *
 * useFileUrl uses React Query for:
 * - Automatic caching (1 hour staleTime - URLs are stable)
 * - Deduplication of concurrent requests
 * - Background refetching
 */

'use client'

import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSylphxConfig } from './core'
import {
	uploadFile as uploadFileFn,
	getFileUrl as getFileUrlFn,
	type FileUploadOptions,
	type UploadResult,
	type UploadProgressEvent,
} from '../../storage'

// ============================================================================
// Types
// ============================================================================

interface UseUploadState {
	isUploading: boolean
	progress: number
	error: Error | null
	result: UploadResult | null
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * File upload hook with progress tracking
 *
 * @example
 * ```tsx
 * function FileUpload() {
 *   const { upload, isUploading, progress, result, error } = useUpload()
 *
 *   const handleChange = async (e) => {
 *     const file = e.target.files[0]
 *     const result = await upload(file, { path: 'documents' })
 *     console.log('Uploaded to:', result.url)
 *   }
 *
 *   return (
 *     <div>
 *       <input type="file" onChange={handleChange} disabled={isUploading} />
 *       {isUploading && <progress value={progress} max={100} />}
 *       {result && <a href={result.url}>View file</a>}
 *       {error && <p className="error">{error.message}</p>}
 *     </div>
 *   )
 * }
 * ```
 */
export function useUpload() {
	const config = useSylphxConfig()
	const [state, setState] = useState<UseUploadState>({
		isUploading: false,
		progress: 0,
		error: null,
		result: null,
	})

	const upload = useCallback(
		async (file: File, options?: Omit<FileUploadOptions, 'onProgress'>): Promise<UploadResult> => {
			setState({ isUploading: true, progress: 0, error: null, result: null })

			try {
				const result = await uploadFileFn(config, file, {
					...options,
					onProgress: (event: UploadProgressEvent) => {
						setState((s) => ({ ...s, progress: event.progress }))
					},
				})

				setState({ isUploading: false, progress: 100, error: null, result })
				return result
			} catch (e) {
				const error = e instanceof Error ? e : new Error('Upload failed')
				setState({ isUploading: false, progress: 0, error, result: null })
				throw error
			}
		},
		[config]
	)

	const reset = useCallback(() => {
		setState({ isUploading: false, progress: 0, error: null, result: null })
	}, [])

	return {
		upload,
		reset,
		...state,
	}
}

/**
 * Get file URL hook
 *
 * Uses React Query for caching - file URLs are stable so 1 hour cache.
 *
 * @example
 * ```tsx
 * function FilePreview({ fileId }) {
 *   const { url, isLoading, error } = useFileUrl(fileId)
 *
 *   if (isLoading) return <Spinner />
 *   if (error) return <p>Error: {error.message}</p>
 *   return <img src={url} />
 * }
 * ```
 */
export function useFileUrl(fileId: string | null) {
	const config = useSylphxConfig()
	const queryClient = useQueryClient()

	// React Query for file URL fetching
	const urlQuery = useQuery({
		queryKey: ['sylphx', 'fileUrl', fileId],
		queryFn: () => getFileUrlFn(config, fileId!),
		enabled: !!fileId,
		staleTime: 60 * 60 * 1000, // 1 hour - file URLs are stable
	})

	// Refetch via React Query
	const refetch = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: ['sylphx', 'fileUrl', fileId],
		})
	}, [queryClient, fileId])

	return {
		url: urlQuery.data ?? null,
		isLoading: urlQuery.isLoading,
		error: urlQuery.error as Error | null,
		refetch,
	}
}
