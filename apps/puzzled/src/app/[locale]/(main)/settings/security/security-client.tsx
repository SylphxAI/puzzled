'use client'

import { Button } from '@sylphx/ui'
import { ExternalLink, LogOut, RefreshCw, ShieldCheck } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import {
	ConsoleCard,
	ConsoleHeader,
	HonestNotice,
} from '@/features/console/components/console-chrome'
import { accountPortalAnchor, accountPortalLink } from '@/lib/identity/account-portal'
import { useSafeAuth } from '@/lib/identity/react'
import { type AccountSession, isAccountSession } from '@/lib/identity/sessions'

/** Auth's Account Portal on the app domain, or the in-app support page. */
const ACCOUNT_PORTAL = accountPortalLink()

type SessionsState =
	| { status: 'loading' }
	| { status: 'ready'; rows: AccountSession[]; nextCursor: string; currentSessionId: string }
	| { status: 'unavailable' }

/** Auth owns session state and scoped revocation; this surface presents its answers. */
export function SecuritySettingsContent() {
	const t = useTranslations('settings')
	const format = useFormatter()
	const [ending, setEnding] = useState<string | null>(null)
	const [endFailed, setEndFailed] = useState(false)
	const [cursor, setCursor] = useState('')
	const { signOut } = useSafeAuth()
	const [sessions, setSessions] = useState<SessionsState>({ status: 'loading' })
	const [signingOut, setSigningOut] = useState(false)

	const loadSessions = useCallback(async () => {
		setSessions({ status: 'loading' })
		try {
			const response = await fetch(`/api/identity/sessions?cursor=${encodeURIComponent(cursor)}`, {
				credentials: 'same-origin',
			})
			if (!response.ok) {
				setSessions({ status: 'unavailable' })
				return
			}
			const body = (await response.json().catch(() => null)) as {
				sessions?: unknown
				nextCursor?: unknown
				currentSessionId?: unknown
			} | null
			if (
				!body ||
				!Array.isArray(body.sessions) ||
				!body.sessions.every(isAccountSession) ||
				typeof body.nextCursor !== 'string' ||
				typeof body.currentSessionId !== 'string'
			) {
				setSessions({ status: 'unavailable' })
				return
			}
			setSessions({
				status: 'ready',
				rows: body.sessions,
				nextCursor: body.nextCursor,
				currentSessionId: body.currentSessionId,
			})
		} catch {
			setSessions({ status: 'unavailable' })
		}
	}, [cursor])

	useEffect(() => {
		void loadSessions()
	}, [loadSessions])

	async function endSession(id: string) {
		setEnding(id)
		setEndFailed(false)
		try {
			const response = await fetch('/api/identity/sessions', {
				method: 'POST',
				credentials: 'same-origin',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ sessionId: id }),
			})
			if (!response.ok) throw new Error('session_revoke_failed')
			const body = await response.json()
			if (body.endedCurrent) window.location.href = '/'
			else await loadSessions()
		} catch {
			setEndFailed(true)
		} finally {
			setEnding(null)
		}
	}

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
						<div className="space-y-3">
							{sessions.rows.length === 0 ? (
								<p>{t('sessions.noSessions')}</p>
							) : (
								<ul className="divide-y divide-border">
									{sessions.rows.map((session) => (
										<li
											key={session.session_id}
											className="flex flex-wrap items-center justify-between gap-3 py-3"
										>
											<div className="min-w-0">
												<p className="font-medium">
													{session.session_id === sessions.currentSessionId
														? t('sessions.currentSession')
														: session.device.display_name ||
															session.device.user_agent ||
															t('sessions.unknownDevice')}
												</p>
												<p className="text-sm text-muted-foreground">
													{t('sessions.started', {
														time: format.dateTime(
															new Date(session.created_at_unix_seconds * 1000),
															{ dateStyle: 'medium', timeStyle: 'short' },
														),
													})}
												</p>
												<p className="text-sm text-muted-foreground">
													{t(
														`sessions.state.${session.state === 'active' || session.state === 'revoked' || session.state === 'expired' ? session.state : 'unknown'}`,
													)}
												</p>
											</div>
											{session.state === 'active' ? (
												<Button
													variant="outline"
													className="min-h-11"
													disabled={ending !== null || signingOut}
													onClick={() => void endSession(session.session_id)}
												>
													{ending === session.session_id
														? t('account.signingOut')
														: t('sessions.signOut')}
												</Button>
											) : null}
										</li>
									))}
								</ul>
							)}
							<div className="flex gap-2">
								{cursor ? (
									<Button
										variant="outline"
										disabled={ending !== null}
										onClick={() => setCursor('')}
									>
										{t('sessions.firstPage')}
									</Button>
								) : null}
								{sessions.nextCursor ? (
									<Button
										variant="outline"
										disabled={ending !== null}
										onClick={() => setCursor(sessions.nextCursor)}
									>
										{t('sessions.nextPage')}
									</Button>
								) : null}
							</div>
						</div>
					) : (
						<HonestNotice
							title={t('security.sessionsUnavailableTitle')}
							body={t('security.sessionsUnavailableBody')}
							action={{ href: '/settings/security', label: t('sessions.retry') }}
						/>
					)}
				</div>

				{endFailed ? (
					<p role="alert" className="mt-3 text-sm text-destructive">
						{t('sessions.revokeError')}
					</p>
				) : null}
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
