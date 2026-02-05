'use client'

import { Plus, Save, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCallback, useState } from 'react'
import {
	useCreateAnnouncement,
	useDeleteAnnouncement,
	useUpdateAnnouncement,
} from '@/lib/api'
import type { Announcement, AnnouncementType } from '@/lib/db/schema'
import {
	AdminDialog,
	AdminDialogBody,
	AdminDialogContent,
	AdminDialogFooter,
	AdminDialogHeader,
	AdminDialogTitle,
} from './admin-dialog'

type AnnouncementFormData = {
	title: string
	content: string
	type: AnnouncementType
	isActive: boolean
	targetAllUsers: boolean
	targetPremiumOnly: boolean
	dismissible: boolean
	showOnce: boolean
	startsAt: string
	endsAt: string
}

const emptyAnnouncement: AnnouncementFormData = {
	title: '',
	content: '',
	type: 'info',
	isActive: true,
	targetAllUsers: true,
	targetPremiumOnly: false,
	dismissible: true,
	showOnce: false,
	startsAt: '',
	endsAt: '',
}

export function CreateAnnouncementButton() {
	const t = useTranslations('admin.announcements')
	const [isOpen, setIsOpen] = useState(false)

	return (
		<AdminDialog open={isOpen} onOpenChange={setIsOpen}>
			<button type="button" className="admin-btn admin-btn-primary" onClick={() => setIsOpen(true)}>
				<Plus className="h-4 w-4" />
				{t('create')}
			</button>
			<AnnouncementEditorModal onClose={() => setIsOpen(false)} />
		</AdminDialog>
	)
}

export function EditAnnouncementButton({ announcement }: { announcement: Announcement }) {
	const [isOpen, setIsOpen] = useState(false)

	return (
		<AdminDialog open={isOpen} onOpenChange={setIsOpen}>
			<button
				type="button"
				className="admin-btn admin-btn-ghost p-2"
				onClick={() => setIsOpen(true)}
			>
				Edit
			</button>
			<AnnouncementEditorModal announcement={announcement} onClose={() => setIsOpen(false)} />
		</AdminDialog>
	)
}

