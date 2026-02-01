/**
 * Storage Hooks
 *
 * React hooks for file storage operations.
 * Separated from auth hooks for clean responsibility separation.
 *
 * ## Industry-Standard Features
 * - **Cancellation**: AbortController support (Vercel Blob pattern)
 * - **Retry**: Exponential backoff with jitter (handled internally)
 * - **Progress**: Real-time upload progress tracking
 */

'use client'

import { useState, useCallback, useRef } from 'react'
import { useStorageContext, type UploadProgressEvent } from './services-context'

// ============================================
// Types (Re-exported from SSOT)
// ============================================

// StorageFile - SSOT: lib/storage/types.ts
export type { StorageFile } from '../lib/storage/types'

interface UploadResult {
	id: string
	url: string
	filename: string
	mimeType: string
	sizeBytes: number
}

export interface UseStorageReturn {
	/** Upload a file and get back the public URL */
	upload: (file: File, options?: { path?: string; signal?: AbortSignal }) => Promise<string>
	/** Upload an avatar (shortcut for profile pictures) */
	uploadAvatar: (file: File) => Promise<string>
	/** Delete a file by ID */
	deleteFile: (fileId: string) => Promise<void>
	/** Get a signed URL for a file (returns null if not found) */
	getUrl: (fileId: string) => Promise<string | null>
	/** Cancel the current upload (Vercel Blob pattern) */
	cancel: () => void
	/** Whether an upload is in progress */
	isUploading: boolean
	/** Upload progress (0-100, real-time) */
	progress: number
	/** Bytes uploaded so far */
	bytesUploaded: number
	/** Total bytes to upload */
	bytesTotal: number
	/** Last upload error */
	uploadError: Error | null
	/** Whether the last upload was cancelled */
	wasCancelled: boolean
}

// ============================================
// useStorage
// ============================================

/**
 * Hook to handle file uploads to platform storage with real-time progress
 *
 * ## Industry-Standard Features
 * - **Cancellation**: `cancel()` method to abort in-progress uploads (Vercel Blob pattern)
 * - **AbortSignal**: Pass custom signal via upload options
 * - **Progress**: Real-time byte-level progress tracking
 *
 * @example Basic usage
 * ```tsx
 * function AvatarUpload() {
 *   const { uploadAvatar, isUploading, progress, bytesUploaded, bytesTotal, uploadError } = useStorage()
 *   const { user, refresh } = useUser()
 *
 *   const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 *     const file = e.target.files?.[0]
 *     if (!file) return
 *
 *     try {
 *       const url = await uploadAvatar(file)
 *       await refresh() // Refresh user to get new avatar URL
 *       console.log('Avatar uploaded:', url)
 *     } catch (err) {
 *       console.error('Upload failed:', err)
 *     }
 *   }
 *
 *   return (
 *     <div>
 *       <input type="file" accept="image/*" onChange={handleUpload} disabled={isUploading} />
 *       {isUploading && (
 *         <div>
 *           <progress value={progress} max={100} />
 *           <span>{Math.round(progress)}% ({(bytesUploaded / 1024).toFixed(1)}KB / {(bytesTotal / 1024).toFixed(1)}KB)</span>
 *         </div>
 *       )}
 *       {uploadError && <p>Error: {uploadError.message}</p>}
 *     </div>
 *   )
 * }
 * ```
 *
 * @example With cancellation
 * ```tsx
 * function CancellableUpload() {
 *   const { upload, cancel, isUploading, progress, wasCancelled } = useStorage()
 *
 *   return (
 *     <div>
 *       <input type="file" onChange={(e) => {
 *         const file = e.target.files?.[0]
 *         if (file) upload(file)
 *       }} />
 *       {isUploading && (
 *         <button onClick={cancel}>Cancel Upload</button>
 *       )}
 *       {wasCancelled && <p>Upload was cancelled</p>}
 *     </div>
 *   )
 * }
 * ```
 */
