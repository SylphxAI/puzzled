import { getOAuthProviders } from '@sylphx/sdk/server'
import { LoginForm } from './login-form'

// Auth pages must SSR on every request to reflect admin config changes
// (e.g. disabling OAuth providers). Never statically generate these.
export const dynamic = 'force-dynamic'

export default async function LoginPage() {
	const providers = await getOAuthProviders({
		publishableKey: process.env.NEXT_PUBLIC_SYLPHX_PUBLISHABLE_KEY!,
		platformUrl: process.env.NEXT_PUBLIC_SYLPHX_URL,
	})

	return <LoginForm providers={providers} />
}
