/**
 * Sylphx React Hooks
 *
 * Hooks for accessing authentication state and actions.
 */

'use client'

import { useContext, useCallback, useState, useEffect, useRef } from 'react'
import {
	AuthContext,
	type AuthContextValue,
	type SignInOptions,
	type SignInWithOAuthOptions,
	type ResetPasswordOptions,
	type VerifyEmailOptions,
	type ResendVerificationEmailOptions,
	type ForgotPasswordOptions,
} from './context'
import { PlatformContext } from './platform-context'
import { useRequiredContext } from './services-context'
import type { User } from '../types'

/**
 * Internal hook to get auth context
 */
function useAuthContext(): AuthContextValue {
	return useRequiredContext(AuthContext, 'Auth')
}

/**
 * Internal hook to get auth context (safe version - returns null if no provider)
 */
function useAuthContextSafe(): AuthContextValue | null {
	return useContext(AuthContext)
}

/**
 * Internal hook to get platform context
 */
function usePlatformContextInternal() {
	return useRequiredContext(PlatformContext, 'Platform')
}

/**
 * Convert HeadersInit to Record<string, string>
 */
function headersToRecord(headers?: HeadersInit): Record<string, string> {
	if (!headers) return {}
	if (headers instanceof Headers) {
		const result: Record<string, string> = {}
		headers.forEach((value, key) => {
			result[key] = value
		})
		return result
	}
	if (Array.isArray(headers)) {
		return Object.fromEntries(headers)
	}
	return headers as Record<string, string>
}

// ============================================
// useUser
// ============================================

export interface UseUserReturn {
	/** Whether auth state has been loaded */
	isLoaded: boolean
	/** Whether auth state is still loading (inverse of isLoaded) */
	isLoading: boolean
	/** Whether user is signed in */
	isSignedIn: boolean
	/** Current user data (null if not signed in) */
	user: User | null
	/** Refresh user data from server */
	refresh: () => Promise<void>
}

/**
 * Hook to get the current user
 *
 * @example
 * ```tsx
 * function Profile() {
 *   const { user, isLoaded, isSignedIn, refresh } = useUser()
 *
 *   if (!isLoaded) return <Spinner />
 *   if (!isSignedIn) return <SignIn />
 *
 *   return <div>Hello, {user.name}!</div>
 * }
 * ```
 */
export function useUser(): UseUserReturn {
	const { isLoaded, isSignedIn, user, getToken } = useAuthContext()
	const platform = useContext(PlatformContext)

	const refresh = useCallback(async () => {
		// Force a token refresh to get updated user data
		try {
			const token = await getToken()
			if (token && platform) {
				// The token refresh will also update user data
				// Trigger a re-render by dispatching storage event with namespaced key
				window.dispatchEvent(new StorageEvent('storage', {
					key: `sylphx_${platform.appId}_user`,
				}))
			}
		} catch {
			// Silently fail - token refresh errors are handled by the auth context
		}
	}, [getToken, platform])

	return { isLoaded, isLoading: !isLoaded, isSignedIn, user, refresh }
}

// ============================================
// useAuth
// ============================================

export interface UseAuthReturn {
	/** Whether user is signed in */
	isSignedIn: boolean
	/** Auth error (e.g., token refresh failed) */
	error: Error | null
	/** Whether there was an auth error */
	isError: boolean
	/** Whether an OAuth flow is in progress */
	isOAuthLoading: boolean
	/** OAuth-specific error */
	oauthError: Error | null
	/** Clear OAuth error state */
	clearOAuthError: () => void
	/** Redirect to sign in page */
	signIn: (options?: SignInOptions) => void
	/** Redirect to sign up page */
	signUp: (options?: SignInOptions) => void
	/** Sign out the current user */
	signOut: (options?: { redirectUrl?: string }) => Promise<void>
	/** Get current access token (auto-refreshes if needed) */
	getToken: () => Promise<string | null>
	/** Reset password with token */
	resetPassword: (options: ResetPasswordOptions) => Promise<void>
	/** Verify email with token */
	verifyEmail: (options: VerifyEmailOptions) => Promise<void>
	/** Resend verification email */
	resendVerificationEmail: (options: ResendVerificationEmailOptions) => Promise<void>
	/** Request password reset email */
	forgotPassword: (options: ForgotPasswordOptions) => Promise<void>

