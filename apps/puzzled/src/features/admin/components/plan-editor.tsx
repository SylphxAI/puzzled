'use client'

import { Plus, Save, Trash2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCallback, useState } from 'react'
import type { Plan, PlanPrice } from '@/lib/db/schema'
import { trpc } from '@/trpc/client'
import {
	AdminDialog,
	AdminDialogBody,
	AdminDialogContent,
	AdminDialogFooter,
	AdminDialogHeader,
	AdminDialogTitle,
} from './admin-dialog'

type PlanWithPrices = Plan & { prices: PlanPrice[] }

type PlanFormData = {
	name: string
	slug: string
	description: string
	features: string[]
	isActive: boolean
	sortOrder: number
	prices: Array<{
		interval: 'monthly' | 'annual'
		amount: number
		currency: string
	}>
}

const emptyPlan: PlanFormData = {
	name: '',
	slug: '',
	description: '',
	features: [''],
	isActive: true,
	sortOrder: 0,
	prices: [
		{ interval: 'monthly', amount: 0, currency: 'usd' },
		{ interval: 'annual', amount: 0, currency: 'usd' },
	],
}

export function CreatePlanButton() {
	const t = useTranslations('admin.plans')
	const [isOpen, setIsOpen] = useState(false)

	return (
		<AdminDialog open={isOpen} onOpenChange={setIsOpen}>
			<button type="button" className="admin-btn admin-btn-primary" onClick={() => setIsOpen(true)}>
				<Plus className="h-4 w-4" />
				{t('createPlan')}
			</button>
			<PlanEditorModal onClose={() => setIsOpen(false)} />
		</AdminDialog>
	)
}

export function EditPlanButton({ plan }: { plan: PlanWithPrices }) {
	const t = useTranslations('admin.plans')
	const [isOpen, setIsOpen] = useState(false)

	return (
		<AdminDialog open={isOpen} onOpenChange={setIsOpen}>
			<button
				type="button"
				className="admin-btn admin-btn-ghost p-2"
				onClick={() => setIsOpen(true)}
				aria-label={t('editPlan', { name: plan.name })}
			>
				<span className="sr-only">{t('edit')}</span>
				Edit
			</button>
			<PlanEditorModal plan={plan} onClose={() => setIsOpen(false)} />
		</AdminDialog>
	)
}

