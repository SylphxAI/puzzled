import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { auth } from '@/features/auth/server'

type Props = {
	children: React.ReactNode
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'auth' })

	return {
		title: t('signIn'),
		description: t('signInDescription'),
		robots: {
			index: true,
			follow: true,
		},
	}
}

export default async function AuthLayout({ children }: Props) {
	// If user is already logged in, redirect to home
	// Auth pages (login, signup, forgot-password) should not be accessible when logged in
	const session = await auth.api.getSession({
		headers: await headers(),
	})

	if (session?.user) {
		redirect('/')
	}

	return children
}
