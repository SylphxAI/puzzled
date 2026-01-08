'use client'

import { Camera, Trash2, Upload, X } from 'lucide-react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useCallback, useRef, useState } from 'react'
import { FILE_LIMITS } from '@/lib/config/validation'
import { cn } from '@/lib/utils'
import { Button } from '@sylphx/ui'
import { useToast } from '@sylphx/ui'

type AvatarUploadProps = {
	currentImage: string | null
	userName: string | null
	userEmail: string
	onUploadComplete?: (imageUrl: string | null) => void
}

export function AvatarUpload({
	currentImage,
	userName,
	userEmail,
	onUploadComplete,
}: AvatarUploadProps) {
	const t = useTranslations('settings.profile.avatarUpload')
	const fileInputRef = useRef<HTMLInputElement>(null)
	const [uploading, setUploading] = useState(false)
	const [removing, setRemoving] = useState(false)
	const [uploadProgress, setUploadProgress] = useState(0)
	const [preview, setPreview] = useState<string | null>(null)
	const [isDragOver, setIsDragOver] = useState(false)
	const toast = useToast()

	const initials = userName?.charAt(0) || userEmail.charAt(0) || '?'

	const validateFile = useCallback(
		(file: File): string | null => {
			if (
				!FILE_LIMITS.AVATAR_ALLOWED_TYPES.includes(
					file.type as (typeof FILE_LIMITS.AVATAR_ALLOWED_TYPES)[number],
				)
			) {
				return t('invalidFileType')
			}
			if (file.size > FILE_LIMITS.AVATAR_MAX_SIZE) {
				return t('fileTooLarge')
			}
			return null
		},
		[t],
	)

	const createPreview = useCallback((file: File) => {
		const reader = new FileReader()
		reader.onload = (e) => {
			setPreview(e.target?.result as string)
		}
		reader.readAsDataURL(file)
	}, [])

	const clearPreview = useCallback(() => {
		setPreview(null)
		if (fileInputRef.current) {
			fileInputRef.current.value = ''
		}
	}, [])

	const uploadFile = useCallback(
		async (file: File) => {
			const error = validateFile(file)
			if (error) {
				toast.error(t('invalidFile'), error)
				return
			}

			createPreview(file)
			setUploading(true)
			setUploadProgress(0)

			try {
				const formData = new FormData()
				formData.append('file', file)

				// Use XMLHttpRequest for progress tracking
				const xhr = new XMLHttpRequest()

				const uploadPromise = new Promise<{ success: boolean; imageUrl?: string; error?: string }>(
					(resolve, reject) => {
						xhr.upload.addEventListener('progress', (e) => {
							if (e.lengthComputable) {
								const progress = Math.round((e.loaded / e.total) * 100)
								setUploadProgress(progress)
							}
						})

						xhr.addEventListener('load', () => {
							if (xhr.status >= 200 && xhr.status < 300) {
								try {
									resolve(JSON.parse(xhr.responseText))
								} catch {
									reject(new Error(t('uploadFailed')))
								}
							} else {
								try {
									const errorData = JSON.parse(xhr.responseText)
									reject(new Error(errorData.error || t('uploadFailed')))
								} catch {
									reject(new Error(t('uploadFailed')))
								}
							}
						})

						xhr.addEventListener('error', () => {
							reject(new Error(t('networkError')))
						})

						xhr.open('POST', '/api/upload/avatar')
						xhr.send(formData)
					},
				)

				const data = await uploadPromise

				if (data.success && data.imageUrl) {
					onUploadComplete?.(data.imageUrl)
					toast.success(t('avatarUpdated'), t('avatarUpdatedDescription'))
					clearPreview()
				} else {
					throw new Error(data.error || t('uploadFailed'))
				}
			} catch (error) {
				toast.error(t('uploadFailed'), error instanceof Error ? error.message : t('tryAgain'))
				clearPreview()
			} finally {
				setUploading(false)
				setUploadProgress(0)
			}
		},
		[validateFile, createPreview, clearPreview, onUploadComplete, toast, t],
	)

	const handleFileSelect = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0]
			if (file) {
				uploadFile(file)
			}
		},
		[uploadFile],
	)

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault()
		e.stopPropagation()
		setIsDragOver(true)
	}, [])

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault()
		e.stopPropagation()
		setIsDragOver(false)
	}, [])

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault()
			e.stopPropagation()
			setIsDragOver(false)

			const file = e.dataTransfer.files[0]
			if (file) {
				uploadFile(file)
			}
		},
		[uploadFile],
	)

	const handleRemoveAvatar = useCallback(async () => {
		if (!currentImage) return

		setRemoving(true)

		try {
			const response = await fetch('/api/upload/avatar', {
				method: 'DELETE',
			})

			const data = await response.json()

			if (!response.ok) {
				throw new Error(data.error || t('removeFailed'))
			}

			onUploadComplete?.(null)
			toast.success(t('avatarRemoved'), t('avatarRemovedDescription'))
		} catch (error) {
			toast.error(t('removeFailed'), error instanceof Error ? error.message : t('tryAgain'))
		} finally {
			setRemoving(false)
		}
	}, [currentImage, onUploadComplete, toast, t])

	const displayImage = preview || currentImage
	const isProcessing = uploading || removing

	return (
		<div className="flex flex-col gap-4 sm:flex-row sm:items-start">
			{/* Avatar with drag-and-drop zone */}
			<div
				className={cn(
					'relative rounded-full transition-all',
					isDragOver && 'ring-4 ring-primary ring-offset-2',
				)}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
			>
				{/* Avatar Display */}
				{displayImage ? (
					<Image
						src={displayImage}
						alt={`${userName || 'User'}'s profile picture`}
						width={100}
						height={100}
						className="h-[100px] w-[100px] rounded-full object-cover"
					/>
				) : (
					<div className="flex h-[100px] w-[100px] items-center justify-center rounded-full bg-primary text-4xl font-bold text-primary-foreground">
						{initials.toUpperCase()}
					</div>
				)}

				{/* Upload Progress Overlay */}
				{uploading && (
					<div className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/60">
						<div className="text-sm font-medium text-white">{uploadProgress}%</div>
						<div className="mt-1 h-1.5 w-16 overflow-hidden rounded-full bg-white/30">
							<div
								className="h-full bg-white transition-all duration-300"
								style={{ width: `${uploadProgress}%` }}
							/>
						</div>
					</div>
				)}

				{/* Upload Button Overlay (shown on hover when not processing) */}
				{!isProcessing && (
					<button
						type="button"
						onClick={() => fileInputRef.current?.click()}
						className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity hover:opacity-100"
						aria-label={t('changeAvatar')}
					>
						<Camera className="h-8 w-8 text-white" />
					</button>
				)}

				{/* Preview Cancel Button */}
				{preview && !uploading && (
					<button
						type="button"
						onClick={clearPreview}
						className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white shadow-md transition-transform hover:scale-110"
						aria-label={t('cancelPreview')}
					>
						<X className="h-4 w-4" />
					</button>
				)}
			</div>

			{/* Hidden file input */}
			<input
				ref={fileInputRef}
				type="file"
				accept={FILE_LIMITS.AVATAR_ALLOWED_TYPES.join(',')}
				onChange={handleFileSelect}
				className="hidden"
				aria-label={t('uploadAvatarFile')}
			/>

			{/* Actions */}
			<div className="flex flex-col gap-2">
				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						variant="outline"
						onClick={() => fileInputRef.current?.click()}
						disabled={isProcessing}
					>
						<Upload className="mr-2 h-4 w-4" />
						{uploading ? t('uploading', { progress: uploadProgress }) : t('uploadPhoto')}
					</Button>

					{currentImage && !preview && (
						<Button
							type="button"
							variant="ghost"
							onClick={handleRemoveAvatar}
							disabled={isProcessing}
							className="text-destructive hover:bg-destructive/10 hover:text-destructive"
						>
							<Trash2 className="mr-2 h-4 w-4" />
							{removing ? t('removing') : t('remove')}
						</Button>
					)}
				</div>

				<p className="text-xs text-muted-foreground">
					{t('allowedFormats')}
					<br />
					{t('dragDropHint')}
				</p>
			</div>
		</div>
	)
}
