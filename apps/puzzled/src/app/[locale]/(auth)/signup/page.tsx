import { getOAuthProviders } from '@sylphx/sdk/server'
import { SignUpForm } from './signup-form'

/** Revalidate provider list every 5 minutes (not static) */
export const revalidate = 300

export default async function SignUpPage() {
	const providers = await getOAuthProviders({
		appId: process.env.NEXT_PUBLIC_SYLPHX_APP_ID!,
		platformUrl: process.env.NEXT_PUBLIC_SYLPHX_URL,
	})

	return <SignUpForm providers={providers} />
}
