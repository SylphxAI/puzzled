/**
 * Storage Client
 *
 * Standalone client for file storage operations.
 * Uses Vercel Blob for client-direct uploads (zero server bandwidth).
 *
 * @example
 * ```typescript
 * import { StorageClient } from '@sylphx/platform-sdk/storage'
 *
 * const storage = new StorageClient({
 *   appId: 'my-app',
 *   publishableKey: 'sk_dev_xxx',
 * })
 *
 * // Upload a file
 * const result = await storage.upload(file, {
 *   path: 'uploads/images',
 *   onProgress: (e) => console.log(`${e.progress}%`),
 * })
 * console.log('Uploaded:', result.url)
 *
 * // Upload an avatar (requires userId)
 * storage.setUserId('user-123')
 * const avatarUrl = await storage.uploadAvatar(file)
 * ```
 */

import type {
	StorageConfig,
	UploadOptions,
	UploadProgressEvent,
	UploadResult,
	StorageFile,
	ListFilesOptions,
	ListFilesResult,
	ImageTransformOptions,
} from './types'

// ==========================================
// Storage Client
// ==========================================

export class StorageClient {
	private config: Required<Omit<StorageConfig, 'userId'>> & { userId?: string }
	private blobUpload: typeof import('@vercel/blob/client').upload | null = null

	constructor(config: StorageConfig) {
		this.config = {
			appId: config.appId,
			publishableKey: config.publishableKey,
			platformUrl: config.platformUrl || 'https://sylphx.com',
			userId: config.userId,
			debug: config.debug ?? false,
		}
	}

	/**
	 * Set user ID for authenticated uploads
	 */
	setUserId(userId: string | undefined): void {
		this.config.userId = userId
	}

	/**
	 * Get current user ID
	 */
	getUserId(): string | undefined {
		return this.config.userId
	}

	/**
	 * Upload a file
	 *
	 * Uses Vercel Blob's client-direct upload for zero server bandwidth.
	 * The file is uploaded directly from the browser to blob storage.
	 *
	 * @param file - File to upload (File, Blob, or ArrayBuffer)
	 * @param options - Upload options
	 * @returns Upload result with URL and metadata
	 */
	async upload(file: File | Blob, options: UploadOptions = {}): Promise<UploadResult> {
		const blobUpload = await this.getBlobUpload()
		const filename = options.filename || (file instanceof File ? file.name : 'file')

		if (this.config.debug) {
			console.log('[StorageClient] Uploading file:', filename, 'size:', file.size)
		}

		const blob = await blobUpload(filename, file, {
			access: 'public',
			handleUploadUrl: `${this.config.platformUrl}/api/storage/upload`,
			clientPayload: JSON.stringify({
				appId: this.config.appId,
				userId: this.config.userId,
				type: 'file',
				folder: options.path,
				metadata: options.metadata,
			}),
			onUploadProgress: options.onProgress
				? (progress) => {
						options.onProgress!({
							loaded: progress.loaded,
							total: progress.total,
							progress: progress.percentage,
						} satisfies UploadProgressEvent)
					}
				: undefined,
		})

		if (this.config.debug) {
			console.log('[StorageClient] Upload complete:', blob.url)
		}

		return {
			url: blob.url,
			pathname: blob.pathname,
			contentType: blob.contentType,
			size: file.size,
		}
	}

	/**
	 * Upload an avatar image
	 *
	 * Shortcut for uploading profile pictures. Requires userId to be set.
	 *
	 * @param file - Avatar image file
	 * @param onProgress - Progress callback
	 * @returns Public URL of the avatar
	 */
	async uploadAvatar(
		file: File | Blob,
		onProgress?: (event: UploadProgressEvent) => void
	): Promise<string> {
		if (!this.config.userId) {
			throw new Error('Must set userId before uploading avatar')
		}

		const blobUpload = await this.getBlobUpload()
		const filename = file instanceof File ? file.name : 'avatar'

		if (this.config.debug) {
			console.log('[StorageClient] Uploading avatar for user:', this.config.userId)
		}

		const blob = await blobUpload(filename, file, {
			access: 'public',
			handleUploadUrl: `${this.config.platformUrl}/api/storage/upload`,
			clientPayload: JSON.stringify({
				appId: this.config.appId,
				userId: this.config.userId,
				type: 'avatar',
			}),
			onUploadProgress: onProgress
				? (progress) => {
						onProgress({
							loaded: progress.loaded,
							total: progress.total,
							progress: progress.percentage,
						} satisfies UploadProgressEvent)
					}
				: undefined,
		})

		return blob.url
	}

