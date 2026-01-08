import { inferAdditionalFields, twoFactorClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import { getBaseUrl } from '@/lib/utils'
import type { auth } from './auth'

export const authClient = createAuthClient({
	// Auth client needs actual origin for cross-origin requests
	baseURL: getBaseUrl('origin'),
	plugins: [twoFactorClient(), inferAdditionalFields<typeof auth>()],
})

export const {
	signIn,
	signUp,
	signOut,
	useSession,
	sendVerificationEmail,
	verifyEmail,
	twoFactor,
	linkSocial,
	changePassword,
} = authClient
