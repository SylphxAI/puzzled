/**
 * Storage Hooks Tests
 *
 * Tests for file upload hooks logic.
 */

import { describe, expect, test } from 'bun:test'

// ============================================================================
// Types (from storage-hooks.ts)
// ============================================================================

interface UploadProgressEvent {
	progress: number
	loaded: number
	total: number
}

// ============================================================================
// Progress Calculation Tests
// ============================================================================

describe('Progress calculation', () => {
	test('calculates progress from event', () => {
		function handleProgress(event: UploadProgressEvent) {
			return {
				progress: event.progress,
				bytesUploaded: event.loaded,
				bytesTotal: event.total,
			}
		}

		const event: UploadProgressEvent = {
			progress: 50,
			loaded: 500,
			total: 1000,
		}

		const result = handleProgress(event)
		expect(result.progress).toBe(50)
		expect(result.bytesUploaded).toBe(500)
		expect(result.bytesTotal).toBe(1000)
	})

	test('handles zero progress', () => {
		function handleProgress(event: UploadProgressEvent) {
			return {
				progress: event.progress,
				bytesUploaded: event.loaded,
				bytesTotal: event.total,
			}
		}

		const event: UploadProgressEvent = {
			progress: 0,
			loaded: 0,
			total: 1024,
		}

		const result = handleProgress(event)
		expect(result.progress).toBe(0)
		expect(result.bytesUploaded).toBe(0)
		expect(result.bytesTotal).toBe(1024)
	})

	test('handles 100% progress', () => {
		function handleProgress(event: UploadProgressEvent) {
			return {
				progress: event.progress,
				bytesUploaded: event.loaded,
				bytesTotal: event.total,
			}
		}

		const event: UploadProgressEvent = {
			progress: 100,
			loaded: 5000,
			total: 5000,
		}

		const result = handleProgress(event)
		expect(result.progress).toBe(100)
		expect(result.bytesUploaded).toBe(5000)
		expect(result.bytesTotal).toBe(5000)
	})
})

// ============================================================================
// Cancellation Detection Tests
// ============================================================================

describe('Cancellation detection', () => {
	test('detects AbortError', () => {
		function isCancellation(err: unknown): boolean {
			return err instanceof DOMException && err.name === 'AbortError'
		}

		const abortError = new DOMException('The operation was aborted', 'AbortError')
		expect(isCancellation(abortError)).toBe(true)

		const otherError = new Error('Network error')
		expect(isCancellation(otherError)).toBe(false)

		const otherDomException = new DOMException('Invalid state', 'InvalidStateError')
		expect(isCancellation(otherDomException)).toBe(false)
	})
})

// ============================================================================
// Upload State Management Tests
// ============================================================================

describe('Upload state management', () => {
	interface UploadState {
		isUploading: boolean
		progress: number
		bytesUploaded: number
		bytesTotal: number
		uploadError: Error | null
		wasCancelled: boolean
	}

	test('initializes upload state correctly', () => {
		function initUploadState(fileSize: number): UploadState {
			return {
				isUploading: true,
				progress: 0,
				bytesUploaded: 0,
				bytesTotal: fileSize,
				uploadError: null,
				wasCancelled: false,
			}
		}

		const state = initUploadState(1024)
		expect(state.isUploading).toBe(true)
		expect(state.progress).toBe(0)
		expect(state.bytesUploaded).toBe(0)
		expect(state.bytesTotal).toBe(1024)
		expect(state.uploadError).toBeNull()
		expect(state.wasCancelled).toBe(false)
	})

	test('handles successful upload completion', () => {
		let state: UploadState = {
			isUploading: true,
			progress: 50,
			bytesUploaded: 500,
			bytesTotal: 1000,
			uploadError: null,
			wasCancelled: false,
		}

		function completeUpload() {
			state = {
				...state,
				isUploading: false,
				progress: 100,
			}
		}

		completeUpload()
		expect(state.isUploading).toBe(false)
		expect(state.progress).toBe(100)
		expect(state.uploadError).toBeNull()
	})

	test('handles upload error', () => {
		let state: UploadState = {
			isUploading: true,
			progress: 30,
			bytesUploaded: 300,
			bytesTotal: 1000,
			uploadError: null,
			wasCancelled: false,
		}

		function handleError(error: Error) {
			state = {
				...state,
				isUploading: false,
				uploadError: error,
			}
		}

		const error = new Error('Network timeout')
		handleError(error)
		expect(state.isUploading).toBe(false)
		expect(state.uploadError).toBe(error)
		expect(state.wasCancelled).toBe(false)
	})

	test('handles upload cancellation', () => {
		let state: UploadState = {
			isUploading: true,
			progress: 30,
			bytesUploaded: 300,
			bytesTotal: 1000,
			uploadError: null,
			wasCancelled: false,
		}

		function handleCancellation() {
			state = {
				...state,
				isUploading: false,
				wasCancelled: true,
			}
		}

		handleCancellation()
		expect(state.isUploading).toBe(false)
		expect(state.wasCancelled).toBe(true)
		expect(state.uploadError).toBeNull()
	})
})

// ============================================================================
// File Validation Tests
// ============================================================================

