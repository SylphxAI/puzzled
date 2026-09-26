'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { joinFamily } from '@/lib/connect/billing-client'
import { useRouter } from '@/lib/i18n/routing'

const ERROR_CODES = [
	'invite_not_found',
	'family_full',
	'family_plan_inactive',
	'already_in_family',
	'family_owner',
] as const

/** Joins the family plan the invite code names, then opens Settings. */
export function JoinFamilyButton({ code }: { code: string }) {
	const t = useTranslations('plus.family')
	const router = useRouter()
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	return (
		<div className="space-y-2">
			<button
				type="button"
				disabled={busy || !code}
				className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-60"
				onClick={async () => {
					setBusy(true)
					setError(null)
					try {
						await joinFamily(code)
						router.push('/settings/subscription')
					} catch (err) {
						const text = err instanceof Error ? err.message : ''
						const known = ERROR_CODES.find((c) => text.includes(c))
						setError(t(`errors.${known ?? 'invite_not_found'}`))
						setBusy(false)
					}
				}}
			>
				{t('join')}
			</button>
			{error || !code ? (
				<p role="alert" className="text-sm text-destructive">
					{error ?? t('errors.invite_not_found')}
				</p>
			) : null}
		</div>
	)
}
