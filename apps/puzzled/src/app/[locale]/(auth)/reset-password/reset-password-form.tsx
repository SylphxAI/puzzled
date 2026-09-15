'use client'

import { ArrowLeft, CircleCheck, TriangleAlert } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link } from '@/lib/i18n/routing'
import { useResetPasswordForm } from '@/lib/identity/react'
import {
	AuthSubmit,
	FormAlert,
	MIN_PASSWORD_LENGTH,
	PasswordField,
	passwordProblem,
} from '../_components/auth-fields'

export function ResetPasswordForm() {
	const t = useTranslations('auth')
	const searchParams = useSearchParams()
	const token = searchParams.get('token') ?? ''
	const [touched, setTouched] = useState(false)
	const [attempted, setAttempted] = useState(false)

	const {
		form,
		setPassword,
		setConfirmPassword,
		passwordsMatch,
		isValid,
		isLoading,
		error,
		success,
		handleSubmit,
	} = useResetPasswordForm({
		token,
		minPasswordLength: MIN_PASSWORD_LENGTH,
		afterResetUrl: '/login',
	})

	// No token at all: the link that brought the visitor here is incomplete.
	if (!token) {
		return (
			<div className="surface-card p-6 text-center sm:p-8">
				<span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
					<TriangleAlert className="h-7 w-7 text-destructive" aria-hidden="true" />
				</span>
				<h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight">
					{t('invalidResetLink')}
				</h1>
				<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
					{t('invalidResetLinkDescription')}
				</p>
				<Link
					href="/forgot-password"
					className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					{t('requestNewLink')}
				</Link>
			</div>
		)
	}

	if (success) {
		return (
			<div className="surface-card p-6 text-center sm:p-8">
				<span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10">
					<CircleCheck
						className="h-7 w-7 text-emerald-600 dark:text-emerald-400"
						aria-hidden="true"
					/>
				</span>
				<h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight">
					{t('passwordResetSuccess')}
				</h1>
				<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
					{t('passwordResetSuccessDescription')}
				</p>
				<Link
					href="/login"
					className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					{t('backToLogin')}
				</Link>
			</div>
		)
	}

	const passwordIssue = passwordProblem(form.password, MIN_PASSWORD_LENGTH)
	const mismatch =
		form.confirmPassword.length > 0 && form.password !== form.confirmPassword
			? t('passwordsDoNotMatch')
			: undefined

	function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (isLoading) return
		setAttempted(true)
		if (passwordIssue || !passwordsMatch) return
		void handleSubmit(event)
	}

	return (
		<div className="surface-card p-5 sm:p-7">
			<h1 className="font-display text-2xl font-extrabold tracking-tight">
				{t('resetPasswordTitle')}
			</h1>
			<p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
				{t('resetPasswordDescription')}
			</p>

			<form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
				<PasswordField
					id="password"
					label={t('newPassword')}
					value={form.password}
					onChange={setPassword}
					onBlur={() => setTouched(true)}
					autoComplete="new-password"
					disabled={isLoading}
					error={(attempted || touched) && passwordIssue ? t(passwordIssue) : undefined}
					showStrength
					hint={t('passwordHint')}
					required
					enterKeyHint="next"
				/>
				<PasswordField
					id="confirmPassword"
					label={t('confirmPassword')}
					value={form.confirmPassword}
					onChange={setConfirmPassword}
					autoComplete="new-password"
					disabled={isLoading}
					error={mismatch}
					required
					enterKeyHint="done"
				/>

				<FormAlert message={error ? t('resetPasswordError') : null} />

				<AuthSubmit
					pending={isLoading}
					pendingLabel={t('resetting')}
					label={t('resetPassword')}
					disabled={!isValid}
				/>
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
