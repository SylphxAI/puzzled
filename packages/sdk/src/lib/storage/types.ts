/**
 * Storage Module Types
 */

// ==========================================
// Configuration
// ==========================================

export interface StorageConfig {
	/** App ID */
	appId: string
	/** Publishable key for authentication */
	publishableKey: string
	/** Platform URL (default: https://sylphx.com) */
	platformUrl?: string
	/** User ID for authenticated uploads */
	userId?: string
	/** Debug mode */
	debug?: boolean
}

// ==========================================
// Upload Types
// ==========================================

export interface UploadOptions {
	/** Custom path/folder for the file */
	path?: string
	/** Progress callback */
	onProgress?: (event: UploadProgressEvent) => void
	/** Custom filename (defaults to original) */
	filename?: string
	/** Content type override */
	contentType?: string
	/** Custom metadata */
	metadata?: Record<string, string>
}

export interface UploadProgressEvent {
	/** Bytes uploaded */
	loaded: number
	/** Total bytes */
	total: number
	/** Progress percentage (0-100) */
	progress: number
}

export interface UploadResult {
	/** Public URL of uploaded file */
	url: string
	/** File path/key in storage */
	pathname: string
	/** Content type */
	contentType: string
	/** File size in bytes */
	size: number
}

// ==========================================
// File Types
// ==========================================

export interface StorageFile {
	/** File ID */
	id: string
	/** File path/key */
	path: string
	/** Original filename */
	filename: string
	/** Alias for filename (for backward compat) */
	name?: string
	/** MIME type */
	mimeType: string
	/** Size in bytes */
	sizeBytes: number
	/** Alias for sizeBytes (for backward compat) */
	size?: number
	/** Public URL (if public) */
	publicUrl?: string | null
	/** Alias for publicUrl (for backward compat) */
	url?: string
	/** Created timestamp */
	createdAt: string
	/** Custom metadata */
	metadata?: Record<string, string>
}

// ==========================================
// List Types
// ==========================================

export interface ListFilesOptions {
	/** Folder/prefix to list */
	prefix?: string
	/** Max results per page */
	limit?: number
	/** Cursor for pagination */
	cursor?: string
}

export interface ListFilesResult {
	/** Files in this page */
	files: StorageFile[]
	/** Cursor for next page */
	cursor?: string
	/** Whether there are more results */
	hasMore: boolean
}

// ==========================================
// Image Transformation Types
// ==========================================

export type ImageFormat = 'webp' | 'avif' | 'jpeg' | 'png' | 'auto'
export type ImageFit = 'cover' | 'contain' | 'fill' | 'inside' | 'outside'

export interface ImageTransformOptions {
	/** Target width in pixels */
	width?: number
	/** Target height in pixels */
	height?: number
	/** Quality (1-100, default: 80) */
	quality?: number
	/** Output format (default: auto - picks best based on browser) */
	format?: ImageFormat
	/** Fit mode when both width and height are specified */
	fit?: ImageFit
	/** Background color for transparent images (hex without #) */
	background?: string
	/** Enable blur effect (1-100) */
	blur?: number
	/** Auto-optimize for web delivery */
	optimize?: boolean
}

export interface ImageTransformResult {
	/** Transformed image URL */
	url: string
	/** Content type of transformed image */
	contentType: string
	/** Size of transformed image in bytes */
	size: number
	/** Width of transformed image */
	width: number
	/** Height of transformed image */
	height: number
	/** Whether image was served from cache */
	cached: boolean
}