function AnnouncementEditorModal({
	announcement,
	onClose,
}: {
	announcement?: Announcement
	onClose: () => void
}) {
	const t = useTranslations('admin.announcements')
	const router = useRouter()
	const isEditing = !!announcement

	const [formData, setFormData] = useState<AnnouncementFormData>(() => {
		if (announcement) {
			return {
				title: announcement.title,
				content: announcement.content,
				type: announcement.type,
				isActive: announcement.isActive,
				targetAllUsers: announcement.targetAllUsers,
				targetPremiumOnly: announcement.targetPremiumOnly,
				dismissible: announcement.dismissible,
				showOnce: announcement.showOnce,
				startsAt: announcement.startsAt?.toISOString().slice(0, 16) || '',
				endsAt: announcement.endsAt?.toISOString().slice(0, 16) || '',
			}
		}
		return emptyAnnouncement
	})

	const [confirmDelete, setConfirmDelete] = useState(false)

	const createMutation = useCreateAnnouncement()
	const updateMutation = useUpdateAnnouncement()
	const deleteMutation = useDeleteAnnouncement()

	const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

	const handleSubmit = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault()

			const data = {
				...formData,
				startsAt: formData.startsAt ? new Date(formData.startsAt).toISOString() : undefined,
				endsAt: formData.endsAt ? new Date(formData.endsAt).toISOString() : undefined,
			}

			const onSuccess = () => {
				router.refresh()
				onClose()
			}

			if (isEditing && announcement) {
				updateMutation.mutate({ id: announcement.id, ...data }, { onSuccess })
			} else {
				createMutation.mutate(data, { onSuccess })
			}
		},
		[formData, isEditing, announcement, createMutation, updateMutation, router, onClose],
	)

	const handleDelete = useCallback(() => {
		if (announcement) {
			deleteMutation.mutate(
				{ id: announcement.id },
				{
					onSuccess: () => {
						router.refresh()
						onClose()
					},
				},
			)
		}
	}, [announcement, deleteMutation, router, onClose])

	const updateField = <K extends keyof AnnouncementFormData>(
		field: K,
		value: AnnouncementFormData[K],
	) => {
		setFormData((prev) => ({ ...prev, [field]: value }))
	}

	return (
		<AdminDialogContent>
			<AdminDialogHeader>
				<AdminDialogTitle>{isEditing ? t('editTitle') : t('createTitle')}</AdminDialogTitle>
			</AdminDialogHeader>

			<form onSubmit={handleSubmit}>
				<AdminDialogBody className="space-y-6">
					<div>
						<label htmlFor="title" className="admin-label">
							{t('title')}
						</label>
						<input
							id="title"
							type="text"
							value={formData.title}
							onChange={(e) => updateField('title', e.target.value)}
							className="admin-input w-full"
							required
						/>
					</div>

					<div>
						<label htmlFor="content" className="admin-label">
							{t('content')}
						</label>
						<textarea
							id="content"
							value={formData.content}
							onChange={(e) => updateField('content', e.target.value)}
							className="admin-input w-full"
							rows={4}
							required
						/>
					</div>

					<div className="grid gap-4 md:grid-cols-2">
						<div>
							<label htmlFor="type" className="admin-label">
								{t('type')}
							</label>
							<select
								id="type"
								value={formData.type}
								onChange={(e) => updateField('type', e.target.value as AnnouncementType)}
								className="admin-select w-full"
							>
								<option value="info">{t('typeInfo')}</option>
								<option value="warning">{t('typeWarning')}</option>
								<option value="success">{t('typeSuccess')}</option>
								<option value="maintenance">{t('typeMaintenance')}</option>
							</select>
						</div>
					</div>

					{/* Toggles */}
					<div className="space-y-3">
						<div className="flex items-center gap-3">
							<input
								id="isActive"
								type="checkbox"
								checked={formData.isActive}
								onChange={(e) => updateField('isActive', e.target.checked)}
								className="admin-checkbox"
							/>
							<label htmlFor="isActive" className="admin-label mb-0">
								{t('active')}
							</label>
						</div>

						<div className="flex items-center gap-3">
							<input
								id="dismissible"
								type="checkbox"
								checked={formData.dismissible}
								onChange={(e) => updateField('dismissible', e.target.checked)}
								className="admin-checkbox"
							/>
							<label htmlFor="dismissible" className="admin-label mb-0">
								{t('dismissible')}
							</label>
						</div>

						<div className="flex items-center gap-3">
							<input
								id="showOnce"
								type="checkbox"
								checked={formData.showOnce}
								onChange={(e) => updateField('showOnce', e.target.checked)}
								className="admin-checkbox"
							/>
							<label htmlFor="showOnce" className="admin-label mb-0">
								{t('showOnce')}
							</label>
						</div>

						<div className="flex items-center gap-3">
							<input
								id="targetPremiumOnly"
								type="checkbox"
								checked={formData.targetPremiumOnly}
								onChange={(e) => updateField('targetPremiumOnly', e.target.checked)}
								className="admin-checkbox"
							/>
							<label htmlFor="targetPremiumOnly" className="admin-label mb-0">
								{t('premiumOnly')}
							</label>
						</div>
					</div>

					{/* Scheduling */}
					<div className="grid gap-4 md:grid-cols-2">
						<div>
							<label htmlFor="startsAt" className="admin-label">
								{t('startsAt')}
							</label>
							<input
								id="startsAt"
								type="datetime-local"
								value={formData.startsAt}
								onChange={(e) => updateField('startsAt', e.target.value)}
								className="admin-input w-full"
							/>
						</div>
						<div>
							<label htmlFor="endsAt" className="admin-label">
								{t('endsAt')}
							</label>
							<input
								id="endsAt"
								type="datetime-local"
								value={formData.endsAt}
								onChange={(e) => updateField('endsAt', e.target.value)}
								className="admin-input w-full"
							/>
						</div>
					</div>

					{/* Error display */}
					{(createMutation.error || updateMutation.error || deleteMutation.error) && (
						<div className="rounded-lg border border-[var(--admin-error)]/30 bg-[var(--admin-error)]/10 p-3 text-sm text-[var(--admin-error)]">
							{createMutation.error?.message ||
								updateMutation.error?.message ||
								deleteMutation.error?.message}
						</div>
					)}
				</AdminDialogBody>

				<AdminDialogFooter>
					{isEditing ? (
						confirmDelete ? (
							<div className="flex items-center gap-2">
								<span className="text-sm text-[var(--admin-error)]">{t('confirmDelete')}</span>
								<button
									type="button"
									onClick={handleDelete}
									className="admin-btn bg-[var(--admin-error)] text-white hover:bg-[var(--admin-error)]/90"
									disabled={isPending}
								>
									{t('deleteConfirm')}
								</button>
								<button
									type="button"
									onClick={() => setConfirmDelete(false)}
									className="admin-btn admin-btn-ghost"
								>
									{t('cancel')}
								</button>
							</div>
						) : (
							<button
								type="button"
								onClick={() => setConfirmDelete(true)}
								className="admin-btn admin-btn-ghost text-[var(--admin-error)]"
							>
								<Trash2 className="h-4 w-4" />
								{t('delete')}
							</button>
						)
					) : (
						<div />
					)}

					<div className="flex gap-2">
						<button
							type="button"
							onClick={onClose}
							className="admin-btn admin-btn-ghost"
							disabled={isPending}
						>
							{t('cancel')}
						</button>
						<button type="submit" className="admin-btn admin-btn-primary" disabled={isPending}>
							<Save className="h-4 w-4" />
							{isEditing ? t('save') : t('create')}
						</button>
					</div>
				</AdminDialogFooter>
			</form>
		</AdminDialogContent>
	)
}
