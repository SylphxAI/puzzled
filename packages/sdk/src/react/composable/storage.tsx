/**
 * Storage Hooks
 *
 * Composable hooks for file uploads.
 * No provider needed - uses config directly.
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { useSylphxConfig } from './core'
import {
	uploadFile as uploadFileFn,
	getFileUrl as getFileUrlFn,
	type UploadOptions,
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
		async (file: File, options?: Omit<UploadOptions, 'onProgress'>): Promise<UploadResult> => {
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
	const [state, setState] = useState<{
		url: string | null
		isLoading: boolean
		error: Error | null
	}>({
		url: null,
		isLoading: false,
		error: null,
	})

	const fetch = useCallback(async () => {
		if (!fileId) {
			setState({ url: null, isLoading: false, error: null })
			return
		}

		setState((s) => ({ ...s, isLoading: true, error: null }))

		try {
			const url = await getFileUrlFn(config, fileId)
			setState({ url, isLoading: false, error: null })
		} catch (e) {
			const error = e instanceof Error ? e : new Error('Failed to get file URL')
			setState({ url: null, isLoading: false, error })
		}
	}, [config, fileId])

	// Auto-fetch on mount and when fileId changes
	useEffect(() => {
		fetch()
	}, [fetch])

	return {
		...state,
		refetch: fetch,
	}
}
