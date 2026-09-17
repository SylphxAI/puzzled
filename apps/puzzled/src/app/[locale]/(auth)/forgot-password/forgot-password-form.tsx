'use client'

import { ArrowLeft, MailCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { FormEvent } from 'react'
import { useRef, useState } from 'react'
import { Link } from '@/lib/i18n/routing'
import { useForgotPasswordForm } from '@/lib/identity/react'
import { AuthField, AuthSubmit, emailProblem, FormAlert } from '../_components/auth-fields'

export function ForgotPasswordForm() {
	const t = useTranslations('auth')
	const [touched, setTouched] = useState(false)
	const [attempted, setAttempted] = useState(false)
	// Submission guard that survives two clicks in the same tick: `isLoading`
	// only flips after a re-render, so the ref is what actually blocks the
	// second submit while the first request is in flight.
	const submittingRef = useRef(false)

	const { form, setEmail, isLoading, error, success, handleSubmit } = useForgotPasswordForm({
		redirectTo: '/reset-password',
	})

	const emailIssue = emailProblem(form.email)
	const emailError = (attempted || touched) && emailIssue ? t(emailIssue) : undefined

	if (success) {
		return (
			<div className="surface-card p-6 text-center sm:p-8">
				<span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
					<MailCheck className="h-7 w-7 text-primary" aria-hidden="true" />
				</span>
				<h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight">
					{t('checkYourEmail')}
				</h1>
				<p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t('resetLinkSent')}</p>
				<p className="mt-2 text-sm font-semibold">{form.email}</p>
				<Link
					href="/login"
					className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-semibold transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					{t('backToLogin')}
				</Link>
			</div>
		)
	}

	function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (submittingRef.current || isLoading) return
		setAttempted(true)
		if (emailIssue) return
		submittingRef.current = true
		void handleSubmit(event).finally(() => {
			submittingRef.current = false
		})
	}

	return (
		<div className="surface-card p-5 sm:p-7">
			<h1 className="font-display text-2xl font-extrabold tracking-tight">
				{t('forgotPasswordTitle')}
			</h1>
			<p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
				{t('forgotPasswordDescription')}
			</p>

			<form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
				<AuthField
					id="email"
					label={t('email')}
					type="email"
					value={form.email}
					onChange={setEmail}
					onBlur={() => setTouched(true)}
					autoComplete="email"
					placeholder="you@example.com"
					disabled={isLoading}
					error={emailError}
					required
					enterKeyHint="done"
				/>

				<FormAlert message={error ? t('resetError') : null} />

				<AuthSubmit pending={isLoading} pendingLabel={t('sending')} label={t('sendResetLink')} />
			</form>

			<Link
				href="/login"
				className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				<ArrowLeft className="h-4 w-4" aria-hidden="true" />
				{t('backToLogin')}
			</Link>
		</div>
	)
}
