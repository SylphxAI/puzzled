'use client'

import { AlertTriangle, CheckCircle, Shield } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useSession } from '@/features/auth'

type SecurityCheckItem = {
	label: string
	status: 'pass' | 'warning'
	description?: string
}

export function SecurityCheckup() {
	const t = useTranslations('settings.securityScore')
	const { data: session } = useSession()

	if (!session?.user) return null

	const user = session.user

	// Check security status
	const checks: SecurityCheckItem[] = [
		{
			label: t('checks.emailVerified'),
			status: user.emailVerified ? 'pass' : 'warning',
			description: user.emailVerified ? undefined : t('checks.verifyEmail'),
		},
		{
			label: t('checks.twoFactor'),
			status: user.twoFactorEnabled ? 'pass' : 'warning',
			description: user.twoFactorEnabled ? undefined : t('checks.enableTwoFactor'),
		},
	]

	// Calculate security score
	const passCount = checks.filter((c) => c.status === 'pass').length
	const totalChecks = checks.length
	const percentage = Math.round((passCount / totalChecks) * 100)

	let scoreLabel: string
	let scoreColor: string

	if (percentage === 100) {
		scoreLabel = t('levels.excellent')
		scoreColor = 'text-green-600 dark:text-green-400'
	} else if (percentage >= 50) {
		scoreLabel = t('levels.good')
		scoreColor = 'text-yellow-600 dark:text-yellow-400'
	} else {
		scoreLabel = t('levels.needsWork')
		scoreColor = 'text-red-600 dark:text-red-400'
	}

	return (
		<div className="space-y-4">
			{/* Security Score */}
			<div className="flex items-center gap-4">
				<div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
					<Shield className="h-8 w-8 text-primary" />
				</div>
				<div>
					<p className="text-sm text-muted-foreground">{t('score')}</p>
					<p className={`text-2xl font-bold ${scoreColor}`}>{scoreLabel}</p>
					<p className="text-sm text-muted-foreground">
						{t('points', { points: passCount * 50 })}{' '}
						{t('totalPoints', { total: totalChecks * 50 })}
					</p>
				</div>
			</div>

			{/* Security Checks */}
			<div className="space-y-2">
				{checks.map((check, index) => (
					<div key={index} className="flex items-start gap-3 rounded-lg border p-3">
						{check.status === 'pass' ? (
							<CheckCircle className="h-5 w-5 flex-shrink-0 text-green-500" />
						) : (
							<AlertTriangle className="h-5 w-5 flex-shrink-0 text-yellow-500" />
						)}
						<div className="flex-1">
							<p className="font-medium">{check.label}</p>
							{check.description && (
								<p className="text-sm text-muted-foreground">{check.description}</p>
							)}
						</div>
					</div>
				))}
			</div>
		</div>
	)
}
