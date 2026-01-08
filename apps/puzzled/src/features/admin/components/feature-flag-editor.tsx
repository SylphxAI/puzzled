'use client'

import { Plus, Save, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCallback, useState } from 'react'
import type { FeatureFlag } from '@/lib/db/schema'
import { trpc } from '@/trpc/client'
import {
	AdminDialog,
	AdminDialogBody,
	AdminDialogContent,
	AdminDialogFooter,
	AdminDialogHeader,
	AdminDialogTitle,
} from './admin-dialog'

type FeatureFlagFormData = {
	key: string
	name: string
	description: string
	enabled: boolean
	rolloutPercentage: number
	targetPremiumOnly: boolean
	targetAdminOnly: boolean
}

const emptyFlag: FeatureFlagFormData = {
	key: '',
	name: '',
	description: '',
	enabled: false,
	rolloutPercentage: 0,
	targetPremiumOnly: false,
	targetAdminOnly: false,
}

export function CreateFeatureFlagButton() {
	const t = useTranslations('admin.featureFlags')
	const [isOpen, setIsOpen] = useState(false)

	return (
		<AdminDialog open={isOpen} onOpenChange={setIsOpen}>
			<button type="button" className="admin-btn admin-btn-primary" onClick={() => setIsOpen(true)}>
				<Plus className="h-4 w-4" />
				{t('create')}
			</button>
			<FeatureFlagEditorModal onClose={() => setIsOpen(false)} />
		</AdminDialog>
	)
}

export function EditFeatureFlagButton({ flag }: { flag: FeatureFlag }) {
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
			<FeatureFlagEditorModal flag={flag} onClose={() => setIsOpen(false)} />
		</AdminDialog>
	)
}

function FeatureFlagEditorModal({ flag, onClose }: { flag?: FeatureFlag; onClose: () => void }) {
	const t = useTranslations('admin.featureFlags')
	const router = useRouter()
	const isEditing = !!flag

	const [formData, setFormData] = useState<FeatureFlagFormData>(() => {
		if (flag) {
			return {
				key: flag.key,
				name: flag.name,
				description: flag.description || '',
				enabled: flag.enabled,
				rolloutPercentage: flag.rolloutPercentage,
				targetPremiumOnly: flag.targetPremiumOnly,
				targetAdminOnly: flag.targetAdminOnly,
			}
		}
		return emptyFlag
	})

	const [confirmDelete, setConfirmDelete] = useState(false)

	const createMutation = trpc.admin.createFeatureFlag.useMutation({
		onSuccess: () => {
			router.refresh()
			onClose()
		},
	})

	const updateMutation = trpc.admin.updateFeatureFlag.useMutation({
		onSuccess: () => {
			router.refresh()
			onClose()
		},
	})

	const deleteMutation = trpc.admin.deleteFeatureFlag.useMutation({
		onSuccess: () => {
			router.refresh()
			onClose()
		},
	})

	const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

	const handleSubmit = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault()

			if (isEditing && flag) {
				updateMutation.mutate({ flagId: flag.id, ...formData })
			} else {
				createMutation.mutate(formData)
			}
		},
		[formData, isEditing, flag, createMutation, updateMutation],
	)

	const handleDelete = useCallback(() => {
		if (flag) {
			deleteMutation.mutate({ flagId: flag.id })
		}
	}, [flag, deleteMutation])

	const updateField = <K extends keyof FeatureFlagFormData>(
		field: K,
		value: FeatureFlagFormData[K],
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
					<div className="grid gap-4 md:grid-cols-2">
						<div>
							<label htmlFor="key" className="admin-label">
								{t('key')}
							</label>
							<input
								id="key"
								type="text"
								value={formData.key}
								onChange={(e) =>
									updateField('key', e.target.value.toLowerCase().replace(/\s+/g, '_'))
								}
								className="admin-input w-full font-mono"
								pattern="[a-z0-9_]+"
								placeholder="new_feature"
								required
								disabled={isEditing}
							/>
						</div>
						<div>
							<label htmlFor="name" className="admin-label">
								{t('name')}
							</label>
							<input
								id="name"
								type="text"
								value={formData.name}
								onChange={(e) => updateField('name', e.target.value)}
								className="admin-input w-full"
								placeholder="New Feature"
								required
							/>
						</div>
					</div>

					<div>
						<label htmlFor="description" className="admin-label">
							{t('description')}
						</label>
						<textarea
							id="description"
							value={formData.description}
							onChange={(e) => updateField('description', e.target.value)}
							className="admin-input w-full"
							rows={2}
						/>
					</div>

					{/* Enabled toggle */}
					<div className="flex items-center gap-3">
						<input
							id="enabled"
							type="checkbox"
							checked={formData.enabled}
							onChange={(e) => updateField('enabled', e.target.checked)}
							className="admin-checkbox"
						/>
						<label htmlFor="enabled" className="admin-label mb-0">
							{t('enabled')}
						</label>
					</div>

					{/* Rollout percentage */}
					<div>
						<label htmlFor="rollout" className="admin-label">
							{t('rolloutPercentage')}: {formData.rolloutPercentage}%
						</label>
						<input
							id="rollout"
							type="range"
							min="0"
							max="100"
							value={formData.rolloutPercentage}
							onChange={(e) => updateField('rolloutPercentage', parseInt(e.target.value, 10))}
							className="w-full"
						/>
						<div className="mt-1 flex justify-between text-xs text-[var(--admin-text-muted)]">
							<span>0%</span>
							<span>50%</span>
							<span>100%</span>
						</div>
					</div>

					{/* Target options */}
					<div className="space-y-3">
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

						<div className="flex items-center gap-3">
							<input
								id="targetAdminOnly"
								type="checkbox"
								checked={formData.targetAdminOnly}
								onChange={(e) => updateField('targetAdminOnly', e.target.checked)}
								className="admin-checkbox"
							/>
							<label htmlFor="targetAdminOnly" className="admin-label mb-0">
								{t('adminOnly')}
							</label>
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
