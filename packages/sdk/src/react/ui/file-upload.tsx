/**
 * File Upload Components
 *
 * Pre-built file upload components with drag-and-drop,
 * progress tracking, and validation.
 */

'use client'

import { useState, useRef, useCallback, useEffect, type CSSProperties, type DragEvent } from 'react'
import type { ThemeVariables } from './styles'
import { defaultTheme, baseStyles, mergeStyles, injectGlobalStyles } from './styles'
import { useFileUpload, useStorage } from '../storage-hooks'

// ============================================
// FileUpload
// ============================================

export interface FileUploadProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Allowed file types (MIME types) */
	accept?: string[]
	/** Max file size in bytes */
	maxSize?: number
	/** Allow multiple files */
	multiple?: boolean
	/** Called when files are uploaded successfully */
	onUpload?: (urls: string[]) => void
	/** Called when upload fails */
	onError?: (error: Error) => void
	/** Custom class name */
	className?: string
	/** Disabled state */
	disabled?: boolean
	/** Placeholder text */
	placeholder?: string
	/** Show file list */
	showFileList?: boolean
}

/**
 * File Upload component with drag and drop
 *
 * @example
 * ```tsx
 * <FileUpload
 *   accept={['application/pdf', 'image/*']}
 *   maxSize={10 * 1024 * 1024}
 *   onUpload={(urls) => console.log('Uploaded:', urls)}
 * />
 * ```
 */
export function FileUpload({
	theme = defaultTheme,
	accept,
	maxSize,
	multiple = false,
	onUpload,
	onError,
	className,
	disabled = false,
	placeholder = 'Drop files here or click to upload',
	showFileList = true,
}: FileUploadProps) {
	const [isDragging, setIsDragging] = useState(false)
	const [uploadedFiles, setUploadedFiles] = useState<{ name: string; url: string }[]>([])
	const inputRef = useRef<HTMLInputElement>(null)
	const { upload, isUploading, progress, error } = useFileUpload({ accept, maxSize, onError })
	const styles = baseStyles(theme)

	useEffect(() => {
		injectGlobalStyles()
	}, [])

	const handleFiles = useCallback(
		async (files: FileList | null) => {
			if (!files || files.length === 0) return

			const fileArray = Array.from(files)
			const urls: string[] = []

			for (const file of fileArray) {
				try {
					const url = await upload(file)
					urls.push(url)
					setUploadedFiles((prev) => [...prev, { name: file.name, url }])
				} catch (err) {
					// Error handled by useFileUpload
				}
			}

			if (urls.length > 0) {
				onUpload?.(urls)
			}
		},
		[upload, onUpload]
	)

	const handleDrop = useCallback(
		(e: DragEvent<HTMLDivElement>) => {
			e.preventDefault()
			e.stopPropagation()
			setIsDragging(false)

			if (disabled) return
			handleFiles(e.dataTransfer.files)
		},
		[handleFiles, disabled]
	)

	const handleDragOver = useCallback(
		(e: DragEvent<HTMLDivElement>) => {
			e.preventDefault()
			e.stopPropagation()
			if (!disabled) setIsDragging(true)
		},
		[disabled]
	)

	const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
		e.preventDefault()
		e.stopPropagation()
		setIsDragging(false)
	}, [])

	const handleClick = () => {
		if (!disabled && inputRef.current) {
			inputRef.current.click()
		}
	}

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		handleFiles(e.target.files)
		if (inputRef.current) {
			inputRef.current.value = ''
		}
	}

	const removeFile = (index: number) => {
		setUploadedFiles((prev) => prev.filter((_, i) => i !== index))
	}

	const dropZoneStyle: CSSProperties = mergeStyles(
		{
			border: `2px dashed ${isDragging ? theme.colorPrimary : theme.colorBorder}`,
			borderRadius: theme.borderRadiusLg,
			padding: '2rem',
			textAlign: 'center',
			cursor: disabled ? 'not-allowed' : 'pointer',
			transition: 'all 0.2s ease',
			backgroundColor: isDragging ? `${theme.colorPrimary}08` : theme.colorBackground,
			opacity: disabled ? 0.6 : 1,
		},
		isUploading ? { pointerEvents: 'none' } : undefined
	)

	const acceptString = accept?.join(',')

	return (
		<div className={className} style={{ fontFamily: theme.fontFamily }}>
			<div
				onDrop={handleDrop}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onClick={handleClick}
				style={dropZoneStyle}
			>
				<input
					ref={inputRef}
					type="file"
					accept={acceptString}
					multiple={multiple}
					onChange={handleInputChange}
					style={{ display: 'none' }}
					disabled={disabled}
				/>

				{isUploading ? (
					<div>
						<span style={styles.spinner} />
						<p style={mergeStyles(styles.textSm, styles.textMuted, { marginTop: '0.5rem' })}>
							Uploading... {progress}%
						</p>
						<ProgressBar progress={progress} theme={theme} />
					</div>
				) : (
					<>
						<UploadIcon color={theme.colorMutedForeground} />
						<p style={mergeStyles(styles.textSm, styles.textMuted, { marginTop: '0.5rem' })}>{placeholder}</p>
						{maxSize && (
							<p style={mergeStyles(styles.textXs, styles.textMuted)}>
								Max size: {formatFileSize(maxSize)}
							</p>
						)}
					</>
				)}
			</div>

			{error && (
				<div style={mergeStyles(styles.alert, styles.alertError, { marginTop: '0.75rem' })}>{error.message}</div>
			)}

			{showFileList && uploadedFiles.length > 0 && (
				<div style={{ marginTop: '1rem' }}>
					{uploadedFiles.map((file, index) => (
						<div
							key={index}
							style={{
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'space-between',
								padding: '0.5rem 0.75rem',
								backgroundColor: theme.colorMuted,
								borderRadius: theme.borderRadiusSm,
								marginBottom: '0.5rem',
							}}
						>
							<span style={{ fontSize: theme.fontSizeSm, overflow: 'hidden', textOverflow: 'ellipsis' }}>
								{file.name}
							</span>
							<button
								type="button"
								onClick={() => removeFile(index)}
								style={mergeStyles(styles.button, styles.buttonGhost, { padding: '0.25rem' })}
							>
								<CloseIcon />
							</button>
						</div>
					))}
				</div>
			)}
		</div>
	)
}

