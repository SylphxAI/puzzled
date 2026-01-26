/**
 * Storage Hooks
 *
 * React hooks for file storage operations.
 * Separated from auth hooks for clean responsibility separation.
 */

'use client'

import { useState, useCallback } from 'react'
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
	upload: (file: File, options?: { path?: string }) => Promise<string>
	/** Upload an avatar (shortcut for profile pictures) */
	uploadAvatar: (file: File) => Promise<string>
	/** Delete a file by ID */
	deleteFile: (fileId: string) => Promise<void>
	/** Get a signed URL for a file (returns null if not found) */
	getUrl: (fileId: string) => Promise<string | null>
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
}

// ============================================
// useStorage
// ============================================

/**
 * Hook to handle file uploads to platform storage with real-time progress
 *
 * @example
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
 */
export function useStorage(): UseStorageReturn {
	const ctx = useStorageContext()
	const [isUploading, setIsUploading] = useState(false)
	const [progress, setProgress] = useState(0)
	const [bytesUploaded, setBytesUploaded] = useState(0)
	const [bytesTotal, setBytesTotal] = useState(0)
	const [uploadError, setUploadError] = useState<Error | null>(null)

	const handleProgress = useCallback((event: UploadProgressEvent) => {
		setProgress(event.progress)
		setBytesUploaded(event.loaded)
		setBytesTotal(event.total)
	}, [])

	const upload = useCallback(
		async (file: File, options?: { path?: string }): Promise<string> => {
			setIsUploading(true)
			setProgress(0)
			setBytesUploaded(0)
			setBytesTotal(file.size)
			setUploadError(null)

			try {
				const url = await ctx.upload(file, {
					...options,
					onProgress: handleProgress,
				})
				setProgress(100)
				return url
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Upload failed')
				setUploadError(error)
				throw error
			} finally {
				setIsUploading(false)
			}
		},
		[ctx, handleProgress]
	)

	const uploadAvatar = useCallback(
		async (file: File): Promise<string> => {
			setIsUploading(true)
			setProgress(0)
			setBytesUploaded(0)
			setBytesTotal(file.size)
			setUploadError(null)

			try {
				const url = await ctx.uploadAvatar(file, {
					onProgress: handleProgress,
				})
				setProgress(100)
				return url
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Avatar upload failed')
				setUploadError(error)
				throw error
			} finally {
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
		isUploading,
		progress,
		bytesUploaded,
		bytesTotal,
		uploadError,
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
}

export interface UseFileUploadReturn {
	/** Upload a file */
	upload: (file: File) => Promise<string>
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
	/** Last uploaded URL */
	url: string | null
	/** Reset state */
	reset: () => void
}

/**
 * Simplified hook for single file upload with validation
 *
 * @example
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
 */
export function useFileUpload(options: UseFileUploadOptions = {}): UseFileUploadReturn {
	const ctx = useStorageContext()
	const [isUploading, setIsUploading] = useState(false)
	const [progress, setProgress] = useState(0)
	const [bytesUploaded, setBytesUploaded] = useState(0)
	const [bytesTotal, setBytesTotal] = useState(0)
	const [error, setError] = useState<Error | null>(null)
	const [url, setUrl] = useState<string | null>(null)

	const handleProgress = useCallback((event: UploadProgressEvent) => {
		setProgress(event.progress)
		setBytesUploaded(event.loaded)
		setBytesTotal(event.total)
	}, [])

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

			setIsUploading(true)
			setProgress(0)
			setBytesUploaded(0)
			setBytesTotal(file.size)
			setError(null)
			setUrl(null)

			try {
				const uploadedUrl = await ctx.upload(file, {
					path: options.path,
					onProgress: handleProgress,
				})
				setProgress(100)
				setUrl(uploadedUrl)
				options.onSuccess?.(uploadedUrl)
				return uploadedUrl
			} catch (err) {
				const uploadError = err instanceof Error ? err : new Error('Upload failed')
				setError(uploadError)
				options.onError?.(uploadError)
				throw uploadError
			} finally {
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
		setUrl(null)
	}, [])

	return {
		upload,
		isUploading,
		progress,
		bytesUploaded,
		bytesTotal,
		error,
		isError: error !== null,
		url,
		reset,
	}
}
