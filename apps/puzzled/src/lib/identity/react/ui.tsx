'use client'

/**
 * Browser identity chrome - settings/consent UI (TD-11 split of react.tsx).
 */

import { useTranslations } from 'next-intl'
import { type ReactNode, useEffect, useState } from 'react'
import { useSafeUser } from './auth'
import { readJson } from './context'
import { useSafeConsent } from './hooks'

export function CookieBanner(props: {
	position?: string
	privacyPolicyUrl?: string
	variant?: string
	onSave?: () => void
}) {
	const { hasConsented, setConsent } = useSafeConsent()
	const t = useTranslations('consent')
	if (hasConsented) return null
	return (
		<div
			// Stable hook for the settled-visitor hide rule: the pre-paint script
			// in app/[locale]/layout.tsx marks <html> and globals.css hides this
			// node, so a visitor who already decided never sees a flash.
			data-consent-banner=""
			// Sits above the mobile bottom bar: overlapping it made the navigation
			// unusable until consent was given.
			className={
				props.position === 'bottom'
					? 'fixed inset-x-0 z-toast p-4 bottom-[calc(var(--spacing-bottom-nav-height)+env(safe-area-inset-bottom,0px))] md:bottom-0'
					: undefined
			}
		>
			<section
				aria-label={t('title')}
				className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border bg-background/95 p-4 text-sm shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between"
			>
				<p className="text-muted-foreground">
					{t('message')}{' '}
					{props.privacyPolicyUrl ? (
						<a
							href={props.privacyPolicyUrl}
							className="font-medium text-primary underline underline-offset-4"
						>
							{t('learnMore')}
						</a>
					) : null}
				</p>
				<div className="flex shrink-0 items-center gap-2">
					<button
						type="button"
						className="inline-flex min-h-11 items-center justify-center rounded-xl border px-4 font-medium text-foreground transition-colors hover:bg-muted"
						onClick={() => {
							void setConsent({ analytics: false, marketing: false }).then(() => props.onSave?.())
						}}
					>
						{t('decline')}
					</button>
					<button
						type="button"
						className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
						onClick={() => {
							void setConsent({ analytics: true, marketing: false }).then(() => props.onSave?.())
						}}
					>
						{t('accept')}
					</button>
				</div>
			</section>
		</div>
	)
}
export function AccountSection() {
	const { user, isLoading } = useSafeUser()
	if (isLoading) return <p>Loading account…</p>
	if (!user) return <p>Sign in to manage your Identity dest account.</p>
	return (
		<div>
			<p>{user.name || 'Puzzled player'}</p>
			<p>{user.email}</p>
			<p>Identity principal {user.id}</p>
		</div>
	)
}
export function SecuritySettings() {
	const [sessions, setSessions] = useState<unknown[]>([])
	useEffect(() => {
		fetch('/api/identity/sessions', { credentials: 'same-origin' })
			.then(async (response) => {
				const body = await readJson(response)
				setSessions(Array.isArray(body.sessions) ? body.sessions : [])
			})
			.catch(() => setSessions([]))
	}, [])
	return (
		<div>
			<p>Active Identity dest sessions: {sessions.length}</p>
		</div>
	)
}
export function UserProfile(_props: Record<string, unknown>) {
	return <AccountSection />
}

function OAuthIcon({ className }: { className?: string }) {
	return <span className={className} aria-hidden />
}
const namedOAuthIcons: Record<string, (props: { className?: string }) => ReactNode> = {
	google: OAuthIcon,
	github: OAuthIcon,
	apple: OAuthIcon,
	discord: OAuthIcon,
}
export const OAuthIcons: Record<string, (props: { className?: string }) => ReactNode> = new Proxy(
	namedOAuthIcons,
	{
		get: (target, prop) => (typeof prop === 'string' ? (target[prop] ?? OAuthIcon) : OAuthIcon),
	},
)