// ============================================
// ImageUploader
// ============================================

export interface ImageUploaderProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Max file size in bytes */
	maxSize?: number
	/** Current image URL */
	value?: string | null
	/** Called when image is uploaded */
	onChange?: (url: string | null) => void
	/** Called when upload fails */
	onError?: (error: Error) => void
	/** Custom class name */
	className?: string
	/** Disabled state */
	disabled?: boolean
	/** Aspect ratio (e.g., "1:1", "16:9") */
	aspectRatio?: string
	/** Placeholder text */
	placeholder?: string
}

/**
 * Image uploader with preview
 *
 * @example
 * ```tsx
 * const [coverImage, setCoverImage] = useState<string | null>(null)
 *
 * <ImageUploader
 *   value={coverImage}
 *   onChange={setCoverImage}
 *   aspectRatio="16:9"
 *   maxSize={5 * 1024 * 1024}
 * />
 * ```
 */
export function ImageUploader({
	theme = defaultTheme,
	maxSize = 5 * 1024 * 1024,
	value,
	onChange,
	onError,
	className,
	disabled = false,
	aspectRatio = '1:1',
	placeholder = 'Click to upload image',
}: ImageUploaderProps) {
	const [previewUrl, setPreviewUrl] = useState<string | null>(value || null)
	const inputRef = useRef<HTMLInputElement>(null)
	const { upload, isUploading, progress, error } = useFileUpload({
		accept: ['image/*'],
		maxSize,
		onError,
	})
	const styles = baseStyles(theme)

	useEffect(() => {
		setPreviewUrl(value || null)
	}, [value])

	useEffect(() => {
		injectGlobalStyles()
	}, [])

	const handleFile = async (file: File) => {
		try {
			// Create local preview
			const localUrl = URL.createObjectURL(file)
			setPreviewUrl(localUrl)

			// Upload
			const url = await upload(file)
			setPreviewUrl(url)
			onChange?.(url)

			// Cleanup local URL
			URL.revokeObjectURL(localUrl)
		} catch (err) {
			setPreviewUrl(value || null)
		}
	}

	const handleClick = () => {
		if (!disabled && inputRef.current) {
			inputRef.current.click()
		}
	}

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (file) handleFile(file)
		if (inputRef.current) inputRef.current.value = ''
	}

	const handleRemove = (e: React.MouseEvent) => {
		e.stopPropagation()
		setPreviewUrl(null)
		onChange?.(null)
	}

	// Calculate aspect ratio
	const [ratioW, ratioH] = aspectRatio.split(':').map(Number)
	const paddingBottom = `${(ratioH / ratioW) * 100}%`

	const containerStyle: CSSProperties = {
		position: 'relative',
		width: '100%',
		paddingBottom,
		borderRadius: theme.borderRadiusLg,
		overflow: 'hidden',
		cursor: disabled ? 'not-allowed' : 'pointer',
		opacity: disabled ? 0.6 : 1,
	}

	const innerStyle: CSSProperties = {
		position: 'absolute',
		inset: 0,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		border: `2px dashed ${theme.colorBorder}`,
		borderRadius: theme.borderRadiusLg,
		backgroundColor: theme.colorMuted,
		transition: 'all 0.2s ease',
	}

	return (
		<div className={className} style={{ fontFamily: theme.fontFamily }}>
			<div style={containerStyle} onClick={handleClick}>
				<input
					ref={inputRef}
					type="file"
					accept="image/*"
					onChange={handleInputChange}
					style={{ display: 'none' }}
					disabled={disabled}
				/>

				<div style={innerStyle}>
					{isUploading ? (
						<div style={{ textAlign: 'center' }}>
							<span style={styles.spinner} />
							<p style={mergeStyles(styles.textSm, styles.textMuted, { marginTop: '0.5rem' })}>
								{progress}%
							</p>
						</div>
					) : previewUrl ? (
						<>
							<img
								src={previewUrl}
								alt="Preview"
								style={{
									width: '100%',
									height: '100%',
									objectFit: 'cover',
									position: 'absolute',
									inset: 0,
								}}
							/>
							<div
								style={{
									position: 'absolute',
									inset: 0,
									backgroundColor: 'rgba(0, 0, 0, 0.4)',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									opacity: 0,
									transition: 'opacity 0.2s ease',
								}}
								onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
								onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
							>
								<button
									type="button"
									onClick={handleRemove}
									style={mergeStyles(styles.button, styles.buttonDestructive, { marginRight: '0.5rem' })}
								>
									Remove
								</button>
								<button type="button" style={mergeStyles(styles.button, styles.buttonPrimary)}>
									Replace
								</button>
							</div>
						</>
					) : (
						<div style={{ textAlign: 'center' }}>
							<ImageIcon color={theme.colorMutedForeground} />
							<p style={mergeStyles(styles.textSm, styles.textMuted, { marginTop: '0.5rem' })}>
								{placeholder}
							</p>
						</div>
					)}
				</div>
			</div>

			{error && (
				<div style={mergeStyles(styles.alert, styles.alertError, { marginTop: '0.75rem' })}>{error.message}</div>
			)}
		</div>
	)
}