export function useStorage(): UseStorageReturn {
	const ctx = useStorageContext()
	const [isUploading, setIsUploading] = useState(false)
	const [progress, setProgress] = useState(0)
	const [bytesUploaded, setBytesUploaded] = useState(0)
	const [bytesTotal, setBytesTotal] = useState(0)
	const [uploadError, setUploadError] = useState<Error | null>(null)
	const [wasCancelled, setWasCancelled] = useState(false)

	// AbortController ref for cancellation (Vercel Blob pattern)
	const abortControllerRef = useRef<AbortController | null>(null)

	const handleProgress = useCallback((event: UploadProgressEvent) => {
		setProgress(event.progress)
		setBytesUploaded(event.loaded)
		setBytesTotal(event.total)
	}, [])

	const cancel = useCallback(() => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort()
			abortControllerRef.current = null
			setWasCancelled(true)
			setIsUploading(false)
		}
	}, [])

	const upload = useCallback(
		async (file: File, options?: { path?: string; signal?: AbortSignal }): Promise<string> => {
			// Create new AbortController if no external signal provided
			const controller = new AbortController()
			abortControllerRef.current = controller

			// Use external signal if provided, otherwise use internal controller
			const signal = options?.signal ?? controller.signal

			setIsUploading(true)
			setProgress(0)
			setBytesUploaded(0)
			setBytesTotal(file.size)
			setUploadError(null)
			setWasCancelled(false)

			try {
				const url = await ctx.upload(file, {
					...options,
					signal,
					onProgress: handleProgress,
				})
				setProgress(100)
				return url
			} catch (err) {
				// Check if this was a cancellation
				if (err instanceof DOMException && err.name === 'AbortError') {
					setWasCancelled(true)
					throw err
				}

				const error = err instanceof Error ? err : new Error('Upload failed')
				setUploadError(error)
				throw error
			} finally {
				abortControllerRef.current = null
				setIsUploading(false)
			}
		},
		[ctx, handleProgress]
	)

	const uploadAvatar = useCallback(
		async (file: File): Promise<string> => {
			// Create new AbortController for avatar uploads
			const controller = new AbortController()
			abortControllerRef.current = controller

			setIsUploading(true)
			setProgress(0)
			setBytesUploaded(0)
			setBytesTotal(file.size)
			setUploadError(null)
			setWasCancelled(false)

			try {
				const url = await ctx.uploadAvatar(file, {
					onProgress: handleProgress,
				})
				setProgress(100)
				return url
			} catch (err) {
				// Check if this was a cancellation
				if (err instanceof DOMException && err.name === 'AbortError') {
					setWasCancelled(true)
					throw err
				}

				const error = err instanceof Error ? err : new Error('Avatar upload failed')
				setUploadError(error)
				throw error
			} finally {
				abortControllerRef.current = null
				setIsUploading(false)
			}
		},
		[ctx, handleProgress]
	)

	const deleteFile = useCallback(
		async (fileId: string): Promise<void> => {
			await ctx.deleteFile(fileId)
		},
		[ctx]
	)

	const getUrl = useCallback(
		async (fileId: string): Promise<string | null> => {
			return ctx.getUrl(fileId)
		},
		[ctx]
	)

	return {
		upload,
		uploadAvatar,
		deleteFile,
		getUrl,
		cancel,
		isUploading,
		progress,
		bytesUploaded,
		bytesTotal,
		uploadError,
		wasCancelled,
	}
}

// ============================================
// useFileUpload (simpler single-file upload)
// ============================================

export interface UseFileUploadOptions {
	/** Custom path for the file */
	path?: string
	/** Allowed MIME types */
	accept?: string[]
	/** Max file size in bytes */
	maxSize?: number
	/** Called when upload succeeds */
	onSuccess?: (url: string) => void
	/** Called when upload fails */
	onError?: (error: Error) => void
	/** Called when upload is cancelled */
	onCancel?: () => void
}

export interface UseFileUploadReturn {
	/** Upload a file */
	upload: (file: File) => Promise<string>
	/** Cancel the current upload (Vercel Blob pattern) */
	cancel: () => void
	/** Whether an upload is in progress */
	isUploading: boolean
	/** Upload progress (0-100, real-time) */
	progress: number
	/** Bytes uploaded so far */
	bytesUploaded: number
	/** Total bytes to upload */
	bytesTotal: number
	/** Last upload error */
	error: Error | null
	/** Whether there was an error */
	isError: boolean
	/** Whether the last upload was cancelled */
	wasCancelled: boolean
	/** Last uploaded URL */
	url: string | null
	/** Reset state */
	reset: () => void
}

