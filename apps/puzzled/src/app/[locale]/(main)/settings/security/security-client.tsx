'use client'

import { Button } from '@sylphx/ui'
import { ExternalLink, LogOut, RefreshCw, ShieldCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import {
	ConsoleCard,
	ConsoleHeader,
	HonestNotice,
} from '@/features/console/components/console-chrome'
import { accountPortalAnchor, accountPortalLink } from '@/lib/identity/account-portal'
import { useSafeAuth } from '@/lib/identity/react'

/** Auth's Account Portal on the app domain, or the in-app support page. */
const ACCOUNT_PORTAL = accountPortalLink()

type SessionsState =
	| { status: 'loading' }
	| { status: 'ready'; count: number }
	| { status: 'unavailable' }

/**
 * Security section.
 *
 * Two claims only: where sign-in protection is managed (the account centre),
 * and how many sessions the account authority reports for this account. A read
 * that does not answer shows as unavailable — never as zero sessions.
 */
export function SecuritySettingsContent() {
	const t = useTranslations('settings')
	const { signOut } = useSafeAuth()
	const [sessions, setSessions] = useState<SessionsState>({ status: 'loading' })
	const [signingOut, setSigningOut] = useState(false)

	const loadSessions = useCallback(async () => {
		setSessions({ status: 'loading' })
		try {
			const response = await fetch('/api/identity/sessions', { credentials: 'same-origin' })
			if (!response.ok) {
				setSessions({ status: 'unavailable' })
				return
			}
			const body = (await response.json().catch(() => null)) as { sessions?: unknown } | null
			if (!body || !Array.isArray(body.sessions)) {
				setSessions({ status: 'unavailable' })
				return
			}
			setSessions({ status: 'ready', count: body.sessions.length })
		} catch {
			setSessions({ status: 'unavailable' })
		}
	}, [])

	useEffect(() => {
		void loadSessions()
	}, [loadSessions])

	async function handleSignOut() {
		setSigningOut(true)
		try {
			await signOut()
			window.location.href = '/'
		} finally {
			setSigningOut(false)
		}
	}

	return (
		<>
			<ConsoleHeader
				headingLevel={2}
				title={t('security.title')}
				description={t('security.description')}
			/>

			<ConsoleCard
				title={t('security.protectionTitle')}
				description={t('security.protectionDescription')}
				actions={
					<Button asChild variant="outline" className="min-h-11 gap-2">
						<a {...accountPortalAnchor(ACCOUNT_PORTAL)}>
							{t('security.protectionCta')}
							{ACCOUNT_PORTAL.external ? (
								<ExternalLink className="h-4 w-4" aria-hidden="true" />
							) : null}
						</a>
					</Button>
				}
			>
				<ul className="space-y-2 text-sm text-muted-foreground">
					<li className="flex items-start gap-2">
						<ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
						{t('security.protectionPassword')}
					</li>
					<li className="flex items-start gap-2">
						<ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
						{t('security.protectionTwoFactor')}
					</li>
					<li className="flex items-start gap-2">
						<ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
						{t('security.protectionRecovery')}
					</li>
				</ul>
			</ConsoleCard>

			<ConsoleCard title={t('sessions.title')} description={t('security.sessionsDescription')}>
				<div aria-live="polite" aria-busy={sessions.status === 'loading'}>
					{sessions.status === 'loading' ? (
						<p className="text-sm text-muted-foreground">{t('security.sessionsLoading')}</p>
					) : sessions.status === 'ready' ? (
						<p className="text-sm">{t('security.sessionsCount', { count: sessions.count })}</p>
					) : (
						<HonestNotice
							title={t('security.sessionsUnavailableTitle')}
							body={t('security.sessionsUnavailableBody')}
							action={{ href: '/settings/security', label: t('sessions.retry') }}
						/>
					)}
				</div>

				<div className="mt-4 flex flex-wrap gap-2">
					<Button
						variant="outline"
						onClick={() => void loadSessions()}
						disabled={sessions.status === 'loading'}
						className="min-h-11 gap-2"
					>
						<RefreshCw
							className={sessions.status === 'loading' ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
							aria-hidden="true"
						/>
						{t('sessions.retry')}
					</Button>
					<Button
						variant="destructive"
						onClick={handleSignOut}
						disabled={signingOut}
						className="min-h-11 gap-2"
					>
						<LogOut className="h-4 w-4" aria-hidden="true" />
						{signingOut ? t('account.signingOut') : t('account.signOut')}
					</Button>
				</div>
			</ConsoleCard>
		</>
	)
}
