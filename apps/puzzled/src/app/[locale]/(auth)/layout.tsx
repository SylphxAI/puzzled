export const dynamic = 'force-dynamic'

import { redirect } from '@/lib/i18n/routing'
import { auth } from '@/lib/identity/server'
import { AuthShell } from './_components/auth-shell'

type Props = {
	children: React.ReactNode
	params: Promise<{ locale: string }>
}

/**
 * Account surfaces share one frame: brand panel beside the form on desktop,
 * a mark plus a way back to play on mobile.
 *
 * Signed-in visitors leave immediately — these routes only exist for people
 * who still need to authenticate.
 */
export default async function AuthLayout({ children, params }: Props) {
	const { locale } = await params
	const { userId } = await auth()
	if (userId) {
		redirect({ href: '/', locale })
	}

	return <AuthShell locale={locale}>{children}</AuthShell>
}
