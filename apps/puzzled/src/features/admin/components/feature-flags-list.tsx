'use client'

import { Clock, Crown, Flag, Shield, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { FeatureFlag } from '@/lib/db/schema'
import { EditFeatureFlagButton } from './feature-flag-editor'

export function FeatureFlagsList({ flags }: { flags: FeatureFlag[] }) {
	const t = useTranslations('admin.featureFlags')

	if (flags.length === 0) {
		return (
			<div className="admin-card p-12 text-center">
				<Flag className="mx-auto mb-4 h-12 w-12 text-[var(--admin-text-muted)]" />
				<h3 className="text-lg font-medium text-[var(--admin-text-primary)]">{t('noFlagsYet')}</h3>
				<p className="mt-1 text-sm text-[var(--admin-text-muted)]">{t('noFlagsHint')}</p>
			</div>
		)
	}

	return (
		<div className="space-y-4">
			{flags.map((flag, index) => (
				<FeatureFlagCard key={flag.id} flag={flag} delay={index} />
			))}
		</div>
	)
}

function FeatureFlagCard({ flag, delay = 0 }: { flag: FeatureFlag; delay?: number }) {
	const t = useTranslations('admin.featureFlags')

	const formatDate = (date: Date) => {
		return new Date(date).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		})
	}

	return (
		<div className="admin-card admin-animate-in" style={{ animationDelay: `${delay * 0.05}s` }}>
			{/* Header */}
			<div className="flex items-center justify-between border-b border-[var(--admin-border)] px-6 py-4">
				<div className="flex items-center gap-3">
					<h3 className="text-lg font-semibold text-[var(--admin-text-primary)]">{flag.name}</h3>
					<code className="rounded bg-[var(--admin-bg-surface)] px-2 py-0.5 font-mono text-xs text-[var(--admin-text-muted)]">
						{flag.key}
					</code>
					<span
						className={`admin-badge ${flag.enabled ? 'admin-badge-success' : 'admin-badge-default'}`}
					>
						{flag.enabled ? t('enabled') : t('disabled')}
					</span>
				</div>
				<EditFeatureFlagButton flag={flag} />
			</div>

			{/* Content */}
			<div className="p-6">
				{flag.description && (
					<p className="mb-4 text-sm text-[var(--admin-text-secondary)]">{flag.description}</p>
				)}

				{/* Rollout & Targeting */}
				<div className="flex flex-wrap gap-4 text-xs text-[var(--admin-text-muted)]">
					{/* Rollout Percentage */}
					<div className="flex items-center gap-2">
						<div className="flex items-center gap-1.5">
							<Users className="h-3.5 w-3.5" />
							<span>{t('rollout')}</span>
						</div>
						<div className="flex items-center gap-1">
							<div className="h-2 w-24 overflow-hidden rounded-full bg-[var(--admin-bg-base)]">
								<div
									className="h-full rounded-full bg-[var(--admin-accent)]"
									style={{ width: `${flag.rolloutPercentage}%` }}
								/>
							</div>
							<span className="font-medium text-[var(--admin-text-secondary)]">
								{flag.rolloutPercentage}%
							</span>
						</div>
					</div>

					{/* Targeting */}
					{flag.targetPremiumOnly && (
						<div className="flex items-center gap-1.5">
							<Crown className="h-3.5 w-3.5 text-amber-400" />
							<span>{t('premiumOnly')}</span>
						</div>
					)}

					{flag.targetAdminOnly && (
						<div className="flex items-center gap-1.5">
							<Shield className="h-3.5 w-3.5 text-purple-400" />
							<span>{t('adminOnly')}</span>
						</div>
					)}

					{/* Created */}
					<div className="flex items-center gap-1.5 ml-auto">
						<Clock className="h-3.5 w-3.5" />
						<span>Created {formatDate(flag.createdAt)}</span>
					</div>
				</div>
			</div>
		</div>
	)
}
