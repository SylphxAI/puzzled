import { getOAuthProviders } from "@sylphx/sdk/server";
import { SignUpForm } from "./signup-form";

export const dynamic = "force-dynamic";

export default async function SignUpPage() {
	const providers = await getOAuthProviders({
		appId: process.env.NEXT_PUBLIC_SYLPHX_APP_ID!,
	});

	return <SignUpForm providers={providers} />;
}
