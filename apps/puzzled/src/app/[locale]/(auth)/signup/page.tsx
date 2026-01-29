import { getOAuthProviders } from '@sylphx/sdk/server'
import { SignUpForm } from './signup-form'

export const dynamic = 'force-dynamic'

export default async function SignUpPage() {
	const providers = await getOAuthProviders({
		publishableKey: process.env.NEXT_PUBLIC_SYLPHX_PUBLISHABLE_KEY!,
	})

	return <SignUpForm providers={providers} />
}