	// ==========================================
	// Direct OAuth Methods (Firebase/Supabase pattern)
	// User goes directly to OAuth provider - no platform UI
	// ==========================================

	/**
	 * Sign in with OAuth provider directly (Firebase/Supabase pattern).
	 * Redirects user straight to OAuth provider - no platform login UI.
	 *
	 * @example
	 * ```tsx
	 * const { signInWithOAuth } = useAuth()
	 * await signInWithOAuth({ provider: 'google', redirectUrl: '/dashboard' })
	 * ```
	 */
	signInWithOAuth: (options: SignInWithOAuthOptions) => Promise<void>

	/** Convenience: Sign in with Google directly */
	signInWithGoogle: (redirectUrl?: string) => Promise<void>

	/** Convenience: Sign in with GitHub directly */
	signInWithGithub: (redirectUrl?: string) => Promise<void>

	/** Convenience: Sign in with Apple directly */
	signInWithApple: (redirectUrl?: string) => Promise<void>

	/** Convenience: Sign in with Discord directly */
	signInWithDiscord: (redirectUrl?: string) => Promise<void>

	/** Convenience: Sign in with Twitter directly */
	signInWithTwitter: (redirectUrl?: string) => Promise<void>

	/** Convenience: Sign in with Microsoft directly */
	signInWithMicrosoft: (redirectUrl?: string) => Promise<void>
}

/**
 * Hook to get auth actions
 *
 * @example
 * ```tsx
 * function LoginButton() {
 *   const { signIn, isSignedIn } = useAuth()
 *
 *   if (isSignedIn) return null
 *
 *   return (
 *     <button onClick={() => signIn({ redirectUrl: '/dashboard' })}>
 *       Sign In
 *     </button>
 *   )
 * }
 * ```
 */
export function useAuth(): UseAuthReturn {
	const {
		isSignedIn,
		signIn,
		signUp,
		signOut,
		getToken,
		error,
		isOAuthLoading,
		oauthError,
		clearOAuthError,
		resetPassword,
		verifyEmail,
		resendVerificationEmail,
		forgotPassword,
		// Direct OAuth methods
		signInWithOAuth,
		signInWithGoogle,
		signInWithGithub,
		signInWithApple,
		signInWithDiscord,
		signInWithTwitter,
		signInWithMicrosoft,
	} = useAuthContext()

	return {
		isSignedIn,
		error,
		isError: error !== null,
		isOAuthLoading,
		oauthError,
		clearOAuthError,
		signIn,
		signUp,
		signOut,
		getToken,
		resetPassword,
		verifyEmail,
		resendVerificationEmail,
		forgotPassword,
		// Direct OAuth methods (Firebase/Supabase pattern)
		signInWithOAuth,
		signInWithGoogle,
		signInWithGithub,
		signInWithApple,
		signInWithDiscord,
		signInWithTwitter,
		signInWithMicrosoft,
	}
}

// ============================================
// useSafeUser (doesn't throw when outside provider)
// ============================================

export interface UseSafeUserReturn {
	/** Whether Sylphx is configured (provider is mounted) */
	isConfigured: boolean
	/** Whether auth state has been loaded */
	isLoaded: boolean
	/** Whether auth state is still loading */
	isLoading: boolean
	/** Whether user is signed in */
	isSignedIn: boolean
	/** Current user data (null if not signed in or not configured) */
	user: User | null
}

/**
 * Safe version of useUser that doesn't throw when outside SylphxProvider.
 * Use this for optional auth features that should gracefully degrade.
 *
 * @example
 * ```tsx
 * function OptionalUserDisplay() {
 *   const { isConfigured, user } = useSafeUser()
 *
 *   if (!isConfigured) return null // Sylphx not set up
 *   if (!user) return <SignInPrompt />
 *
 *   return <span>Hi, {user.name}</span>
 * }
 * ```
 */
export function useSafeUser(): UseSafeUserReturn {
	const context = useAuthContextSafe()

	if (!context) {
		return {
			isConfigured: false,
			isLoaded: true,
			isLoading: false,
			isSignedIn: false,
			user: null,
		}
	}

	return {
		isConfigured: true,
		isLoaded: context.isLoaded,
		isLoading: !context.isLoaded,
		isSignedIn: context.isSignedIn,
		user: context.user,
	}
}

