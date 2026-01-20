'use client'

import { ArrowLeft, CheckCircle2, Loader2, Lock } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Suspense, useEffect, useState } from 'react'
import { Link } from '@/lib/i18n/routing'
import { useSafeAuth } from '@sylphx/sdk/react'
import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@sylphx/ui'

export default function ResetPasswordPage() {
	return (
		<Suspense
			fallback={
				<div className="flex min-h-screen flex-col items-center justify-center px-4">
					<Loader2 className="h-8 w-8 animate-spin text-primary" />
				</div>
			}
		>
			<ResetPasswordContent />
		</Suspense>
	)
}

function ResetPasswordContent() {
	const t = useTranslations('auth')
	const router = useRouter()
	const searchParams = useSearchParams()
	const { resetPassword } = useSafeAuth()
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')
	const [success, setSuccess] = useState(false)
	const token = searchParams.get('token')

	useEffect(() => {
		if (!token) {
			setError(t('invalidResetLink'))
		}
	}, [token, t])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError('')

		if (password !== confirmPassword) {
			setError(t('passwordsDoNotMatch'))
			return
		}

		if (password.length < 8) {
			setError(t('passwordTooShort'))
			return
		}

		if (!token) {
			setError(t('invalidResetLink'))
			return
		}

		if (!resetPassword) {
			setError(t('resetPasswordError'))
			return
		}

		setLoading(true)

		try {
			await resetPassword({ token, newPassword: password })
			setSuccess(true)
			setTimeout(() => router.push('/login'), 2000)
		} catch (err) {
			setError(err instanceof Error ? err.message : t('resetPasswordError'))
		} finally {
			setLoading(false)
		}
	}

	if (success) {
		return (
			<div className="flex min-h-screen flex-col items-center justify-center px-4">
				<Card className="w-full max-w-md">
					<CardHeader className="text-center">
						<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-correct/10">
							<CheckCircle2 className="h-6 w-6 text-correct" />
						</div>
						<CardTitle>{t('passwordResetSuccess')}</CardTitle>
						<CardDescription>{t('passwordResetSuccessDescription')}</CardDescription>
					</CardHeader>
					<CardContent>
						<Link href="/login">
							<Button className="w-full">{t('backToLogin')}</Button>
						</Link>
					</CardContent>
				</Card>
			</div>
		)
	}

	return (
		<div className="flex min-h-screen flex-col items-center justify-center px-4">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<CardTitle>{t('resetPasswordTitle')}</CardTitle>
					<CardDescription>{t('resetPasswordDescription')}</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{error && (
						<div className="rounded-lg bg-destructive/10 p-3 text-center text-sm text-destructive">
							{error}
						</div>
					)}

					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-2">
							<label htmlFor="password" className="text-sm font-medium">
								{t('newPassword')}
							</label>
							<div className="relative">
								<Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<input
									id="password"
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									placeholder={t('passwordPlaceholder')}
									required
									minLength={8}
									className="w-full rounded-lg border bg-background py-2 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
								/>
							</div>
						</div>

						<div className="space-y-2">
							<label htmlFor="confirmPassword" className="text-sm font-medium">
								{t('confirmPassword')}
							</label>
							<div className="relative">
								<Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<input
									id="confirmPassword"
									type="password"
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									placeholder={t('confirmPasswordPlaceholder')}
									required
									minLength={8}
									className="w-full rounded-lg border bg-background py-2 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
								/>
							</div>
						</div>

						<Button type="submit" className="w-full" disabled={loading || !token}>
							{loading ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								t('resetPassword')
							)}
						</Button>
					</form>

					<div className="text-center">
						<Link
							href="/login"
							className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
						>
							<ArrowLeft className="h-4 w-4" />
							{t('backToLogin')}
						</Link>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