	/**
	 * Delete a file by ID
	 *
	 * @param fileId - ID of the file to delete
	 */
	async deleteFile(fileId: string): Promise<void> {
		const response = await fetch(`${this.config.platformUrl}/api/storage/delete`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-app-id': this.config.appId,
				'x-app-secret': this.config.publishableKey,
			},
			body: JSON.stringify({ fileId }),
		})

		if (!response.ok) {
			const error = await response.json().catch(() => ({ message: 'Delete failed' }))
			throw new Error(error.message || 'Failed to delete file')
		}

		if (this.config.debug) {
			console.log('[StorageClient] Deleted file:', fileId)
		}
	}

	/**
	 * Get a signed URL for a file
	 *
	 * For public files, returns the public URL.
	 * For private files, returns a time-limited signed URL.
	 *
	 * @param fileId - ID of the file
	 * @returns URL to access the file
	 */
	async getUrl(fileId: string): Promise<string> {
		const response = await fetch(`${this.config.platformUrl}/api/storage/url?fileId=${fileId}`, {
			headers: {
				'x-app-id': this.config.appId,
				'x-app-secret': this.config.publishableKey,
			},
		})

		if (!response.ok) {
			const error = await response.json().catch(() => ({ message: 'Failed to get URL' }))
			throw new Error(error.message || 'Failed to get file URL')
		}

		const data = (await response.json()) as { url: string }
		return data.url
	}

	/**
	 * List files in storage
	 *
	 * @param options - List options (prefix, limit, cursor)
	 * @returns Paginated list of files
	 */
	async listFiles(options: ListFilesOptions = {}): Promise<ListFilesResult> {
		const params = new URLSearchParams()
		if (options.prefix) params.set('prefix', options.prefix)
		if (options.limit) params.set('limit', options.limit.toString())
		if (options.cursor) params.set('cursor', options.cursor)

		const response = await fetch(
			`${this.config.platformUrl}/api/storage/list?${params.toString()}`,
			{
				headers: {
					'x-app-id': this.config.appId,
					'x-app-secret': this.config.publishableKey,
				},
			}
		)

		if (!response.ok) {
			const error = await response.json().catch(() => ({ message: 'Failed to list files' }))
			throw new Error(error.message || 'Failed to list files')
		}

		return (await response.json()) as ListFilesResult
	}

	/**
	 * Get file metadata
	 *
	 * @param fileId - ID of the file
	 * @returns File metadata
	 */
	async getFile(fileId: string): Promise<StorageFile> {
		const response = await fetch(`${this.config.platformUrl}/api/storage/file?fileId=${fileId}`, {
			headers: {
				'x-app-id': this.config.appId,
				'x-app-secret': this.config.publishableKey,
			},
		})

		if (!response.ok) {
			const error = await response.json().catch(() => ({ message: 'File not found' }))
			throw new Error(error.message || 'Failed to get file')
		}

		return (await response.json()) as StorageFile
	}

	/**
	 * Get an optimized image URL with transformations
	 *
	 * Generates a URL that serves the image with on-the-fly transformations.
	 * Supports resizing, format conversion, quality optimization, and more.
	 *
	 * @example
	 * ```typescript
	 * // Get a 400x300 WebP thumbnail
	 * const thumbUrl = storage.getImageUrl(file.url, {
	 *   width: 400,
	 *   height: 300,
	 *   format: 'webp',
	 *   quality: 80,
	 * })
	 *
	 * // Auto-optimize for web
	 * const optimizedUrl = storage.getImageUrl(file.url, { optimize: true })
	 * ```
	 *
	 * @param originalUrl - Original image URL
	 * @param options - Transformation options
	 * @returns Transformed image URL
	 */
	getImageUrl(originalUrl: string, options: ImageTransformOptions = {}): string {
		const params = new URLSearchParams()

		// Encode the original URL
		params.set('url', originalUrl)

		// Add transformation parameters
		if (options.width) params.set('w', options.width.toString())
		if (options.height) params.set('h', options.height.toString())
		if (options.quality) params.set('q', options.quality.toString())
		if (options.format && options.format !== 'auto') params.set('f', options.format)
		if (options.fit) params.set('fit', options.fit)
		if (options.background) params.set('bg', options.background)
		if (options.blur) params.set('blur', options.blur.toString())
		if (options.optimize) params.set('optimize', '1')

		return `${this.config.platformUrl}/api/storage/image?${params.toString()}`
	}

	/**
	 * Get a responsive image srcset for different screen sizes
	 *
	 * Automatically generates multiple sizes for responsive images.
	 *
	 * @example
	 * ```typescript
	 * const srcset = storage.getImageSrcSet(file.url, {
	 *   widths: [320, 640, 1024, 1920],
	 *   format: 'webp',
	 * })
	 * // Returns: "url?w=320 320w, url?w=640 640w, ..."
	 * ```
	 *
	 * @param originalUrl - Original image URL
	 * @param options - Transformation options with widths array
	 * @returns srcset string for use in img tag
	 */
	getImageSrcSet(
		originalUrl: string,
		options: Omit<ImageTransformOptions, 'width'> & { widths: number[] }
	): string {
		const { widths, ...restOptions } = options

		return widths
			.map((width) => {
				const url = this.getImageUrl(originalUrl, { ...restOptions, width })
				return `${url} ${width}w`
			})
			.join(', ')
	}

	/**
	 * Create a presigned upload URL for server-side uploads
	 *
	 * Use this when you need to upload from a server or when
	 * client-direct upload isn't available.
	 *
	 * @param filename - Name of the file to upload
	 * @param options - Upload options
	 * @returns Presigned URL and upload instructions
	 */
	async createUploadUrl(
		filename: string,
		options: { path?: string; contentType?: string } = {}
	): Promise<{ url: string; method: string; headers: Record<string, string> }> {
		const response = await fetch(`${this.config.platformUrl}/api/storage/presign`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-app-id': this.config.appId,
				'x-app-secret': this.config.publishableKey,
			},
			body: JSON.stringify({
				filename,
				path: options.path,
				contentType: options.contentType,
			}),
		})

		if (!response.ok) {
			const error = await response.json().catch(() => ({ message: 'Failed to create upload URL' }))
			throw new Error(error.message || 'Failed to create presigned URL')
		}

		return (await response.json()) as { url: string; method: string; headers: Record<string, string> }
	}

	/**
	 * Lazy load the Vercel Blob upload function
	 * This avoids bundling @vercel/blob when not needed
	 */
	private async getBlobUpload(): Promise<typeof import('@vercel/blob/client').upload> {
		if (this.blobUpload) {
			return this.blobUpload
		}

		const { upload } = await import('@vercel/blob/client')
		this.blobUpload = upload
		return upload
	}
}

// ==========================================
// Factory Functions
// ==========================================

let globalStorageClient: StorageClient | null = null

/**
 * Initialize the global storage client
 *
 * @example
 * ```typescript
 * import { initStorage, getStorageClient } from '@sylphx/platform-sdk/storage'
 *
 * initStorage({
 *   appId: 'my-app',
 *   publishableKey: 'sk_dev_xxx',
 * })
 *
 * // Later in your code
 * const storage = getStorageClient()
 * await storage.upload(file)
 * ```
 */
export function initStorage(config: StorageConfig): StorageClient {
	globalStorageClient = new StorageClient(config)
	return globalStorageClient
}

/**
 * Get the global storage client
 *
 * @throws Error if not initialized
 */
export function getStorageClient(): StorageClient {
	if (!globalStorageClient) {
		throw new Error('Storage client not initialized. Call initStorage() first.')
	}
	return globalStorageClient
}

/**
 * Reset the global storage client (for testing)
 */
export function resetStorageClient(): void {
	globalStorageClient = null
}
