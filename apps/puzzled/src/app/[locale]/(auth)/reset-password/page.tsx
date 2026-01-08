'use client'

import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Lock } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Suspense, useEffect, useState } from 'react'
import { validatePassword } from '@/features/auth'
import { PasswordStrength } from '@/features/auth/components'
import { Link } from '@/lib/i18n/routing'
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
	const tPassword = useTranslations('auth.passwordStrength')
	const router = useRouter()
	const searchParams = useSearchParams()
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')
	const [success, setSuccess] = useState(false)
	const [token, setToken] = useState<string | null>(null)

	useEffect(() => {
		const tokenParam = searchParams.get('token')
		if (tokenParam) {
			setToken(tokenParam)
		} else {
			setError(t('invalidResetLink'))
		}
	}, [searchParams, t])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError('')

		// Validate passwords match
		if (password !== confirmPassword) {
			setError(t('passwordsDoNotMatch'))
			return
		}

		// Validate password against security policy
		const validation = validatePassword(password)
		if (!validation.isValid && validation.errors[0]) {
			setError(tPassword(validation.errors[0]))
			return
		}

		if (!token) {
			setError(t('invalidResetLink'))
			return
		}

		setLoading(true)

		try {
			const res = await fetch('/api/auth/reset-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					newPassword: password,
					token,
				}),
			})

			const data = await res.json()

			if (!res.ok) {
				throw new Error(data.error || t('resetPasswordError'))
			}

			setSuccess(true)

			// Redirect to login after 2 seconds
			setTimeout(() => {
				router.push('/login')
			}, 2000)
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
						<div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
							<AlertCircle className="h-4 w-4" />
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
							<PasswordStrength password={password} />
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
								<div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
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
