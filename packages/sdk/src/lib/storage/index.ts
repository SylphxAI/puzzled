/**
 * Storage Module
 *
 * Client-side file storage with:
 * - Client-direct uploads (zero server bandwidth)
 * - Progress tracking
 * - Avatar uploads
 * - Presigned URLs for server-side uploads
 * - Image optimization and transformation
 *
 * @example
 * ```typescript
 * import { StorageClient, initStorage, getStorageClient } from '@sylphx/platform-sdk/storage'
 *
 * // Option 1: Create instance directly
 * const storage = new StorageClient({
 *   appId: 'my-app',
 *   publishableKey: 'sk_dev_xxx',
 * })
 *
 * // Upload with progress
 * const result = await storage.upload(file, {
 *   path: 'uploads/images',
 *   onProgress: (e) => {
 *     console.log(`Progress: ${e.progress}%`)
 *   },
 * })
 *
 * // Get optimized image URL
 * const thumbUrl = storage.getImageUrl(result.url, {
 *   width: 400,
 *   height: 300,
 *   format: 'webp',
 *   quality: 80,
 * })
 *
 * // Generate responsive srcset
 * const srcset = storage.getImageSrcSet(result.url, {
 *   widths: [320, 640, 1024, 1920],
 *   format: 'webp',
 * })
 *
 * // Option 2: Use global instance
 * initStorage({ appId: 'my-app', publishableKey: 'sk_dev_xxx' })
 * const client = getStorageClient()
 * await client.upload(file)
 * ```
 */

// Client
export {
	StorageClient,
	initStorage,
	getStorageClient,
	resetStorageClient,
} from './client'

// Types
export type {
	StorageConfig,
	UploadOptions,
	UploadProgressEvent,
	UploadResult,
	StorageFile,
	ListFilesOptions,
	ListFilesResult,
	// Image optimization types
	ImageFormat,
	ImageFit,
	ImageTransformOptions,
	ImageTransformResult,
} from './types'
