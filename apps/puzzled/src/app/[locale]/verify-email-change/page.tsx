'use client'

import { CheckCircle, Loader2, XCircle } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Suspense, useEffect, useRef, useState } from 'react'
import { Link } from '@/lib/i18n/routing'
import { Button, GamepadIcon } from '@/shared/components/ui'
import { trpc } from '@/trpc/client'

type VerificationState = 'verifying' | 'success' | 'error'

export default function VerifyEmailChangePage() {
	return (
		<Suspense
			fallback={
				<div className="flex min-h-screen flex-col items-center justify-center px-4">
					<Loader2 className="h-8 w-8 animate-spin text-primary" />
				</div>
			}
		>
			<VerifyEmailChangeContent />
		</Suspense>
	)
}

function VerifyEmailChangeContent() {
	const t = useTranslations('settings.email')
	const tCommon = useTranslations('common')
	const router = useRouter()
	const searchParams = useSearchParams()
	const token = searchParams.get('token')

	const [state, setState] = useState<VerificationState>('verifying')
	const [error, setError] = useState('')
	const [newEmail, setNewEmail] = useState('')
	const hasVerified = useRef(false)

	const verifyMutation = trpc.email.verifyEmailChange.useMutation({
		onSuccess: (data) => {
			setState('success')
			setNewEmail(data.newEmail)
			// Redirect to settings after 3 seconds
			setTimeout(() => router.push('/settings/account'), 3000)
		},
		onError: (err) => {
			setState('error')
			setError(err.message)
		},
	})

	useEffect(() => {
		// Prevent double verification in strict mode
		if (hasVerified.current) return

		if (!token) {
			setState('error')
			setError(t('invalidToken'))
			return
		}

		hasVerified.current = true
		verifyMutation.mutate({ token })
	}, [token, t, verifyMutation])

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

				{/* Verifying State */}
				{state === 'verifying' && (
					<div className="space-y-4">
						<Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
						<p className="text-muted-foreground">{t('verifyingChange')}</p>
					</div>
				)}

				{/* Success State */}
				{state === 'success' && (
					<div className="space-y-4">
						<CheckCircle className="mx-auto h-12 w-12 text-correct" />
						<div>
							<h2 className="text-xl font-semibold">{t('changeSuccess')}</h2>
							<p className="text-muted-foreground">
								{t('changeSuccessDescription', { email: newEmail })}
							</p>
						</div>
						<p className="text-sm text-muted-foreground">{t('redirectingToSettings')}</p>
						<Link href="/settings/account">
							<Button className="w-full">{t('goToSettings')}</Button>
						</Link>
					</div>
				)}

				{/* Error State */}
				{state === 'error' && (
					<div className="space-y-4">
						<XCircle className="mx-auto h-12 w-12 text-wrong" />
						<div>
							<h2 className="text-xl font-semibold">{t('changeFailed')}</h2>
							<p className="text-muted-foreground">{error}</p>
						</div>
						<div className="space-y-2">
							<Link href="/settings/account">
								<Button className="w-full">{t('goToSettings')}</Button>
							</Link>
							<Link href="/">
								<Button variant="outline" className="w-full">
									{tCommon('back')}
								</Button>
							</Link>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
