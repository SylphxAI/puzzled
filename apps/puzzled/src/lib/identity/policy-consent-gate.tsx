'use client'

import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Link } from '@/lib/i18n/routing'
import {
	hasCurrentPolicyConsent,
	isLegalPath,
	isPolicyConsentStatus,
	POLICY_ACCEPTANCE,
} from './policy-consent'

export function PolicyConsentGate({
	userId,
	children,
}: {
	userId: string | null
	children: ReactNode
}) {
	const pathname = usePathname()
	if (!userId || isLegalPath(pathname ?? '')) return children
	// A change of account or route must never reuse another request's clearance.
	return (
		<AccountConsent key={userId + ':' + pathname} userId={userId}>
			{children}
		</AccountConsent>
	)
}

function AccountConsent({ userId, children }: { userId: string; children: ReactNode }) {
	const t = useTranslations('auth')
	const [allowed, setAllowed] = useState(false)
	const [checked, setChecked] = useState(false)
	const [busy, setBusy] = useState(true)
	const [failed, setFailed] = useState(false)
	const alive = useRef(true)
	const inFlight = useRef(false)
	const dialog = useRef<HTMLDialogElement>(null)
	const request = useCallback(
		async (accept: boolean) => {
			if (inFlight.current) return
			inFlight.current = true
			setBusy(true)
			setFailed(false)
			try {
				const response = await fetch('/api/identity/policy-consent', {
					method: accept ? 'POST' : 'GET',
					credentials: 'same-origin',
					cache: 'no-store',
					...(accept
						? {
								headers: { 'content-type': 'application/json' },
								body: JSON.stringify(POLICY_ACCEPTANCE),
							}
						: {}),
				})
				const status: unknown = await response.json()
				if (!response.ok || !isPolicyConsentStatus(status, userId)) {
					throw new Error('policy_consent_unavailable')
				}
				if (alive.current) {
					setAllowed(hasCurrentPolicyConsent(status))
					if (accept && !hasCurrentPolicyConsent(status)) setFailed(true)
				}
			} catch {
				if (alive.current) {
					setAllowed(false)
					setFailed(true)
				}
			} finally {
				inFlight.current = false
				if (alive.current) setBusy(false)
			}
		},
		[userId],
	)
	useEffect(() => {
		alive.current = true
		void request(false)
		return () => {
			alive.current = false
		}
	}, [request])
	useEffect(() => {
		if (!allowed && dialog.current && !dialog.current.open) {
			if (typeof dialog.current.showModal === 'function') dialog.current.showModal()
			else dialog.current.setAttribute('open', '')
		}
	}, [allowed])
	if (allowed) return children
	return (
		<dialog
			ref={dialog}
			aria-modal="true"
			aria-labelledby="policy-update-title"
			onCancel={(event) => event.preventDefault()}
			className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border bg-background p-6 text-foreground shadow-xl backdrop:bg-black/60"
		>
			<form
				onSubmit={(event) => {
					event.preventDefault()
					if (checked && !busy) void request(true)
				}}
				className="space-y-5"
			>
				<h2 id="policy-update-title" className="text-2xl font-bold">
					{t('policyUpdateTitle')}
				</h2>
				<p>{t('policyUpdateSummary')}</p>
				<p className="flex gap-4">
					<Link href="/terms" className="underline">
						{t('termsOfService')}
					</Link>
					<Link href="/privacy" className="underline">
						{t('privacyPolicy')}
					</Link>
				</p>
				<label className="flex min-h-12 items-start gap-3">
					<input
						type="checkbox"
						checked={checked}
						disabled={busy}
						onChange={(event) => setChecked(event.target.checked)}
						className="mt-1 size-5 accent-primary"
					/>
					<span>{t('policyUpdateAgree')}</span>
				</label>
				{failed && <p role="alert">{t('policyUpdateError')}</p>}
				<button
					type="submit"
					disabled={busy || !checked}
					className="min-h-12 w-full rounded-xl bg-primary px-4 font-bold text-primary-foreground disabled:opacity-50"
				>
					{busy ? t('policyUpdateLoading') : t('policyUpdateContinue')}
				</button>
				{failed && (
					<button
						type="button"
						disabled={busy}
						onClick={() => void request(false)}
						className="min-h-12 w-full underline"
					>
						{t('policyUpdateRetry')}
					</button>
				)}
			</form>
		</dialog>
	)
}