/**
 * Simplified hook for single file upload with validation
 *
 * ## Industry-Standard Features
 * - **Cancellation**: `cancel()` method to abort in-progress uploads (Vercel Blob pattern)
 * - **Validation**: File type and size validation before upload
 * - **Callbacks**: onSuccess, onError, onCancel hooks
 *
 * @example Basic usage
 * ```tsx
 * function FileUpload() {
 *   const { upload, isUploading, url, error } = useFileUpload({
 *     accept: ['image/*'],
 *     maxSize: 5 * 1024 * 1024, // 5MB
 *     onSuccess: (url) => console.log('Uploaded:', url),
 *   })
 *
 *   return (
 *     <input
 *       type="file"
 *       onChange={(e) => {
 *         const file = e.target.files?.[0]
 *         if (file) upload(file)
 *       }}
 *       disabled={isUploading}
 *     />
 *   )
 * }
 * ```
 *
 * @example With cancellation
 * ```tsx
 * function CancellableUpload() {
 *   const { upload, cancel, isUploading, wasCancelled } = useFileUpload({
 *     onCancel: () => console.log('Upload cancelled'),
 *   })
 *
 *   return (
 *     <div>
 *       <input type="file" onChange={(e) => {
 *         const file = e.target.files?.[0]
 *         if (file) upload(file)
 *       }} />
 *       {isUploading && <button onClick={cancel}>Cancel</button>}
 *       {wasCancelled && <p>Upload cancelled</p>}
 *     </div>
 *   )
 * }
 * ```
 */
export function useFileUpload(options: UseFileUploadOptions = {}): UseFileUploadReturn {
	const ctx = useStorageContext()
	const [isUploading, setIsUploading] = useState(false)
	const [progress, setProgress] = useState(0)
	const [bytesUploaded, setBytesUploaded] = useState(0)
	const [bytesTotal, setBytesTotal] = useState(0)
	const [error, setError] = useState<Error | null>(null)
	const [wasCancelled, setWasCancelled] = useState(false)
	const [url, setUrl] = useState<string | null>(null)

	// AbortController ref for cancellation (Vercel Blob pattern)
	const abortControllerRef = useRef<AbortController | null>(null)

	const handleProgress = useCallback((event: UploadProgressEvent) => {
		setProgress(event.progress)
		setBytesUploaded(event.loaded)
		setBytesTotal(event.total)
	}, [])

	const cancel = useCallback(() => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort()
			abortControllerRef.current = null
			setWasCancelled(true)
			setIsUploading(false)
			options.onCancel?.()
		}
	}, [options])

	const upload = useCallback(
		async (file: File): Promise<string> => {
			// Validate file type
			if (options.accept && options.accept.length > 0) {
				const isAccepted = options.accept.some((type) => {
					if (type.endsWith('/*')) {
						const category = type.slice(0, -2)
						return file.type.startsWith(category)
					}
					return file.type === type
				})
				if (!isAccepted) {
					const err = new Error(`File type ${file.type} not accepted`)
					setError(err)
					options.onError?.(err)
					throw err
				}
			}

			// Validate file size
			if (options.maxSize && file.size > options.maxSize) {
				const maxMB = (options.maxSize / 1024 / 1024).toFixed(1)
				const err = new Error(`File size exceeds ${maxMB}MB limit`)
				setError(err)
				options.onError?.(err)
				throw err
			}

			// Create new AbortController
			const controller = new AbortController()
			abortControllerRef.current = controller

			setIsUploading(true)
			setProgress(0)
			setBytesUploaded(0)
			setBytesTotal(file.size)
			setError(null)
			setWasCancelled(false)
			setUrl(null)

			try {
				const uploadedUrl = await ctx.upload(file, {
					path: options.path,
					signal: controller.signal,
					onProgress: handleProgress,
				})
				setProgress(100)
				setUrl(uploadedUrl)
				options.onSuccess?.(uploadedUrl)
				return uploadedUrl
			} catch (err) {
				// Check if this was a cancellation
				if (err instanceof DOMException && err.name === 'AbortError') {
					setWasCancelled(true)
					options.onCancel?.()
					throw err
				}

				const uploadError = err instanceof Error ? err : new Error('Upload failed')
				setError(uploadError)
				options.onError?.(uploadError)
				throw uploadError
			} finally {
				abortControllerRef.current = null
				setIsUploading(false)
			}
		},
		[ctx, options, handleProgress]
	)

	const reset = useCallback(() => {
		setIsUploading(false)
		setProgress(0)
		setBytesUploaded(0)
		setBytesTotal(0)
		setError(null)
		setWasCancelled(false)
		setUrl(null)
	}, [])

	return {
		upload,
		cancel,
		isUploading,
		progress,
		bytesUploaded,
		bytesTotal,
		error,
		isError: error !== null,
		wasCancelled,
		url,
		reset,
	}
}