function PlanEditorModal({ plan, onClose }: { plan?: PlanWithPrices; onClose: () => void }) {
	const t = useTranslations('admin.plans')
	const router = useRouter()
	const isEditing = !!plan

	const [formData, setFormData] = useState<PlanFormData>(() => {
		if (plan) {
			return {
				name: plan.name,
				slug: plan.slug,
				description: plan.description || '',
				features: (plan.features as string[]) || [''],
				isActive: plan.isActive,
				sortOrder: plan.sortOrder,
				prices: plan.prices.map((p) => ({
					interval: p.interval as 'monthly' | 'annual',
					amount: p.amount,
					currency: p.currency,
				})),
			}
		}
		return emptyPlan
	})

	const [confirmDelete, setConfirmDelete] = useState(false)

	const createMutation = trpc.admin.createPlan.useMutation({
		onSuccess: () => {
			router.refresh()
			onClose()
		},
	})

	const updateMutation = trpc.admin.updatePlan.useMutation({
		onSuccess: () => {
			router.refresh()
			onClose()
		},
	})

	const deleteMutation = trpc.admin.deletePlan.useMutation({
		onSuccess: () => {
			router.refresh()
			onClose()
		},
	})

	const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

	const handleSubmit = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault()

			const data = {
				...formData,
				features: formData.features.filter((f) => f.trim() !== ''),
			}

			if (isEditing && plan) {
				updateMutation.mutate({ planId: plan.id, ...data })
			} else {
				createMutation.mutate(data)
			}
		},
		[formData, isEditing, plan, createMutation, updateMutation],
	)

	const handleDelete = useCallback(() => {
		if (plan) {
			deleteMutation.mutate({ planId: plan.id })
		}
	}, [plan, deleteMutation])

	const updateField = <K extends keyof PlanFormData>(field: K, value: PlanFormData[K]) => {
		setFormData((prev) => ({ ...prev, [field]: value }))
	}

	const updateFeature = (index: number, value: string) => {
		setFormData((prev) => ({
			...prev,
			features: prev.features.map((f, i) => (i === index ? value : f)),
		}))
	}

	const addFeature = () => {
		setFormData((prev) => ({
			...prev,
			features: [...prev.features, ''],
		}))
	}

	const removeFeature = (index: number) => {
		setFormData((prev) => ({
			...prev,
			features: prev.features.filter((_, i) => i !== index),
		}))
	}

	const updatePrice = (interval: 'monthly' | 'annual', amount: number) => {
		setFormData((prev) => ({
			...prev,
			prices: prev.prices.map((p) => (p.interval === interval ? { ...p, amount } : p)),
		}))
	}

	return (
		<AdminDialogContent>
			<AdminDialogHeader>
				<AdminDialogTitle>
					{isEditing ? t('editPlanTitle', { name: plan.name }) : t('createPlanTitle')}
				</AdminDialogTitle>
			</AdminDialogHeader>

			<form onSubmit={handleSubmit}>
				<AdminDialogBody className="space-y-6">
					{/* Basic Info */}
					<div className="grid gap-4 md:grid-cols-2">
						<div>
							<label htmlFor="plan-name" className="admin-label">
								{t('planName')}
							</label>
							<input
								id="plan-name"
								type="text"
								value={formData.name}
								onChange={(e) => updateField('name', e.target.value)}
								className="admin-input w-full"
								required
							/>
						</div>
						<div>
							<label htmlFor="plan-slug" className="admin-label">
								{t('planSlug')}
							</label>
							<input
								id="plan-slug"
								type="text"
								value={formData.slug}
								onChange={(e) =>
									updateField('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))
								}
								className="admin-input w-full font-mono"
								pattern="[a-z0-9-]+"
								required
							/>
						</div>
					</div>

					<div>
						<label htmlFor="plan-description" className="admin-label">
							{t('planDescription')}
						</label>
						<textarea
							id="plan-description"
							value={formData.description}
							onChange={(e) => updateField('description', e.target.value)}
							className="admin-input w-full"
							rows={2}
						/>
					</div>

					{/* Features */}
					<div>
						<div className="mb-2 flex items-center justify-between">
							<span className="admin-label">{t('features')}</span>
							<button
								type="button"
								onClick={addFeature}
								className="admin-btn admin-btn-ghost text-xs"
							>
								<Plus className="h-3 w-3" />
								{t('addFeature')}
							</button>
						</div>
						<div className="space-y-2">
							{formData.features.map((feature, index) => (
								<div key={index} className="flex gap-2">
									<input
										type="text"
										value={feature}
										onChange={(e) => updateFeature(index, e.target.value)}
										className="admin-input flex-1"
										placeholder={t('featurePlaceholder')}
									/>
									{formData.features.length > 1 && (
										<button
											type="button"
											onClick={() => removeFeature(index)}
											className="admin-btn admin-btn-ghost p-2 text-[var(--admin-error)]"
											aria-label={t('removeFeature')}
										>
											<X className="h-4 w-4" />
										</button>
									)}
								</div>
							))}
						</div>
					</div>

					{/* Pricing */}
					<div>
						<span className="admin-label">{t('pricing')}</span>
						<div className="mt-2 grid gap-4 md:grid-cols-2">
							<div className="rounded-lg border border-[var(--admin-border)] p-4">
								<div className="mb-2 text-sm font-medium text-[var(--admin-text-muted)]">
									{t('monthly')}
								</div>
								<div className="flex items-center gap-2">
									<span className="text-[var(--admin-text-muted)]">$</span>
									<input
										type="number"
										min="0"
										step="0.01"
										value={
											(formData.prices.find((p) => p.interval === 'monthly')?.amount ?? 0) / 100
										}
										onChange={(e) =>
											updatePrice('monthly', Math.round(parseFloat(e.target.value || '0') * 100))
										}
										className="admin-input flex-1"
									/>
									<span className="text-sm text-[var(--admin-text-muted)]">/mo</span>
								</div>
							</div>
							<div className="rounded-lg border border-[var(--admin-border)] p-4">
								<div className="mb-2 text-sm font-medium text-[var(--admin-text-muted)]">
									{t('annual')}
								</div>
								<div className="flex items-center gap-2">
									<span className="text-[var(--admin-text-muted)]">$</span>
									<input
										type="number"
										min="0"
										step="0.01"
										value={
											(formData.prices.find((p) => p.interval === 'annual')?.amount ?? 0) / 100
										}
										onChange={(e) =>
											updatePrice('annual', Math.round(parseFloat(e.target.value || '0') * 100))
										}
										className="admin-input flex-1"
									/>
									<span className="text-sm text-[var(--admin-text-muted)]">/yr</span>
								</div>
							</div>
						</div>
					</div>

					{/* Status */}
					<div className="flex items-center gap-3">
						<label htmlFor="plan-active" className="admin-label mb-0">
							{t('active')}
						</label>
						<input
							id="plan-active"
							type="checkbox"
							checked={formData.isActive}
							onChange={(e) => updateField('isActive', e.target.checked)}
							className="admin-checkbox"
						/>
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
					{isEditing && plan.slug !== 'free' ? (
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
							{isEditing ? t('saveChanges') : t('createPlan')}
						</button>
					</div>
				</AdminDialogFooter>
			</form>
		</AdminDialogContent>
	)
}
