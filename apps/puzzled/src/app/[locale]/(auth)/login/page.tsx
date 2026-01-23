import { getOAuthProviders } from '@sylphx/sdk/server'
import { LoginForm } from './login-form'

export default async function LoginPage() {
	const providers = await getOAuthProviders({
		appId: process.env.NEXT_PUBLIC_SYLPHX_APP_ID!,
		platformUrl: process.env.NEXT_PUBLIC_SYLPHX_URL,
	})

	return <LoginForm providers={providers} />
}