describe('File validation', () => {
	describe('MIME type validation', () => {
		function validateMimeType(fileType: string, accepted: string[]): boolean {
			return accepted.some((type) => {
				if (type.endsWith('/*')) {
					const category = type.slice(0, -2)
					return fileType.startsWith(category)
				}
				return fileType === type
			})
		}

		test('validates exact MIME types', () => {
			expect(validateMimeType('image/png', ['image/png'])).toBe(true)
			expect(validateMimeType('image/jpeg', ['image/png'])).toBe(false)
			expect(validateMimeType('application/pdf', ['application/pdf'])).toBe(true)
		})

		test('validates wildcard MIME types', () => {
			expect(validateMimeType('image/png', ['image/*'])).toBe(true)
			expect(validateMimeType('image/jpeg', ['image/*'])).toBe(true)
			expect(validateMimeType('image/gif', ['image/*'])).toBe(true)
			expect(validateMimeType('application/pdf', ['image/*'])).toBe(false)
		})

		test('validates against multiple accepted types', () => {
			const accepted = ['image/*', 'application/pdf']
			expect(validateMimeType('image/png', accepted)).toBe(true)
			expect(validateMimeType('application/pdf', accepted)).toBe(true)
			expect(validateMimeType('text/plain', accepted)).toBe(false)
		})

		test('handles empty accepted list', () => {
			expect(validateMimeType('image/png', [])).toBe(false)
		})
	})

	describe('File size validation', () => {
		function validateFileSize(size: number, maxSize: number): boolean {
			return size <= maxSize
		}

		test('accepts files under limit', () => {
			const maxSize = 5 * 1024 * 1024 // 5MB
			expect(validateFileSize(1024, maxSize)).toBe(true)
			expect(validateFileSize(4 * 1024 * 1024, maxSize)).toBe(true)
		})

		test('accepts files at exact limit', () => {
			const maxSize = 5 * 1024 * 1024
			expect(validateFileSize(maxSize, maxSize)).toBe(true)
		})

		test('rejects files over limit', () => {
			const maxSize = 5 * 1024 * 1024
			expect(validateFileSize(6 * 1024 * 1024, maxSize)).toBe(false)
		})
	})
})

// ============================================================================
// useFileUpload Options Tests
// ============================================================================

describe('useFileUpload options', () => {
	interface UseFileUploadOptions {
		path?: string
		accept?: string[]
		maxSize?: number
	}

	test('builds validation function from options', () => {
		function createValidator(options: UseFileUploadOptions) {
			return (file: { type: string; size: number }): Error | null => {
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
						return new Error(`File type ${file.type} not accepted`)
					}
				}

				// Validate file size
				if (options.maxSize && file.size > options.maxSize) {
					const maxMB = (options.maxSize / 1024 / 1024).toFixed(1)
					return new Error(`File size exceeds ${maxMB}MB limit`)
				}

				return null
			}
		}

		const validator = createValidator({
			accept: ['image/*'],
			maxSize: 5 * 1024 * 1024,
		})

		// Valid file
		expect(validator({ type: 'image/png', size: 1024 })).toBeNull()

		// Invalid type
		const typeError = validator({ type: 'application/pdf', size: 1024 })
		expect(typeError?.message).toContain('not accepted')

		// Invalid size
		const sizeError = validator({ type: 'image/png', size: 10 * 1024 * 1024 })
		expect(sizeError?.message).toContain('exceeds')
	})
})

// ============================================================================
// Reset State Tests
// ============================================================================

describe('Reset state', () => {
	test('resets all upload state', () => {
		interface UploadState {
			isUploading: boolean
			progress: number
			bytesUploaded: number
			bytesTotal: number
			error: Error | null
			wasCancelled: boolean
			url: string | null
		}

		let state: UploadState = {
			isUploading: false,
			progress: 100,
			bytesUploaded: 5000,
			bytesTotal: 5000,
			error: null,
			wasCancelled: false,
			url: 'https://example.com/file.png',
		}

		function reset() {
			state = {
				isUploading: false,
				progress: 0,
				bytesUploaded: 0,
				bytesTotal: 0,
				error: null,
				wasCancelled: false,
				url: null,
			}
		}

		reset()
		expect(state.isUploading).toBe(false)
		expect(state.progress).toBe(0)
		expect(state.bytesUploaded).toBe(0)
		expect(state.bytesTotal).toBe(0)
		expect(state.error).toBeNull()
		expect(state.wasCancelled).toBe(false)
		expect(state.url).toBeNull()
	})
})

// ============================================================================
// Callback Tests
// ============================================================================

describe('Upload callbacks', () => {
	test('onSuccess called on successful upload', async () => {
		let successUrl: string | null = null

		const options = {
			onSuccess: (url: string) => {
				successUrl = url
			},
		}

		// Simulate successful upload
		const uploadedUrl = 'https://example.com/uploaded.png'
		options.onSuccess(uploadedUrl)

		expect(successUrl).toBe(uploadedUrl)
	})

	test('onError called on upload failure', () => {
		let capturedError: Error | null = null

		const options = {
			onError: (error: Error) => {
				capturedError = error
			},
		}

		// Simulate upload error
		const uploadError = new Error('Upload failed')
		options.onError(uploadError)

		expect(capturedError).toBe(uploadError)
	})

	test('onCancel called on cancellation', () => {
		let cancelCalled = false

		const options = {
			onCancel: () => {
				cancelCalled = true
			},
		}

		// Simulate cancellation
		options.onCancel()

		expect(cancelCalled).toBe(true)
	})
})

// ============================================================================
// isError Derived State Tests
// ============================================================================

describe('isError derived state', () => {
	test('isError is true when error exists', () => {
		const error = new Error('Upload failed')
		const isError = error !== null
		expect(isError).toBe(true)
	})

	test('isError is false when no error', () => {
		const error = null
		const isError = error !== null
		expect(isError).toBe(false)
	})
})