// ============================================
// useSafeAuth (doesn't throw when outside provider)
// ============================================

export interface UseSafeAuthReturn {
	/** Whether Sylphx is configured (provider is mounted) */
	isConfigured: boolean
	/** Whether user is signed in */
	isSignedIn: boolean
	/** Auth error (null if not configured) */
	error: Error | null
	/** Whether there was an auth error */
	isError: boolean
	/** Whether an OAuth flow is in progress */
	isOAuthLoading: boolean
	/** OAuth-specific error */
	oauthError: Error | null
	/** Clear OAuth error state */
	clearOAuthError: () => void
	/** Redirect to sign in page (no-op if not configured) */
	signIn: (options?: SignInOptions) => void
	/** Redirect to sign up page (no-op if not configured) */
	signUp: (options?: SignInOptions) => void
	/** Sign out the current user (no-op if not configured) */
	signOut: (options?: { redirectUrl?: string }) => Promise<void>
	/** Get current access token (returns null if not configured) */
	getToken: () => Promise<string | null>
	/** Reset password with token (throws if not configured) */
	resetPassword: ((options: ResetPasswordOptions) => Promise<void>) | null
	/** Verify email with token (throws if not configured) */
	verifyEmail: ((options: VerifyEmailOptions) => Promise<void>) | null
	/** Resend verification email (throws if not configured) */
	resendVerificationEmail: ((options: ResendVerificationEmailOptions) => Promise<void>) | null
	/** Request password reset email (throws if not configured) */
	forgotPassword: ((options: ForgotPasswordOptions) => Promise<void>) | null

	// ==========================================
	// Direct OAuth Methods (Firebase/Supabase pattern)
	// User goes directly to OAuth provider - no platform UI
	// ==========================================

	/**
	 * Sign in with OAuth provider directly (Firebase/Supabase pattern).
	 * Redirects user straight to OAuth provider - no platform login UI.
	 *
	 * @example
	 * ```tsx
	 * const { signInWithOAuth } = useSafeAuth()
	 *
	 * // Direct to Google consent screen
	 * await signInWithOAuth({ provider: 'google' })
	 * ```
	 */
	signInWithOAuth: ((options: SignInWithOAuthOptions) => Promise<void>) | null

	/** Convenience: Sign in with Google directly */
	signInWithGoogle: ((redirectUrl?: string) => Promise<void>) | null

	/** Convenience: Sign in with GitHub directly */
	signInWithGithub: ((redirectUrl?: string) => Promise<void>) | null

	/** Convenience: Sign in with Apple directly */
	signInWithApple: ((redirectUrl?: string) => Promise<void>) | null

	/** Convenience: Sign in with Discord directly */
	signInWithDiscord: ((redirectUrl?: string) => Promise<void>) | null

	/** Convenience: Sign in with Twitter directly */
	signInWithTwitter: ((redirectUrl?: string) => Promise<void>) | null

	/** Convenience: Sign in with Microsoft directly */
	signInWithMicrosoft: ((redirectUrl?: string) => Promise<void>) | null
}

/**
 * Safe version of useAuth that doesn't throw when outside SylphxProvider.
 * Use this for optional auth features that should gracefully degrade.
 *
 * @example
 * ```tsx
 * function LogoutButton() {
 *   const { isConfigured, isSignedIn, signOut } = useSafeAuth()
 *
 *   if (!isConfigured || !isSignedIn) return null
 *
 *   return <button onClick={() => signOut()}>Sign Out</button>
 * }
 * ```
 */
