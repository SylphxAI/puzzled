'use client'

import { Button, GamepadIcon } from '@sylphx/ui'
import { CheckCircle, Loader2, Mail, XCircle } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Suspense, useEffect, useState } from 'react'
import { Link } from '@/lib/i18n/routing'

type UnsubscribeState = 'loading' | 'success' | 'error' | 'idle'

/**
 * Transactional unsubscribe surface.
 *
 * Reached from a link in a marketing email, so it has to speak the language of
 * the email that sent the reader here: every string comes from the 'auth'
 * message catalogue (the surface the S2 audit groups it under), including the
 * failure copy the page states for itself.
 */
export default function UnsubscribePage() {
	return (
		<Suspense
			fallback={
				<div className="flex min-h-screen flex-col items-center justify-center px-4">
					<Loader2 className="h-8 w-8 animate-spin text-primary" />
				</div>
			}
		>
			<UnsubscribeContent />
		</Suspense>
	)
}

function UnsubscribeContent() {
	const t = useTranslations('auth')
	const searchParams = useSearchParams()
	const success = searchParams.get('success')
	const error = searchParams.get('error')
	const token = searchParams.get('token')

	const [state, setState] = useState<UnsubscribeState>('idle')
	const [errorMessage, setErrorMessage] = useState('')

	// Handle redirect results from GET endpoint or POST-based unsubscribe
	useEffect(() => {
		const handleUnsubscribe = async (unsubToken: string) => {
			setState('loading')
			try {
				const response = await fetch('/api/email/unsubscribe', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ token: unsubToken }),
				})

				if (response.ok) {
					setState('success')
				} else {
					// The route answers with an English message for API callers; the
					// page states the outcome itself so the copy stays localized.
					setState('error')
					setErrorMessage(
						response.status === 400
							? t('unsubscribe.error.invalidToken')
							: t('unsubscribe.error.failed'),
					)
				}
			} catch {
				setState('error')
				setErrorMessage(t('unsubscribe.error.network'))
			}
		}

		if (success === 'true') {
			setState('success')
		} else if (error) {
			setState('error')
			switch (error) {
				case 'missing_token':
					setErrorMessage(t('unsubscribe.error.missingToken'))
					break
				case 'invalid_token':
					setErrorMessage(t('unsubscribe.error.invalidToken'))
					break
				case 'not_found':
					setErrorMessage(t('unsubscribe.error.notFound'))
					break
				default:
					setErrorMessage(t('unsubscribe.error.failed'))
			}
		} else if (token) {
			// Handle POST-based unsubscribe
			handleUnsubscribe(token)
		}
	}, [success, error, token, t])

	return (
		<div className="flex min-h-screen flex-col items-center justify-center px-4">
			<div className="w-full max-w-sm space-y-6 text-center">
				{/* Logo */}
				<div>
					<h1 className="mb-2 flex items-center justify-center gap-2 text-2xl font-bold">
						<GamepadIcon size={28} className="text-primary" />
						Puzzled
					</h1>
				</div>

				{/* Loading State */}
				{state === 'loading' && (
					<div className="space-y-4">
						<Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
						<p className="text-muted-foreground">{t('unsubscribe.processing')}</p>
					</div>
				)}

				{/* Success State */}
				{state === 'success' && (
					<div className="space-y-4">
						<CheckCircle className="mx-auto h-12 w-12 text-correct" />
						<div>
							<h2 className="text-xl font-semibold">{t('unsubscribe.successTitle')}</h2>
							<p className="text-muted-foreground">{t('unsubscribe.successDescription')}</p>
						</div>
						<Link href="/">
							<Button className="w-full">{t('unsubscribe.returnHome')}</Button>
						</Link>
					</div>
				)}

				{/* Error State */}
				{state === 'error' && (
					<div className="space-y-4">
						<XCircle className="mx-auto h-12 w-12 text-wrong" />
						<div>
							<h2 className="text-xl font-semibold">{t('unsubscribe.failedTitle')}</h2>
							<p className="text-muted-foreground">{errorMessage}</p>
						</div>
						<div className="space-y-2">
							<Link href="/settings">
								<Button className="w-full">{t('unsubscribe.managePreferences')}</Button>
							</Link>
							<Link href="/">
								<Button variant="outline" className="w-full">
									{t('unsubscribe.returnHome')}
								</Button>
							</Link>
						</div>
					</div>
				)}

				{/* Idle State (no token provided) */}
				{state === 'idle' && !token && !success && !error && (
					<div className="space-y-4">
						<Mail className="mx-auto h-12 w-12 text-primary" />
						<div>
							<h2 className="text-xl font-semibold">{t('unsubscribe.idleTitle')}</h2>
							<p className="text-muted-foreground">{t('unsubscribe.idleDescription')}</p>
						</div>
						<div className="space-y-2">
							<Link href="/settings">
								<Button className="w-full">{t('unsubscribe.goToSettings')}</Button>
							</Link>
							<Link href="/">
								<Button variant="outline" className="w-full">
									{t('unsubscribe.returnHome')}
								</Button>
							</Link>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
