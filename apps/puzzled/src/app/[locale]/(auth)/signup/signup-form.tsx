'use client'

import { MailCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { FormEvent } from 'react'
import { useRef, useState } from 'react'
import { Link } from '@/lib/i18n/routing'
import { type OAuthProvider, useSafeAuth, useSignUpForm } from '@/lib/identity/react'
import {
	AuthField,
	AuthSubmit,
	emailProblem,
	FormAlert,
	OAuthButtons,
	PasswordField,
	passwordProblem,
} from '../_components/auth-fields'

type OAuthSignInProvider = NonNullable<
	Parameters<NonNullable<ReturnType<typeof useSafeAuth>['signInWithOAuth']>>[0]
>['provider']

interface SignUpFormProps {
	providers: OAuthProvider[]
}

export function SignUpForm({ providers }: SignUpFormProps) {
	const t = useTranslations('auth')
	const tCommon = useTranslations('common')
	const [touched, setTouched] = useState<{ name?: boolean; email?: boolean; password?: boolean }>(
		{},
	)
	const [attempted, setAttempted] = useState(false)
	// Submission guard that survives two clicks in the same tick: `isLoading`
	// only flips after a re-render, so the ref is what actually blocks the
	// second submit while the first request is in flight.
	const submittingRef = useRef(false)
	const { signInWithOAuth } = useSafeAuth()

	const {
		form,
		setName,
		setEmail,
		setPassword,
		step,
		isLoading,
		loadingProvider,
		error,
		passwordValid,
		handleSubmit,
		handleOAuthSignUp,
	} = useSignUpForm({
		providers,
		afterSignUpUrl: '/',
		minPasswordLength: 8,
		oauthHandler: async (provider: string) => {
			await signInWithOAuth?.({ provider: provider as OAuthSignInProvider, redirectUrl: '/' })
		},
	})

	const nameIssue = form.name.trim() ? null : 'nameRequired'
	const emailIssue = emailProblem(form.email)
	const passwordIssue = passwordProblem(form.password)

	// The account exists but still needs its email confirmed: say exactly that.
	if (step === 'verify-email') {
		return (
			<div className="surface-card p-6 text-center sm:p-8">
				<span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
					<MailCheck className="h-7 w-7 text-primary" aria-hidden="true" />
				</span>
				<h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight">
					{t('checkYourEmail')}
				</h1>
				<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
					{t('verificationSent')}
				</p>
				{form.email ? <p className="mt-2 text-sm font-semibold">{form.email}</p> : null}
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
		if (nameIssue || emailIssue || passwordIssue) return
		submittingRef.current = true
		void handleSubmit(event).finally(() => {
			submittingRef.current = false
		})
	}

	return (
		<div className="surface-card p-5 sm:p-7">
			<h1 className="font-display text-2xl font-extrabold tracking-tight">{t('createAccount')}</h1>
			<p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t('joinToContinue')}</p>

			<div className="mt-6">
				<OAuthButtons
					providers={providers}
					onSelect={handleOAuthSignUp}
					disabled={isLoading}
					loadingProvider={loadingProvider}
				/>
			</div>

			<form onSubmit={onSubmit} noValidate className="mt-5 space-y-4">
				<AuthField
					id="name"
					label={t('name')}
					value={form.name}
					onChange={setName}
					onBlur={() => setTouched((state) => ({ ...state, name: true }))}
					autoComplete="name"
					placeholder={t('namePlaceholder')}
					disabled={isLoading}
					error={(attempted || touched.name) && nameIssue ? t(nameIssue) : undefined}
					required
					enterKeyHint="next"
				/>
				<AuthField
					id="email"
					label={t('email')}
					type="email"
					value={form.email}
					onChange={setEmail}
					onBlur={() => setTouched((state) => ({ ...state, email: true }))}
					autoComplete="email"
					placeholder="you@example.com"
					disabled={isLoading}
					error={(attempted || touched.email) && emailIssue ? t(emailIssue) : undefined}
					required
					enterKeyHint="next"
				/>
				<PasswordField
					id="password"
					label={t('password')}
					value={form.password}
					onChange={setPassword}
					onBlur={() => setTouched((state) => ({ ...state, password: true }))}
					autoComplete="new-password"
					disabled={isLoading}
					hint={t('passwordHint')}
					error={(attempted || touched.password) && passwordIssue ? t(passwordIssue) : undefined}
					showStrength
					required
					enterKeyHint="done"
				/>

				<FormAlert message={error ? t('signUpError') : null} />

				<AuthSubmit
					pending={isLoading}
					pendingLabel={t('signingUp')}
					label={tCommon('signUp')}
					disabled={!passwordValid}
				/>

				<p className="text-center text-xs leading-relaxed text-muted-foreground">
					{t.rich('termsAgree', {
						terms: (chunks) => (
							<Link href="/terms" className="font-semibold text-primary hover:underline">
								{chunks}
							</Link>
						),
						privacy: (chunks) => (
							<Link href="/privacy" className="font-semibold text-primary hover:underline">
								{chunks}
							</Link>
						),
					})}
				</p>
			</form>

			<p className="mt-6 text-center text-sm text-muted-foreground">
				{t('hasAccount')}{' '}
				<Link href="/login" className="font-semibold text-primary hover:underline">
					{tCommon('signIn')}
				</Link>
			</p>
		</div>
	)
}
