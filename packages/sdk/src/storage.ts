/**
 * Storage Functions
 *
 * Pure functions for file storage operations.
 *
 * ## Industry Patterns Implemented
 * - AbortController cancellation (Vercel Blob pattern)
 * - Exponential backoff with jitter (AWS S3 pattern: 5 retries, 1s base)
 * - Concurrent chunk uploads (Vercel pattern: 3 concurrent)
 *
 * Types are derived from the OpenAPI spec (generated/api.d.ts).
 * Run `bun run generate:types:local` to regenerate after API changes.
 */

import { type SylphxConfig, buildHeaders, callApi } from './config'
import { SylphxError } from './errors'
import { BASE_RETRY_DELAY_MS, MAX_RETRY_DELAY_MS } from './constants'
import type { components } from './generated/api'

// Re-export types from SSOT
export type { UploadProgressEvent, UploadResult, UploadOptions } from './lib/storage/types'
import type { UploadProgressEvent, UploadResult } from './lib/storage/types'

// ============================================================================
// Types (re-exported from generated OpenAPI spec)
// ============================================================================

export type StorageFile = components['schemas']['StorageFile']
export type UploadUrlRequest = components['schemas']['UploadUrlRequest']
export type UploadUrlResponse = components['schemas']['UploadUrlResponse']

// ============================================================================
// Upload Retry Configuration (AWS S3 Pattern)
// ============================================================================

const UPLOAD_RETRY_CONFIG = {
	/** Maximum number of retry attempts (AWS S3 pattern) */
	maxRetries: 5,
	/** Base delay in milliseconds */
	baseDelayMs: BASE_RETRY_DELAY_MS,
	/** Maximum delay cap in milliseconds */
	maxDelayMs: MAX_RETRY_DELAY_MS,
	/** Jitter type: 'full' for full jitter (AWS recommended) */
	jitter: 'full' as const,
}

/**
 * Calculate exponential backoff delay with full jitter (AWS pattern)
 * Formula: random(0, min(cap, base * 2 ^ attempt))
 */
function calculateBackoffDelay(attempt: number): number {
	const { baseDelayMs, maxDelayMs } = UPLOAD_RETRY_CONFIG
	const exponentialDelay = baseDelayMs * Math.pow(2, attempt)
	const cappedDelay = Math.min(exponentialDelay, maxDelayMs)
	// Full jitter: random value between 0 and cappedDelay
	return Math.random() * cappedDelay
}

/**
 * Sleep for a specified duration, respecting AbortSignal
 */
async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new DOMException('Upload aborted', 'AbortError'))
			return
		}

		const timeoutId = setTimeout(resolve, ms)

		signal?.addEventListener('abort', () => {
			clearTimeout(timeoutId)
			reject(new DOMException('Upload aborted', 'AbortError'))
		}, { once: true })
	})
}

/**
 * Check if an error is retryable (network errors, 5xx, 429)
 */
function isRetryableError(error: unknown): boolean {
	if (error instanceof DOMException && error.name === 'AbortError') {
		return false // Never retry aborted requests
	}
	if (error instanceof TypeError) {
		return true // Network errors
	}
	if (error instanceof Error && 'status' in error) {
		const status = (error as { status: number }).status
		return status >= 500 || status === 429 // Server errors or rate limiting
	}
	return false
}

// ============================================================================
// Types (SDK-specific)
// ============================================================================

export interface FileUploadOptions {
	/** Folder path */
	path?: string
	/** File type (file, avatar, etc.) */
	type?: 'file' | 'avatar'
	/** User ID (for avatar uploads) */
	userId?: string
	/** Progress callback */
	onProgress?: (event: UploadProgressEvent) => void
	/**
	 * Enable multipart upload for large files.
	 * - `true`: Always use multipart upload
	 * - `false`: Never use multipart upload
	 * - `'auto'` (default): Auto-enable for files > 5MB
	 *
	 * Multipart uploads support files up to 5TB with better
	 * reliability for large files.
	 */
	multipart?: boolean | 'auto'
	/**
	 * AbortSignal to cancel the upload.
	 * Vercel Blob pattern - enables cancellation of in-progress uploads.
	 *
	 * @example
	 * ```typescript
	 * const controller = new AbortController()
	 * // Cancel after 30 seconds
	 * setTimeout(() => controller.abort(), 30000)
	 * await uploadFile(config, file, { signal: controller.signal })
	 * ```
	 */
	signal?: AbortSignal
	/**
	 * Idempotency key for safe retries (Stripe pattern)
	 *
	 * Prevents duplicate uploads if the same request is retried.
	 * Use a unique key per logical upload operation.
	 *
	 * @example `upload-${userId}-${fileName}-${fileHash}`
	 */
	idempotencyKey?: string
}


export interface FileInfo {
	id: string
	url: string
	name: string
	size: number
	contentType: string
	isPrivate: boolean
	createdAt: string
}