// ============================================
// AvatarUpload
// ============================================

export interface AvatarUploadProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Max file size in bytes */
	maxSize?: number
	/** Current avatar URL */
	value?: string | null
	/** Called when avatar is uploaded */
	onChange?: (url: string | null) => void
	/** Called when upload fails */
	onError?: (error: Error) => void
	/** Custom class name */
	className?: string
	/** Disabled state */
	disabled?: boolean
	/** Avatar size in pixels */
	size?: number
	/** Placeholder initials or name */
	placeholder?: string
}

/**
 * Circular avatar upload component
 *
 * @example
 * ```tsx
 * const { user, updateProfile } = useUser()
 *
 * <AvatarUpload
 *   value={user.avatarUrl}
 *   onChange={(url) => updateProfile({ avatarUrl: url })}
 *   placeholder={user.name}
 *   size={120}
 * />
 * ```
 */
export function AvatarUpload({
	theme = defaultTheme,
	maxSize = 2 * 1024 * 1024,
	value,
	onChange,
	onError,
	className,
	disabled = false,
	size = 96,
	placeholder = '',
}: AvatarUploadProps) {
	const [previewUrl, setPreviewUrl] = useState<string | null>(value || null)
	const inputRef = useRef<HTMLInputElement>(null)
	const { uploadAvatar, isUploading, uploadError } = useStorage()
	const styles = baseStyles(theme)

	useEffect(() => {
		setPreviewUrl(value || null)
	}, [value])

	useEffect(() => {
		injectGlobalStyles()
	}, [])

	const handleFile = async (file: File) => {
		// Validate file size
		if (maxSize && file.size > maxSize) {
			onError?.(new Error(`File size exceeds ${formatFileSize(maxSize)} limit`))
			return
		}

		// Validate file type
		if (!file.type.startsWith('image/')) {
			onError?.(new Error('Please upload an image file'))
			return
		}

		try {
			// Create local preview
			const localUrl = URL.createObjectURL(file)
			setPreviewUrl(localUrl)

			// Upload
			const url = await uploadAvatar(file)
			setPreviewUrl(url)
			onChange?.(url)

			// Cleanup local URL
			URL.revokeObjectURL(localUrl)
		} catch (err) {
			setPreviewUrl(value || null)
			onError?.(err instanceof Error ? err : new Error('Upload failed'))
		}
	}

	const handleClick = () => {
		if (!disabled && inputRef.current) {
			inputRef.current.click()
		}
	}

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (file) handleFile(file)
		if (inputRef.current) inputRef.current.value = ''
	}

	// Get initials from placeholder
	const initials = placeholder
		.split(' ')
		.map((n) => n[0])
		.join('')
		.toUpperCase()
		.slice(0, 2)

	const containerStyle: CSSProperties = {
		position: 'relative',
		width: size,
		height: size,
		borderRadius: '50%',
		overflow: 'hidden',
		cursor: disabled ? 'not-allowed' : 'pointer',
		opacity: disabled ? 0.6 : 1,
		flexShrink: 0,
	}

	const innerStyle: CSSProperties = {
		width: '100%',
		height: '100%',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: theme.colorMuted,
		color: theme.colorMutedForeground,
		fontSize: size * 0.35,
		fontWeight: 600,
	}

	return (
		<div className={className} style={{ fontFamily: theme.fontFamily }}>
			<div style={containerStyle} onClick={handleClick}>
				<input
					ref={inputRef}
					type="file"
					accept="image/*"
					onChange={handleInputChange}
					style={{ display: 'none' }}
					disabled={disabled}
				/>

				<div style={innerStyle}>
					{isUploading ? (
						<span style={styles.spinner} />
					) : previewUrl ? (
						<img
							src={previewUrl}
							alt="Avatar"
							style={{
								width: '100%',
								height: '100%',
								objectFit: 'cover',
							}}
						/>
					) : initials ? (
						initials
					) : (
						<UserIcon color={theme.colorMutedForeground} size={size * 0.4} />
					)}
				</div>

				{/* Hover overlay */}
				<div
					style={{
						position: 'absolute',
						inset: 0,
						backgroundColor: 'rgba(0, 0, 0, 0.5)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						opacity: 0,
						transition: 'opacity 0.2s ease',
						borderRadius: '50%',
					}}
					onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
					onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
				>
					<CameraIcon color="#fff" />
				</div>
			</div>

			{uploadError && (
				<p style={mergeStyles(styles.textXs, { color: theme.colorDestructive, marginTop: '0.5rem' })}>
					{uploadError.message}
				</p>
			)}
		</div>
	)
}