export function useSafeAuth(): UseSafeAuthReturn {
	const context = useAuthContextSafe()

	if (!context) {
		return {
			isConfigured: false,
			isSignedIn: false,
			error: null,
			isError: false,
			isOAuthLoading: false,
			oauthError: null,
			clearOAuthError: () => {},
			signIn: () => {},
			signUp: () => {},
			signOut: async () => {},
			getToken: async () => null,
			resetPassword: null,
			verifyEmail: null,
			resendVerificationEmail: null,
			forgotPassword: null,
			// Direct OAuth methods (not configured)
			signInWithOAuth: null,
			signInWithGoogle: null,
			signInWithGithub: null,
			signInWithApple: null,
			signInWithDiscord: null,
			signInWithTwitter: null,
			signInWithMicrosoft: null,
		}
	}

	return {
		isConfigured: true,
		isSignedIn: context.isSignedIn,
		error: context.error,
		isError: context.error !== null,
		isOAuthLoading: context.isOAuthLoading,
		oauthError: context.oauthError,
		clearOAuthError: context.clearOAuthError,
		signIn: context.signIn,
		signUp: context.signUp,
		signOut: context.signOut,
		getToken: context.getToken,
		resetPassword: context.resetPassword,
		verifyEmail: context.verifyEmail,
		resendVerificationEmail: context.resendVerificationEmail,
		forgotPassword: context.forgotPassword,
		// Direct OAuth methods (Firebase/Supabase pattern)
		signInWithOAuth: context.signInWithOAuth,
		signInWithGoogle: context.signInWithGoogle,
		signInWithGithub: context.signInWithGithub,
		signInWithApple: context.signInWithApple,
		signInWithDiscord: context.signInWithDiscord,
		signInWithTwitter: context.signInWithTwitter,
		signInWithMicrosoft: context.signInWithMicrosoft,
	}
}

// ============================================
// useSession
// ============================================

/**
 * Current authentication session state
 * Note: This is different from DeviceSession which represents active device sessions
 */
export interface AuthSession {
	/** Current user */
	user: User
	/** Access token */
	accessToken: string
}

export interface UseSessionReturn {
	/** Whether session has been loaded */
	isLoaded: boolean
	/** Current session (null if not signed in) */
	session: AuthSession | null
}

/**
 * Hook to get the current session
 *
 * @example
 * ```tsx
 * function Dashboard() {
 *   const { session, isLoaded } = useSession()
 *
 *   if (!isLoaded) return <Spinner />
 *   if (!session) return <Redirect to="/login" />
 *
 *   return (
 *     <div>
 *       <h1>Welcome, {session.user.name}</h1>
 *     </div>
 *   )
 * }
 * ```
 */
export function useSession(): UseSessionReturn {
	const { isLoaded, isSignedIn, user, accessToken } = useAuthContext()

	if (!isLoaded) {
		return { isLoaded: false, session: null }
	}

	if (!isSignedIn || !user || !accessToken) {
		return { isLoaded: true, session: null }
	}

	return {
		isLoaded: true,
		session: {
			user,
			accessToken,
		},
	}
}

// ============================================
// useSylphx (convenience hook)
// ============================================

/**
 * Client-side SDK configuration (subset of PlatformContextValue)
 *
 * This is different from SylphxConfig in config.ts which is for pure functions.
 * Use this type for client-side context access.
 */
export interface SylphxClientConfig {
	/** App ID (environment-specific: app_dev_xxx, app_stg_xxx, app_prod_xxx) */
	appId: string
	/** Platform API URL */
	platformUrl: string
}

export interface UseSylphxReturn extends AuthContextValue {
	/** SDK configuration */
	config: SylphxClientConfig
}

/**
 * Full access to Sylphx context including config
 *
 * Prefer using useUser, useAuth, or useSession for specific needs.
 */
export function useSylphx(): UseSylphxReturn {
	const auth = useAuthContext()
	const platform = usePlatformContextInternal()

	return {
		...auth,
		config: {
			appId: platform.appId,
			platformUrl: platform.platformUrl,
		},
	}
}

// ============================================
// useOrganization
// Full organization management via SDK REST API
// ============================================

// Import Organization types and functions from orgs.ts (SSOT)
import * as OrgFunctions from '../orgs'
import type {
	Organization,
	OrganizationMember,
	OrganizationInvitation,
	OrgRole,
} from '../orgs'
import { createConfig } from '../config'

export type { Organization, OrganizationMember, OrganizationInvitation, OrgRole }

/**
 * Return type for useOrganization hook
 */