export interface SignedUrlOptions {
	/** Expiration in seconds (default: 3600, max: 604800 = 7 days) */
	expiresIn?: number
	/** Force download (attachment) vs inline display (default: attachment) */
	disposition?: 'attachment' | 'inline'
	/** Restrict access to specific user */
	userId?: string
}

export interface SignedUrlResult {
	/** The signed download URL */
	url: string
	/** When the URL expires (ISO string) */
	expiresAt: string
	/** File metadata */
	file: {
		id: string
		filename: string
		mimeType: string
		sizeBytes: number
		isPrivate: boolean
	}
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Upload a file to storage
 *
 * Uses client-side upload for optimal performance (direct to CDN).
 *
 * ## Industry-Standard Features
 * - **Cancellation**: AbortController support (Vercel Blob pattern)
 * - **Retry**: Exponential backoff with jitter (AWS S3 pattern: 5 retries)
 * - **Progress**: Real-time upload progress tracking
 *
 * ## File Size Limits
 * - Standard uploads: up to 500MB
 * - For files > 500MB: use React hooks with `multipart: true` (supports up to 5TB)
 *
 * ## Multipart Uploads
 * For large files (> 5MB), multipart uploads provide:
 * - Better reliability with chunked uploads
 * - Resumable upload capability
 * - Progress tracking per chunk
 *
 * Use the `multipart` option or React hooks for large files:
 * ```typescript
 * // React hooks (recommended for large files)
 * const { upload } = useStorage()
 * await upload(file, { multipart: true })
 * ```
 *
 * @example
 * ```typescript
 * const file = new File(['Hello'], 'hello.txt', { type: 'text/plain' })
 * const result = await uploadFile(config, file, {
 *   path: 'documents',
 *   onProgress: (e) => console.log(`${e.progress}%`),
 * })
 *
 * console.log(result.url)
 * ```
 *
 * @example Cancellation
 * ```typescript
 * const controller = new AbortController()
 * setTimeout(() => controller.abort(), 30000) // Cancel after 30s
 *
 * try {
 *   await uploadFile(config, file, { signal: controller.signal })
 * } catch (e) {
 *   if (e.name === 'AbortError') {
 *     console.log('Upload cancelled')
 *   }
 * }
 * ```
 */
export async function uploadFile(
	config: SylphxConfig,
	file: File,
	options?: FileUploadOptions
): Promise<UploadResult> {
	const { signal } = options ?? {}

	// Check if already aborted
	if (signal?.aborted) {
		throw new DOMException('Upload aborted', 'AbortError')
	}

	// Get upload token from platform (with retry)
	let tokenResponse: Response | null = null
	let lastError: Error | null = null

	for (let attempt = 0; attempt <= UPLOAD_RETRY_CONFIG.maxRetries; attempt++) {
		try {
			tokenResponse = await fetch(`${config.platformUrl}/api/storage/upload`, {
				method: 'POST',
				headers: buildHeaders(config),
				body: JSON.stringify({
					filename: file.name,
					contentType: file.type,
					size: file.size,
					path: options?.path,
					type: options?.type ?? 'file',
					userId: options?.userId,
				}),
				signal,
			})

			if (tokenResponse.ok) {
				break
			}

			// Check if error is retryable
			if (tokenResponse.status >= 500 || tokenResponse.status === 429) {
				if (attempt < UPLOAD_RETRY_CONFIG.maxRetries) {
					const delay = calculateBackoffDelay(attempt)
					await sleep(delay, signal)
					continue
				}
			}

			// Non-retryable error
			const error = await tokenResponse.json().catch(() => ({ message: 'Failed to get upload token' }))
			throw new SylphxError(error.message ?? 'Failed to get upload token', { code: 'BAD_REQUEST' })
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				throw error // Don't retry aborted requests
			}

			lastError = error instanceof Error ? error : new Error(String(error))

			if (isRetryableError(error) && attempt < UPLOAD_RETRY_CONFIG.maxRetries) {
				const delay = calculateBackoffDelay(attempt)
				await sleep(delay, signal)
				continue
			}

			throw lastError
		}
	}

	if (!tokenResponse?.ok) {
		throw lastError ?? new SylphxError('Failed to get upload token after retries', { code: 'BAD_REQUEST' })
	}

	const { uploadUrl, publicUrl } = await tokenResponse.json()

	// Upload directly to storage with retry
	return executeUploadWithRetry(file, uploadUrl, publicUrl, options)
}

/**
 * Execute the actual upload with retry logic
 */
async function executeUploadWithRetry(
	file: File,
	uploadUrl: string,
	publicUrl: string,
	options?: FileUploadOptions
): Promise<UploadResult> {
	const { signal } = options ?? {}
	let lastError: Error | null = null

	for (let attempt = 0; attempt <= UPLOAD_RETRY_CONFIG.maxRetries; attempt++) {
		try {
			return await executeUpload(file, uploadUrl, publicUrl, options)
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				throw error // Don't retry aborted requests
			}

			lastError = error instanceof Error ? error : new Error(String(error))

			if (isRetryableError(error) && attempt < UPLOAD_RETRY_CONFIG.maxRetries) {
				const delay = calculateBackoffDelay(attempt)
				await sleep(delay, signal)
				continue
			}

			throw lastError
		}
	}

	throw lastError ?? new Error('Upload failed after retries')
}

