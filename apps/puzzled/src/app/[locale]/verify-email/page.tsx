'use client'

import { Button, GamepadIcon } from '@sylphx/ui'
import { CheckCircle, Loader2, Mail, XCircle } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Suspense, useState } from 'react'
import { Link } from '@/lib/i18n/routing'
import { useSafeAuth, useSafeUser } from '@/lib/identity/react'

type VerificationState = 'ready' | 'verifying' | 'success' | 'error' | 'pending'

export default function VerifyEmailPage() {
	return (
		<Suspense
			fallback={
				<div className="flex min-h-screen flex-col items-center justify-center px-4">
					<Loader2 className="h-8 w-8 animate-spin text-primary" />
				</div>
			}
		>
			<VerifyEmailContent />
		</Suspense>
	)
}

function VerifyEmailContent() {
	const t = useTranslations('auth')
	const tCommon = useTranslations('common')
	const router = useRouter()
	const searchParams = useSearchParams()
	const { verifyEmail, resendVerificationEmail } = useSafeAuth()
	const { isSignedIn } = useSafeUser()
	// The mailed link carries both ids: `challenge_id` and the secret `token`.
	const challengeId = searchParams.get('challenge_id')
	const token = searchParams.get('token')
	const email = searchParams.get('email')

	// Opening the link changes nothing: a mail scanner that fetches it spends no
	// secret. Verification runs only from the button below.
	const [state, setState] = useState<VerificationState>(challengeId && token ? 'ready' : 'pending')
	const [error, setError] = useState('')
	const [resending, setResending] = useState(false)
	const [resent, setResent] = useState(false)

	const handleConfirm = async () => {
		if (!challengeId || !token) return
		setState('verifying')
		try {
			await verifyEmail({ challengeId, secret: token })
			setState('success')
			setTimeout(() => router.push('/'), 2000)
		} catch {
			setState('error')
			setError(t('verificationLinkInvalid'))
		}
	}

	const handleResend = async () => {
		setResending(true)
		try {
			await resendVerificationEmail()
			setResent(true)
		} catch {
			setError(t('resendFailed'))
		} finally {
			setResending(false)
		}
	}

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

				{/* Ready State: the explicit confirm click */}
				{state === 'ready' && (
					<div className="space-y-4">
						<Mail className="mx-auto h-12 w-12 text-primary" />
						<div>
							<h2 className="text-xl font-semibold">{t('confirmEmailTitle')}</h2>
						</div>
						<Button onClick={handleConfirm} className="min-h-11 w-full">
							{t('confirmEmail')}
						</Button>
					</div>
				)}

				{/* Verifying State */}
				{state === 'verifying' && (
					<div className="space-y-4">
						<Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
						<p className="text-muted-foreground">{t('verifyingEmail')}</p>
					</div>
				)}

				{/* Success State */}
				{state === 'success' && (
					<div className="space-y-4">
						<CheckCircle className="mx-auto h-12 w-12 text-correct" />
						<div>
							<h2 className="text-xl font-semibold">{t('emailVerified')}</h2>
							<p className="text-muted-foreground">{t('redirecting')}</p>
						</div>
					</div>
				)}

				{/* Error State */}
				{state === 'error' && (
					<div className="space-y-4">
						<XCircle className="mx-auto h-12 w-12 text-wrong" />
						<div>
							<h2 className="text-xl font-semibold">{t('verificationFailed')}</h2>
							<p className="text-muted-foreground">{error}</p>
						</div>
						<div className="space-y-2">
							{isSignedIn && (
								<Button onClick={handleResend} disabled={resending || resent} className="w-full">
									{resending ? (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									) : (
										<Mail className="mr-2 h-4 w-4" />
									)}
									{resent ? t('emailSent') : t('resendEmail')}
								</Button>
							)}
							<Link href="/login">
								<Button variant="outline" className="w-full">
									{tCommon('signIn')}
								</Button>
							</Link>
						</div>
					</div>
				)}

				{/* Pending State (no token, just signed up) */}
				{state === 'pending' && (
					<div className="space-y-4">
						<Mail className="mx-auto h-12 w-12 text-primary" />
						<div>
							<h2 className="text-xl font-semibold">{t('checkYourEmail')}</h2>
							<p className="text-muted-foreground">{t('verificationSent')}</p>
						</div>
						{email && (
							<div className="rounded-lg bg-muted p-3">
								<p className="text-sm font-medium">{email}</p>
							</div>
						)}
						<div className="space-y-2">
							{isSignedIn && !resent && (
								<Button
									onClick={handleResend}
									variant="outline"
									disabled={resending}
									className="w-full"
								>
									{resending ? (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									) : (
										<Mail className="mr-2 h-4 w-4" />
									)}
									{t('resendEmail')}
								</Button>
							)}
							{resent && <p className="text-sm text-correct">{t('emailSent')}</p>}
							<Link href="/login">
								<Button variant="ghost" className="w-full">
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
