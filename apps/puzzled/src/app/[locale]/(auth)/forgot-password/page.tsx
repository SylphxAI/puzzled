'use client'

import { AlertCircle, ArrowLeft, CheckCircle2, Mail } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Link } from '@/lib/i18n/routing'
import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/shared/components/ui'

export default function ForgotPasswordPage() {
	const t = useTranslations('auth')
	const [email, setEmail] = useState('')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')
	const [success, setSuccess] = useState(false)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError('')
		setLoading(true)

		try {
			const res = await fetch('/api/auth/forgot-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email }),
			})

			if (!res.ok) {
				throw new Error('Failed to send reset email')
			}

			setSuccess(true)
		} catch {
			setError(t('resetError'))
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
						<CardTitle>{t('checkEmail')}</CardTitle>
						<CardDescription>{t('resetEmailSent')}</CardDescription>
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
					<CardTitle>{t('forgotPasswordTitle')}</CardTitle>
					<CardDescription>{t('resetInstructions')}</CardDescription>
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
							<label htmlFor="email" className="text-sm font-medium">
								{t('email')}
							</label>
							<div className="relative">
								<Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<input
									id="email"
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									placeholder="you@example.com"
									required
									className="w-full rounded-lg border bg-background py-2 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
								/>
							</div>
						</div>

						<Button type="submit" className="w-full" disabled={loading}>
							{loading ? (
								<div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
							) : (
								t('sendResetLink')
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