export interface UseOrganizationReturn {
	/** Current selected organization */
	organization: Organization | null
	/** List of all user's organizations */
	organizations: Organization[]
	/** Members of current organization */
	members: OrganizationMember[]
	/** Pending invitations (if admin) */
	invitations: OrganizationInvitation[]
	/** Whether data is loading */
	isLoading: boolean
	/** Loading error */
	error: Error | null
	/** User's role in current organization */
	role: OrgRole | null
	/** Check if user has a specific permission */
	hasPermission: (permission: 'manage_members' | 'access_billing' | 'manage_apps' | 'view_analytics') => boolean
	/** Switch to a different organization */
	setOrganization: (orgIdOrSlug: string | null) => Promise<void>
	/** Create a new organization */
	createOrganization: (data: { name: string; slug?: string; email?: string }) => Promise<Organization>
	/** Update current organization */
	updateOrganization: (data: { name?: string; slug?: string; logoUrl?: string | null }) => Promise<Organization>
	/** Delete current organization (requires super_admin) */
	deleteOrganization: () => Promise<void>
	/** Invite a member to current organization */
	inviteMember: (email: string, role: OrgRole) => Promise<OrganizationInvitation>
	/** Update a member's role */
	updateMemberRole: (userId: string, role: OrgRole) => Promise<OrganizationMember>
	/** Remove a member from organization */
	removeMember: (userId: string) => Promise<void>
	/** Leave current organization */
	leave: () => Promise<void>
	/** Revoke a pending invitation */
	revokeInvitation: (invitationId: string) => Promise<void>
	/** Refresh organization data */
	refresh: () => Promise<void>
}

// Cross-tab sync constants for organizations (Clerk pattern)
const ORG_STORAGE_KEY = 'sylphx_active_org'
const ORG_BROADCAST_CHANNEL = 'sylphx_org_sync'

/**
 * Hook to manage organizations and RBAC
 *
 * Provides full organization management including CRUD operations,
 * member management, and invitation handling.
 *
 * ## Cross-Tab Sync (Clerk Pattern)
 * Organization context automatically syncs across browser tabs via:
 * - BroadcastChannel API for instant sync between tabs
 * - localStorage fallback for persistence
 *
 * @example
 * ```tsx
 * function OrgSettings() {
 *   const { organization, organizations, isLoading, role } = useOrganization()
 *
 *   if (isLoading) return <Spinner />
 *   if (!organization) return <CreateOrgForm />
 *
 *   return (
 *     <div>
 *       <h1>{organization.name}</h1>
 *       <p>Your role: {role}</p>
 *     </div>
 *   )
 * }
 * ```
 */