// ============================================
// Helper Components
// ============================================

function ProgressBar({ progress, theme }: { progress: number; theme: ThemeVariables }) {
	return (
		<div
			style={{
				width: '100%',
				height: '4px',
				backgroundColor: theme.colorMuted,
				borderRadius: '2px',
				marginTop: '0.5rem',
				overflow: 'hidden',
			}}
		>
			<div
				style={{
					width: `${progress}%`,
					height: '100%',
					backgroundColor: theme.colorPrimary,
					transition: 'width 0.2s ease',
				}}
			/>
		</div>
	)
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Icons
function UploadIcon({ color }: { color: string }) {
	return (
		<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
			<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
			<polyline points="17 8 12 3 7 8" />
			<line x1="12" y1="3" x2="12" y2="15" />
		</svg>
	)
}

function ImageIcon({ color }: { color: string }) {
	return (
		<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
			<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
			<circle cx="8.5" cy="8.5" r="1.5" />
			<polyline points="21 15 16 10 5 21" />
		</svg>
	)
}

function UserIcon({ color, size = 24 }: { color: string; size?: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
			<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
			<circle cx="12" cy="7" r="4" />
		</svg>
	)
}

function CameraIcon({ color }: { color: string }) {
	return (
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
			<path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
			<circle cx="12" cy="13" r="4" />
		</svg>
	)
}

function CloseIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	)
}
