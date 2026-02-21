/**
 * Storage Context Value Factory
 *
 * Creates the Storage context value for the SylphxProvider.
 * Provides file upload using presigned S3 URLs (MinIO-compatible).
 *
 * Upload flow:
 * 1. Request presigned upload URL from platform API
 * 2. Upload directly to MinIO (zero server bandwidth)
 * 3. Notify platform of completed upload for DB recording
 */

import type { RestApiClient } from "../rest-client";
import type {
	StorageContextValue,
	UploadOptions,
	UploadProgressEvent,
} from "../services-context";

// =============================================================================
// Types
// =============================================================================

export interface CreateStorageValueConfig {
	/** REST API client */
	api: RestApiClient;
	/** Platform URL */
	platformUrl: string;
	/** App ID */
	appId?: string;
	/** User ID (if authenticated) */
	userId: string | null;
}

interface PresignedTokenResponse {
	presignedUrl: string;
	storageKey: string;
	tokenPayload: string;
	url: string;
	allowedContentTypes: string[];
	maximumSizeInBytes: number;
}

// =============================================================================
// Upload Helper
// =============================================================================

/**
 * Upload a file using a presigned S3 URL.
 * Replacement for @vercel/blob/client upload.
 */
async function uploadWithPresignedUrl(
	file: File,
	presignedUrl: string,
	onProgress?: (event: UploadProgressEvent) => void,
): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		const xhr = new XMLHttpRequest();

		if (onProgress) {
			xhr.upload.addEventListener("progress", (e) => {
				if (e.lengthComputable) {
					onProgress({
						loaded: e.loaded,
						total: e.total,
						progress: Math.round((e.loaded / e.total) * 100),
					});
				}
			});
		}

		xhr.addEventListener("load", () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				resolve();
			} else {
				reject(new Error(`Upload failed with status ${xhr.status}`));
			}
		});

		xhr.addEventListener("error", () =>
			reject(new Error("Upload network error")),
		);
		xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

		xhr.open("PUT", presignedUrl);
		xhr.setRequestHeader(
			"Content-Type",
			file.type || "application/octet-stream",
		);
		xhr.send(file);
	});
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create Storage context value.
 *
 * Uses presigned S3 URLs for client-side uploads with:
 * - Zero server bandwidth (direct to MinIO)
 * - Real progress tracking via XHR
 * - Works with any S3-compatible storage (MinIO, AWS S3, etc.)
 */
export function createStorageValue(
	config: CreateStorageValueConfig,
): StorageContextValue {
	const { platformUrl, appId, userId } = config;

	const handleUpload = async (
		file: File,
		type: "file" | "avatar",
		options?: UploadOptions,
	): Promise<string> => {
		// Step 1: Request presigned URL from platform
		const clientPayload = JSON.stringify({
			appId,
			userId,
			type,
			folder: options?.path,
		});

		const tokenRes = await fetch(`${platformUrl}/api/storage/upload`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				type: "generate-token",
				pathname: file.name,
				clientPayload,
			}),
		});

		if (!tokenRes.ok) {
			const err = (await tokenRes
				.json()
				.catch(() => ({ error: "Unknown error" }))) as { error?: string };
			throw new Error(err.error ?? "Failed to get upload token");
		}

		const { presignedUrl, url, storageKey, tokenPayload } =
			(await tokenRes.json()) as PresignedTokenResponse;

		// Step 2: Upload directly to storage
		await uploadWithPresignedUrl(file, presignedUrl, options?.onProgress);

		// Step 3: Notify platform of completed upload
		const completeRes = await fetch(`${platformUrl}/api/storage/upload`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				type: "upload-complete",
				url,
				pathname: storageKey,
				tokenPayload,
			}),
		});

		if (!completeRes.ok) {
			const err = (await completeRes
				.json()
				.catch(() => ({ error: "Unknown error" }))) as { error?: string };
			throw new Error(err.error ?? "Failed to complete upload");
		}

		const result = (await completeRes.json()) as { url: string };
		return result.url;
	};

	return {
		upload: async (file: File, options?: UploadOptions) => {
			return handleUpload(file, "file", options);
		},

		uploadAvatar: async (
			file: File,
			options?: { onProgress?: (event: UploadProgressEvent) => void },
		) => {
			if (!userId) {
				throw new Error("Must be logged in to upload avatar");
			}
			return handleUpload(file, "avatar", options);
		},

		deleteFile: async (fileId: string) => {
			const res = await fetch(`${platformUrl}/api/storage/${fileId}`, {
				method: "DELETE",
			});
			if (!res.ok) throw new Error("Failed to delete file");
		},

		getUrl: async (fileId: string) => {
			const res = await fetch(`${platformUrl}/api/storage/${fileId}`);
			if (!res.ok) throw new Error("Failed to get file URL");
			const data = (await res.json()) as { file: { url: string } };
			return data.file.url;
		},
	};
}
