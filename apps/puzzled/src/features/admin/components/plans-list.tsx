'use client'

import { Check, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { Plan, PlanPrice } from '@/lib/db/schema'
import { trpc } from '@/trpc/client'
import { EditPlanButton } from './plan-editor'

type PlanWithPrices = Plan & { prices: PlanPrice[] }

export function PlansList({ plans }: { plans: PlanWithPrices[] }) {
	return (
		<div className="space-y-4">
			{plans.map((plan, index) => (
				<PlanCard key={plan.id} plan={plan} delay={index} />
			))}
		</div>
	)
}

function PlanCard({ plan, delay = 0 }: { plan: PlanWithPrices; delay?: number }) {
	const t = useTranslations('admin.plans')
	const router = useRouter()

	const syncMutation = trpc.admin.syncPlan.useMutation({
		onSuccess: () => {
			router.refresh()
		},
	})

	return (
		<div className="admin-card admin-animate-in" style={{ animationDelay: `${delay * 0.05}s` }}>
			{/* Header */}
			<div className="admin-card-header flex items-center justify-between px-6 py-4">
				<div className="flex items-center gap-3">
					<h3 className="text-lg font-semibold text-[var(--admin-text-primary)]">{plan.name}</h3>
					<span
						className={`admin-badge ${plan.isActive ? 'admin-badge-success' : 'admin-badge-default'}`}
					>
						{plan.isActive ? t('active') : t('inactive')}
					</span>
					{plan.stripeProductId && (
						<span className="admin-badge admin-badge-accent">{t('stripeSynced')}</span>
					)}
				</div>
				<div className="flex flex-col items-end gap-1">
					<div className="flex items-center gap-2">
						{plan.slug !== 'free' && (
							<button
								type="button"
								className="admin-btn admin-btn-ghost"
								onClick={() => syncMutation.mutate({ planId: plan.id })}
								disabled={syncMutation.isPending}
							>
								<RefreshCw
									className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`}
									aria-hidden="true"
								/>
								{t('syncToStripe')}
							</button>
						)}
						<EditPlanButton plan={plan} />
					</div>
					{syncMutation.error && (
						<span className="text-xs text-[var(--admin-error)]">{syncMutation.error.message}</span>
					)}
				</div>
			</div>

			{/* Content */}
			<div className="grid gap-6 p-6 lg:grid-cols-2">
				{/* Details */}
				<div className="space-y-4">
					<div>
						<div className="text-sm font-medium text-[var(--admin-text-muted)]">Slug</div>
						<div className="font-mono text-sm text-[var(--admin-text-primary)]">{plan.slug}</div>
					</div>
					<div>
						<div className="text-sm font-medium text-[var(--admin-text-muted)]">Description</div>
						<div className="text-sm text-[var(--admin-text-secondary)]">
							{plan.description || '-'}
						</div>
					</div>
					{plan.stripeProductId && (
						<div>
							<div className="text-sm font-medium text-[var(--admin-text-muted)]">
								Stripe Product ID
							</div>
							<div className="font-mono text-sm text-[var(--admin-text-secondary)]">
								{plan.stripeProductId}
							</div>
						</div>
					)}
				</div>

				{/* Features */}
				<div>
					<div className="mb-2 text-sm font-medium text-[var(--admin-text-muted)]">
						{t('features')}
					</div>
					<ul className="space-y-1">
						{(plan.features as string[]).map((feature, i) => (
							<li
								key={i}
								className="flex items-center gap-2 text-sm text-[var(--admin-text-secondary)]"
							>
								<Check className="h-4 w-4 text-[var(--admin-accent)]" aria-hidden="true" />
								{feature}
							</li>
						))}
					</ul>
				</div>
			</div>

			{/* Prices */}
			{plan.prices.length > 0 && (
				<div className="border-t border-[var(--admin-border)] px-6 py-4">
					<div className="mb-3 text-sm font-medium text-[var(--admin-text-muted)]">Prices</div>
					<div className="flex flex-wrap gap-3">
						{plan.prices.map((price) => (
							<PriceTag key={price.id} price={price} />
						))}
					</div>
				</div>
			)}
		</div>
	)
}

function PriceTag({ price }: { price: PlanPrice }) {
	const t = useTranslations('admin.plans')

	const formatPrice = (amount: number, currency: string) => {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: currency.toUpperCase(),
		}).format(amount / 100)
	}

	return (
		<div className="flex items-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg-surface)] px-3 py-2">
			<div>
				<div className="font-semibold text-[var(--admin-text-primary)]">
					{formatPrice(price.amount, price.currency)}
					<span className="text-sm font-normal text-[var(--admin-text-muted)]">
						/{price.interval}
					</span>
				</div>
				{price.stripePriceId ? (
					<div className="font-mono text-xs text-[var(--admin-text-muted)]">
						{price.stripePriceId}
					</div>
				) : (
					<div className="text-xs text-[var(--admin-warning)]">{t('notSynced')}</div>
				)}
			</div>
		</div>
	)
}
