import { loadOAuthProviders } from '@/lib/oauth-providers'
import { SignUpForm } from './signup-form'

export const dynamic = 'force-dynamic'

export default async function SignUpPage() {
	const providers = await loadOAuthProviders()

	return <SignUpForm providers={providers} />
}
