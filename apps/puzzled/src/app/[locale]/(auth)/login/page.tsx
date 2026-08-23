import { loadOAuthProviders } from '@/lib/oauth-providers'
import { LoginForm } from './login-form'

// Auth pages must SSR on every request to reflect admin config changes
// (e.g. disabling OAuth providers). Never statically generate these.
export const dynamic = 'force-dynamic'

export default async function LoginPage() {
	const providers = await loadOAuthProviders()

	return <LoginForm providers={providers} />
}
