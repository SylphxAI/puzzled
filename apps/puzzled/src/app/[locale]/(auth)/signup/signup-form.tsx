'use client'

import { Check, MailCheck } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { FormEvent } from 'react'
import { useRef, useState } from 'react'
import { Link } from '@/lib/i18n/routing'
import { afterSignUpDestination } from '@/lib/identity/after-sign-up'
import { type OAuthProvider, useSafeAuth, useSignUpForm } from '@/lib/identity/react'
import {
	AuthField,
	AuthSubmit,
	emailProblem,
	FormAlert,
	MIN_PASSWORD_LENGTH,
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
	// Back to the game that asked for the account (safe same-origin path only).
	const afterSignUpUrl = afterSignUpDestination(useSearchParams().get('callbackUrl'))

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
		afterSignUpUrl,
		minPasswordLength: MIN_PASSWORD_LENGTH,
		oauthHandler: async (provider: string) => {
			await signInWithOAuth?.({
				provider: provider as OAuthSignInProvider,
				redirectUrl: afterSignUpUrl,
			})
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
				<h1 className="mt-4 font-display text-2xl">{t('checkYourEmail')}</h1>
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

	// The server's own refusal of a short password shows under the field too,
	// not as a generic failure banner.
	const serverSaysTooShort = error?.message === 'password_too_short'
	const passwordError =
		(attempted || touched.password) && passwordIssue
			? t(passwordIssue, { min: MIN_PASSWORD_LENGTH })
			: serverSaysTooShort
				? t('passwordTooShort', { min: MIN_PASSWORD_LENGTH })
				: undefined

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
			<h1 className="font-display text-2xl">{t('createAccount')}</h1>
			<p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t('joinToContinue')}</p>
			{/* The desktop brand panel makes a different pitch (free, no account, midnight); on a phone the card is the whole page, so the sign-up reasons live here. */}
			<ul className="mt-3 space-y-1.5 text-sm lg:hidden">
				{(['signupBenefitSaved', 'signupBenefitDevices', 'signupBenefitFree'] as const).map(
					(key) => (
						<li key={key} className="flex items-center gap-2">
							<Check className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
							{t(key)}
						</li>
					),
				)}
			</ul>

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
					hint={t('passwordHint', { min: MIN_PASSWORD_LENGTH })}
					error={passwordError}
					showStrength
					required
					enterKeyHint="done"
				/>

				<FormAlert message={error && !serverSaysTooShort ? t('signUpError') : null} />

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
