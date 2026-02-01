/**
 * Storage Context Value Factory
 *
 * Creates the Storage context value for the SylphxProvider.
 * Provides file upload using Vercel Blob.
 */

import type { StorageContextValue, UploadOptions, UploadProgressEvent } from '../services-context'
import type { RestApiClient } from '../rest-client'
import { STORAGE_MULTIPART_THRESHOLD_BYTES } from '../../constants'

// =============================================================================
// Types
// =============================================================================

export interface CreateStorageValueConfig {
	/** REST API client */
	api: RestApiClient
	/** Platform URL */
	platformUrl: string
	/** App ID */
	appId?: string
	/** User ID (if authenticated) */
	userId: string | null
}

// =============================================================================
// Dynamic Import
// =============================================================================

/** Cache for Vercel Blob upload function */
let blobUploadCache: typeof import('@vercel/blob/client').upload | null = null

/**
 * Dynamically import @vercel/blob/client to avoid SSR issues with undici
 */
async function getBlobUpload() {
	if (!blobUploadCache) {
		const { upload } = await import('@vercel/blob/client')
		blobUploadCache = upload
	}
	return blobUploadCache
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create Storage context value.
 *
 * Uses Vercel Blob for client-side uploads with:
 * - Zero server bandwidth (direct to storage)
 * - Up to 5TB file size (vs 4.5MB server limit)
 * - Real progress tracking
 * - Edge compatible
 */
export function createStorageValue(config: CreateStorageValueConfig): StorageContextValue {
	const { api, platformUrl, appId, userId } = config

	return {
		upload: async (file: File, options?: UploadOptions) => {
			const blobUpload = await getBlobUpload()

			// Determine if multipart should be used
			// Default is 'auto' which enables multipart for files > 5MB
			const shouldUseMultipart =
				options?.multipart === true || (options?.multipart !== false && file.size > STORAGE_MULTIPART_THRESHOLD_BYTES)

			const blob = await blobUpload(file.name, file, {
				access: 'public',
				handleUploadUrl: `${platformUrl}/api/storage/upload`,
				multipart: shouldUseMultipart,
				clientPayload: JSON.stringify({
					appId,
					userId,
					type: 'file',
					folder: options?.path,
				}),
				onUploadProgress: options?.onProgress
					? (progress) => {
							options.onProgress!({
								loaded: progress.loaded,
								total: progress.total,
								progress: progress.percentage,
							} satisfies UploadProgressEvent)
						}
					: undefined,
			})

			return blob.url
		},

		uploadAvatar: async (file: File, options?: { onProgress?: (event: UploadProgressEvent) => void }) => {
			if (!userId) {
				throw new Error('Must be logged in to upload avatar')
			}

			const blobUpload = await getBlobUpload()
			const blob = await blobUpload(file.name, file, {
				access: 'public',
				handleUploadUrl: `${platformUrl}/api/storage/upload`,
				clientPayload: JSON.stringify({
					appId,
					userId,
					type: 'avatar',
				}),
				onUploadProgress: options?.onProgress
					? (progress) => {
							options.onProgress!({
								loaded: progress.loaded,
								total: progress.total,
								progress: progress.percentage,
							} satisfies UploadProgressEvent)
						}
					: undefined,
			})

			return blob.url
		},

		deleteFile: async (fileId: string) => {
			await api.del(`/storage/files/${fileId}`)
		},

		getUrl: async (fileId: string) => {
			const data = await api.get<{ url: string }>(`/storage/files/${fileId}`)
			return data.url
		},
	}
}