export function useOrganization(): UseOrganizationReturn {
	const platform = useContext(PlatformContext)

	// Initialize from localStorage for SSR safety
	const [organizations, setOrganizations] = useState<Organization[]>([])
	const [organization, setOrganization] = useState<Organization | null>(null)
	const [members, setMembers] = useState<OrganizationMember[]>([])
	const [invitations, setInvitations] = useState<OrganizationInvitation[]>([])
	const [role, setRole] = useState<OrgRole | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<Error | null>(null)

	// BroadcastChannel ref for cross-tab sync (Clerk pattern)
	const channelRef = useRef<BroadcastChannel | null>(null)

	// Create config for API calls using platform context
	const config = platform
		? createConfig({
				secretKey: platform.appId, // appId is the appId
				platformUrl: platform.platformUrl,
		  })
		: null

	// Get stored org slug from localStorage
	const getStoredOrgSlug = useCallback((): string | null => {
		if (typeof window === 'undefined') return null
		try {
			const key = platform?.appId ? `${ORG_STORAGE_KEY}_${platform.appId}` : ORG_STORAGE_KEY
			return localStorage.getItem(key)
		} catch {
			return null
		}
	}, [platform?.appId])

	// Store org slug to localStorage
	const storeOrgSlug = useCallback((slug: string | null) => {
		if (typeof window === 'undefined') return
		try {
			const key = platform?.appId ? `${ORG_STORAGE_KEY}_${platform.appId}` : ORG_STORAGE_KEY
			if (slug) {
				localStorage.setItem(key, slug)
			} else {
				localStorage.removeItem(key)
			}
		} catch {
			// Ignore storage errors
		}
	}, [platform?.appId])

	// Broadcast org change to other tabs (Clerk pattern)
	const broadcastOrgChange = useCallback((org: Organization | null) => {
		if (channelRef.current) {
			channelRef.current.postMessage({
				type: 'org_change',
				organization: org,
				timestamp: Date.now(),
			})
		}
	}, [])

	// Set up cross-tab sync via BroadcastChannel (Clerk pattern)
	useEffect(() => {
		if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return

		const channelName = platform?.appId
			? `${ORG_BROADCAST_CHANNEL}_${platform.appId}`
			: ORG_BROADCAST_CHANNEL

		const channel = new BroadcastChannel(channelName)
		channelRef.current = channel

		channel.onmessage = (event) => {
			if (event.data.type === 'org_change') {
				const newOrg = event.data.organization as Organization | null
				setOrganization(newOrg)
				setRole(null) // Role will be refreshed on next load
				// Store the change locally too
				storeOrgSlug(newOrg?.slug ?? null)
			}
		}

		return () => {
			channel.close()
			channelRef.current = null
		}
	}, [platform?.appId, storeOrgSlug])

	// Load organizations on mount (with localStorage restore)
	useEffect(() => {
		if (!config) {
			setIsLoading(false)
			return
		}

		let mounted = true

		async function loadOrgs() {
			try {
				const result = await OrgFunctions.getOrganizations(config!)
				if (mounted) {
					setOrganizations(result.organizations)

					// Restore from localStorage first, then fallback to first org
					const storedSlug = getStoredOrgSlug()
					const orgToSelect = storedSlug
						? result.organizations.find(o => o.slug === storedSlug)
						: result.organizations[0]

					if (orgToSelect && !organization) {
						await selectOrganization(orgToSelect.slug)
					}
					setIsLoading(false)
				}
			} catch (err) {
				if (mounted) {
					setError(err instanceof Error ? err : new Error('Failed to load organizations'))
					setIsLoading(false)
				}
			}
		}

		loadOrgs()
		return () => { mounted = false }
	}, [config?.platformUrl, getStoredOrgSlug])

	// Select an organization by ID or slug (with cross-tab sync)
	const selectOrganization = useCallback(async (orgIdOrSlug: string | null) => {
		if (!config || !orgIdOrSlug) {
			setOrganization(null)
			setMembers([])
			setInvitations([])
			setRole(null)
			storeOrgSlug(null)
			broadcastOrgChange(null)
			return
		}

		try {
			const result = await OrgFunctions.getOrganization(config, orgIdOrSlug)
			setOrganization(result.organization)
			setRole(result.membership?.role ?? null)

			// Persist selection to localStorage and broadcast to other tabs
			storeOrgSlug(result.organization.slug)
			broadcastOrgChange(result.organization)

			// Load members
			const membersResult = await OrgFunctions.getOrganizationMembers(config, orgIdOrSlug)
			setMembers(membersResult.members)

			// Load invitations if admin
			if (result.membership && ['super_admin', 'admin'].includes(result.membership.role)) {
				try {
					const invResult = await OrgFunctions.getOrganizationInvitations(config, orgIdOrSlug)
					setInvitations(invResult.invitations)
				} catch {
					// May not have permission
					setInvitations([])
				}
			} else {
				setInvitations([])
			}
		} catch (err) {
			setError(err instanceof Error ? err : new Error('Failed to load organization'))
		}
	}, [config, storeOrgSlug, broadcastOrgChange])

	// Permission checking
	const hasPermission = useCallback((permission: string): boolean => {
		if (!role) return false

		const rolePermissions: Record<OrgRole, string[]> = {
			super_admin: ['manage_members', 'access_billing', 'manage_apps', 'view_analytics'],
			admin: ['manage_members', 'access_billing', 'manage_apps', 'view_analytics'],
			billing: ['access_billing'],
			analytics: ['view_analytics'],
			developer: ['manage_apps', 'view_analytics'],
			viewer: ['view_analytics'],
		}

		return rolePermissions[role]?.includes(permission) ?? false
	}, [role])

	// CRUD operations
	const createOrg = useCallback(async (data: { name: string; slug?: string; email?: string }) => {
		if (!config) throw new Error('Not configured')
		const result = await OrgFunctions.createOrganization(config, data)
		setOrganizations(prev => [...prev, result.organization])
		await selectOrganization(result.organization.slug)
		return result.organization
	}, [config, selectOrganization])

	const updateOrg = useCallback(async (data: { name?: string; slug?: string; logoUrl?: string | null }) => {
		if (!config || !organization) throw new Error('No organization selected')
		const result = await OrgFunctions.updateOrganization(config, organization.id, data)
		setOrganization(result.organization)
		setOrganizations(prev => prev.map(o => o.id === result.organization.id ? result.organization : o))
		return result.organization
	}, [config, organization])

	const deleteOrg = useCallback(async () => {
		if (!config || !organization) throw new Error('No organization selected')
		await OrgFunctions.deleteOrganization(config, organization.id)
		setOrganizations(prev => prev.filter(o => o.id !== organization.id))
		const remaining = organizations.filter(o => o.id !== organization.id)
		if (remaining.length > 0) {
			await selectOrganization(remaining[0].slug)
		} else {
			setOrganization(null)
			setMembers([])
			setRole(null)
		}
	}, [config, organization, organizations, selectOrganization])

	// Member operations
	const inviteMember = useCallback(async (email: string, memberRole: OrgRole) => {
		if (!config || !organization) throw new Error('No organization selected')
		const result = await OrgFunctions.inviteOrganizationMember(config, organization.id, { email, role: memberRole })
		setInvitations(prev => [...prev, result.invitation])
		return result.invitation
	}, [config, organization])

	const updateMemberRole = useCallback(async (userId: string, newRole: OrgRole) => {
		if (!config || !organization) throw new Error('No organization selected')
		const result = await OrgFunctions.updateOrganizationMemberRole(config, organization.id, userId, newRole)
		setMembers(prev => prev.map(m => m.userId === userId ? result.member : m))
		return result.member
	}, [config, organization])

	const removeMember = useCallback(async (userId: string) => {
		if (!config || !organization) throw new Error('No organization selected')
		await OrgFunctions.removeOrganizationMember(config, organization.id, userId)
		setMembers(prev => prev.filter(m => m.userId !== userId))
	}, [config, organization])

	const leave = useCallback(async () => {
		if (!config || !organization) throw new Error('No organization selected')
		await OrgFunctions.leaveOrganization(config, organization.id)
		setOrganizations(prev => prev.filter(o => o.id !== organization.id))
		const remaining = organizations.filter(o => o.id !== organization.id)
		if (remaining.length > 0) {
			await selectOrganization(remaining[0].slug)
		} else {
			setOrganization(null)
			setMembers([])
			setRole(null)
		}
	}, [config, organization, organizations, selectOrganization])

	const revokeInvitation = useCallback(async (invitationId: string) => {
		if (!config || !organization) throw new Error('No organization selected')
		await OrgFunctions.revokeOrganizationInvitation(config, organization.id, invitationId)
		setInvitations(prev => prev.filter(i => i.id !== invitationId))
	}, [config, organization])

	// Refresh all data
	const refresh = useCallback(async () => {
		if (!config) return
		setIsLoading(true)
		try {
			const result = await OrgFunctions.getOrganizations(config)
			setOrganizations(result.organizations)
			if (organization) {
				await selectOrganization(organization.slug)
			}
		} catch (err) {
			setError(err instanceof Error ? err : new Error('Failed to refresh'))
		} finally {
			setIsLoading(false)
		}
	}, [config, organization, selectOrganization])

	return {
		organization,
		organizations,
		members,
		invitations,
		isLoading,
		error,
		role,
		hasPermission,
		setOrganization: selectOrganization,
		createOrganization: createOrg,
		updateOrganization: updateOrg,
		deleteOrganization: deleteOrg,
		inviteMember,
		updateMemberRole,
		removeMember,
		leave,
		revokeInvitation,
		refresh,
	}
}

// SDK Ready Hook - SSOT for configuration checking
export { useSdkReady, RequireSdk } from './hooks/use-sdk-ready'

// OAuth Providers Hook - fetch enabled providers from platform
export {
	useOAuthProviders,
	type EnabledProvider,
	type UseOAuthProvidersReturn,
} from './hooks/use-oauth-providers'
