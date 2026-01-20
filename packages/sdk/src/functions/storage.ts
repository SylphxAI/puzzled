/**
 * Storage Functions
 *
 * Pure functions for file storage operations.
 */

import { type SylphxConfig, buildHeaders } from './config'

// ============================================================================
// Types
// ============================================================================

export interface UploadOptions {
	/** Folder path */
	path?: string
	/** File type (file, avatar, etc.) */
	type?: 'file' | 'avatar'
	/** User ID (for avatar uploads) */
	userId?: string
	/** Progress callback */
	onProgress?: (event: UploadProgressEvent) => void
}

export interface UploadProgressEvent {
	loaded: number
	total: number
	progress: number // 0-100
}

export interface UploadResult {
	url: string
	pathname: string
	contentType: string
	size: number
}

export interface FileInfo {
	id: string
	url: string
	name: string
	size: number
	contentType: string
	createdAt: string
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Upload a file to storage
 *
 * Uses client-side upload for optimal performance (direct to CDN).
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
 */
export async function uploadFile(
	config: SylphxConfig,
	file: File,
	options?: UploadOptions
): Promise<UploadResult> {
	// Get upload token from platform
	const tokenResponse = await fetch(`${config.platformUrl}/api/storage/upload`, {
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
	})

	if (!tokenResponse.ok) {
		const error = await tokenResponse.json().catch(() => ({ message: 'Failed to get upload token' }))
		throw new Error(error.message ?? 'Failed to get upload token')
	}

	const { uploadUrl, publicUrl } = await tokenResponse.json()

	// Upload directly to storage
	const xhr = new XMLHttpRequest()

	const uploadPromise = new Promise<UploadResult>((resolve, reject) => {
		xhr.upload.addEventListener('progress', (event) => {
			if (event.lengthComputable && options?.onProgress) {
				options.onProgress({
					loaded: event.loaded,
					total: event.total,
					progress: Math.round((event.loaded / event.total) * 100),
				})
			}
		})

		xhr.addEventListener('load', () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				resolve({
					url: publicUrl,
					pathname: options?.path ? `${options.path}/${file.name}` : file.name,
					contentType: file.type,
					size: file.size,
				})
			} else {
				reject(new Error(`Upload failed with status ${xhr.status}`))
			}
		})

		xhr.addEventListener('error', () => {
			reject(new Error('Upload failed'))
		})

		xhr.open('PUT', uploadUrl)
		xhr.setRequestHeader('Content-Type', file.type)
		xhr.send(file)
	})

	return uploadPromise
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
	options?: Pick<UploadOptions, 'onProgress'>
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
	const response = await fetch(`${config.platformUrl}/api/trpc/storage.deleteFile`, {
		method: 'POST',
		headers: buildHeaders(config),
		body: JSON.stringify({ json: { id: fileId } }),
	})

	if (!response.ok) {
		const error = await response.json().catch(() => ({ message: 'Failed to delete file' }))
		throw new Error(error.error?.message ?? error.message ?? 'Failed to delete file')
	}
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
	const response = await fetch(
		`${config.platformUrl}/api/trpc/storage.getFile?input=${encodeURIComponent(JSON.stringify({ json: { id: fileId } }))}`,
		{
			method: 'GET',
			headers: buildHeaders(config),
		}
	)

	if (!response.ok) {
		const error = await response.json().catch(() => ({ message: 'Failed to get file' }))
		throw new Error(error.error?.message ?? error.message ?? 'Failed to get file')
	}

	const data = await response.json()
	return data.result?.data?.json?.url ?? data.result?.data?.url
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
	const response = await fetch(
		`${config.platformUrl}/api/trpc/storage.getFile?input=${encodeURIComponent(JSON.stringify({ json: { id: fileId } }))}`,
		{
			method: 'GET',
			headers: buildHeaders(config),
		}
	)

	if (!response.ok) {
		const error = await response.json().catch(() => ({ message: 'Failed to get file' }))
		throw new Error(error.error?.message ?? error.message ?? 'Failed to get file')
	}

	const data = await response.json()
	return data.result?.data?.json ?? data.result?.data
}