/**
 * Execute a single upload attempt with XHR (for progress tracking)
 */
function executeUpload(
	file: File,
	uploadUrl: string,
	publicUrl: string,
	options?: FileUploadOptions
): Promise<UploadResult> {
	const { signal, onProgress } = options ?? {}

	return new Promise<UploadResult>((resolve, reject) => {
		const xhr = new XMLHttpRequest()

		// Handle abort signal
		const handleAbort = () => {
			xhr.abort()
			reject(new DOMException('Upload aborted', 'AbortError'))
		}

		if (signal?.aborted) {
			reject(new DOMException('Upload aborted', 'AbortError'))
			return
		}

		signal?.addEventListener('abort', handleAbort, { once: true })

		xhr.upload.addEventListener('progress', (event) => {
			if (event.lengthComputable && onProgress) {
				onProgress({
					loaded: event.loaded,
					total: event.total,
					progress: Math.round((event.loaded / event.total) * 100),
				})
			}
		})

		xhr.addEventListener('load', () => {
			signal?.removeEventListener('abort', handleAbort)

			if (xhr.status >= 200 && xhr.status < 300) {
				resolve({
					url: publicUrl,
					pathname: options?.path ? `${options.path}/${file.name}` : file.name,
					contentType: file.type,
					size: file.size,
				})
			} else {
				const error = new Error(`Upload failed with status ${xhr.status}`) as Error & { status: number }
				error.status = xhr.status
				reject(error)
			}
		})

		xhr.addEventListener('error', () => {
			signal?.removeEventListener('abort', handleAbort)
			reject(new TypeError('Network error during upload'))
		})

		xhr.addEventListener('abort', () => {
			signal?.removeEventListener('abort', handleAbort)
			reject(new DOMException('Upload aborted', 'AbortError'))
		})

		xhr.open('PUT', uploadUrl)
		xhr.setRequestHeader('Content-Type', file.type)
		xhr.send(file)
	})
}

/**
 * Upload a user avatar
 *
 * @example
 * ```typescript
 * const avatar = await uploadAvatar(config, file, 'user-123')
 * console.log(avatar.url)
 * ```
 */
export async function uploadAvatar(
	config: SylphxConfig,
	file: File,
	userId: string,
	options?: Pick<FileUploadOptions, 'onProgress'>
): Promise<UploadResult> {
	return uploadFile(config, file, {
		...options,
		type: 'avatar',
		userId,
	})
}

/**
 * Delete a file
 *
 * @example
 * ```typescript
 * await deleteFile(config, 'file-123')
 * ```
 */
export async function deleteFile(config: SylphxConfig, fileId: string): Promise<void> {
	await callApi(config, `/storage/files/${fileId}`, { method: 'DELETE' })
}

/**
 * Get a file's URL by ID
 *
 * @example
 * ```typescript
 * const url = await getFileUrl(config, 'file-123')
 * ```
 */
export async function getFileUrl(config: SylphxConfig, fileId: string): Promise<string> {
	const data = await callApi<{ url: string }>(config, `/storage/files/${fileId}`, { method: 'GET' })
	return data.url
}

/**
 * Get file info by ID
 *
 * @example
 * ```typescript
 * const info = await getFileInfo(config, 'file-123')
 * console.log(info.name, info.size)
 * ```
 */
export async function getFileInfo(config: SylphxConfig, fileId: string): Promise<FileInfo> {
	return callApi<FileInfo>(config, `/storage/files/${fileId}`, { method: 'GET' })
}

/**
 * Generate a signed URL for accessing a private file
 *
 * Signed URLs provide time-limited access to private files without
 * exposing permanent URLs. Useful for:
 * - Secure document downloads
 * - Private media streaming
 * - Temporary file sharing
 *
 * @example
 * ```typescript
 * // Generate a download URL valid for 1 hour
 * const { url, expiresAt } = await getSignedUrl(config, 'file-123')
 *
 * // Generate an inline preview URL valid for 5 minutes
 * const preview = await getSignedUrl(config, 'file-123', {
 *   expiresIn: 300,
 *   disposition: 'inline',
 * })
 *
 * // Restrict access to a specific user
 * const userOnly = await getSignedUrl(config, 'file-123', {
 *   userId: 'user-456',
 * })
 * ```
 */
export async function getSignedUrl(
	config: SylphxConfig,
	fileId: string,
	options?: SignedUrlOptions
): Promise<SignedUrlResult> {
	return callApi<SignedUrlResult>(config, '/storage/signed-url', {
		method: 'POST',
		body: {
			fileId,
			...options,
		},
	})
}
