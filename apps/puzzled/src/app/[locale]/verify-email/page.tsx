'use client'

import { CheckCircle, Loader2, Mail, XCircle } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Suspense, useEffect, useState } from 'react'
import { Link } from '@/lib/i18n/routing'
import { useAuth } from '@sylphx/platform-sdk/react'
import { Button, GamepadIcon } from '@sylphx/ui'

type VerificationState = 'verifying' | 'success' | 'error' | 'pending'

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
	const { verifyEmail, resendVerificationEmail } = useAuth()
	const token = searchParams.get('token')
	const email = searchParams.get('email')

	const [state, setState] = useState<VerificationState>(token ? 'verifying' : 'pending')
	const [error, setError] = useState('')
	const [resending, setResending] = useState(false)
	const [resent, setResent] = useState(false)

	useEffect(() => {
		if (!token) return

		const verify = async () => {
			try {
				await verifyEmail({ token })
				setState('success')
				setTimeout(() => router.push('/'), 2000)
			} catch (err) {
				setState('error')
				setError(err instanceof Error ? err.message : t('verificationFailed'))
			}
		}

		verify()
	}, [token, verifyEmail, t, router])

	const handleResend = async () => {
		if (!email) return

		setResending(true)
		try {
			await resendVerificationEmail({ email })
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
							{email && (
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
							{email && !resent && (
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
