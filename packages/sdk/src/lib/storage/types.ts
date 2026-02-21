/**
 * Storage Module Types
 */

// ==========================================
// Configuration
// ==========================================

interface StorageConfig {
	/** Publishable key — identifies the app */
	appId: string;
	/** Platform URL (default: https://sylphx.com) */
	platformUrl?: string;
	/** User ID for authenticated uploads */
	userId?: string;
	/** Debug mode */
	debug?: boolean;
}

// ==========================================
// Upload Types
// ==========================================

export interface UploadOptions {
	/** Custom path/folder for the file */
	path?: string;
	/** Progress callback */
	onProgress?: (event: UploadProgressEvent) => void;
	/** Custom filename (defaults to original) */
	filename?: string;
	/** Content type override */
	contentType?: string;
	/** Custom metadata */
	metadata?: Record<string, string>;
	/**
	 * Enable multipart upload for large files.
	 * - `true`: Always use multipart upload
	 * - `false`: Never use multipart upload
	 * - `'auto'` (default): Auto-enable for files > 5MB
	 *
	 * Multipart uploads support files up to 5TB and provide
	 * better reliability for large files with resumable uploads.
	 */
	multipart?: boolean | "auto";
	/**
	 * AbortSignal to cancel the upload.
	 * Vercel Blob pattern - enables cancellation of in-progress uploads.
	 *
	 * @example
	 * ```typescript
	 * const controller = new AbortController()
	 * // Cancel after 30 seconds
	 * setTimeout(() => controller.abort(), 30000)
	 * await upload(file, { signal: controller.signal })
	 * ```
	 */
	signal?: AbortSignal;
}

export interface UploadProgressEvent {
	/** Bytes uploaded */
	loaded: number;
	/** Total bytes */
	total: number;
	/** Progress percentage (0-100) */
	progress: number;
}

export interface UploadResult {
	/** Public URL of uploaded file */
	url: string;
	/** File path/key in storage */
	pathname: string;
	/** Content type */
	contentType: string;
	/** File size in bytes */
	size: number;
}

// ==========================================
// File Types
// ==========================================

export interface StorageFile {
	/** File ID */
	id: string;
	/** File path/key */
	path: string;
	/** Original filename */
	filename: string;
	/** MIME type */
	mimeType: string;
	/** Size in bytes */
	sizeBytes: number;
	/** Public URL (if public) */
	publicUrl?: string | null;
	/** Created timestamp */
	createdAt: string;
	/** Custom metadata */
	metadata?: Record<string, string>;
}

// ==========================================
// List Types
// ==========================================

interface ListFilesOptions {
	/** Folder/prefix to list */
	prefix?: string;
	/** Max results per page */
	limit?: number;
	/** Cursor for pagination */
	cursor?: string;
}

interface ListFilesResult {
	/** Files in this page */
	files: StorageFile[];
	/** Cursor for next page */
	cursor?: string;
	/** Whether there are more results */
	hasMore: boolean;
}

// ==========================================
// Image Transformation Types
// ==========================================

type ImageFormat = "webp" | "avif" | "jpeg" | "png" | "auto";
type ImageFit = "cover" | "contain" | "fill" | "inside" | "outside";

interface ImageTransformOptions {
	/** Target width in pixels */
	width?: number;
	/** Target height in pixels */
	height?: number;
	/** Quality (1-100, default: 80) */
	quality?: number;
	/** Output format (default: auto - picks best based on browser) */
	format?: ImageFormat;
	/** Fit mode when both width and height are specified */
	fit?: ImageFit;
	/** Background color for transparent images (hex without #) */
	background?: string;
	/** Enable blur effect (1-100) */
	blur?: number;
	/** Auto-optimize for web delivery */
	optimize?: boolean;
}

interface ImageTransformResult {
	/** Transformed image URL */
	url: string;
	/** Content type of transformed image */
	contentType: string;
	/** Size of transformed image in bytes */
	size: number;
	/** Width of transformed image */
	width: number;
	/** Height of transformed image */
	height: number;
	/** Whether image was served from cache */
	cached: boolean;
}
