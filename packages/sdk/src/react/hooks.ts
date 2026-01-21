/**
 * Sylphx React Hooks
 *
 * Hooks for accessing authentication state and actions.
 */

'use client'

import { useContext, useCallback, useState, useEffect } from 'react'
import {
	AuthContext,
	type AuthContextValue,
	type SignInOptions,
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
		resetPassword,
		verifyEmail,
		resendVerificationEmail,
		forgotPassword,
	} = useAuthContext()

	return {
		isSignedIn,
		error,
		isError: error !== null,
		signIn,
		signUp,
		signOut,
		getToken,
		resetPassword,
		verifyEmail,
		resendVerificationEmail,
		forgotPassword,
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
			signIn: () => {},
			signUp: () => {},
			signOut: async () => {},
			getToken: async () => null,
			resetPassword: null,
			verifyEmail: null,
			resendVerificationEmail: null,
			forgotPassword: null,
		}
	}

	return {
		isConfigured: true,
		isSignedIn: context.isSignedIn,
		error: context.error,
		isError: context.error !== null,
		signIn: context.signIn,
		signUp: context.signUp,
		signOut: context.signOut,
		getToken: context.getToken,
		resetPassword: context.resetPassword,
		verifyEmail: context.verifyEmail,
		resendVerificationEmail: context.resendVerificationEmail,
		forgotPassword: context.forgotPassword,
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

export interface SylphxConfig {
	appId: string
	platformUrl: string
}

export interface UseSylphxReturn extends AuthContextValue {
	/** SDK configuration */
	config: SylphxConfig
	/** Save tokens after SDK-based authentication */
	setTokens: (accessToken: string, refreshToken: string) => void
}

/**
 * Full access to Sylphx context including config
 *
 * Prefer using useUser, useAuth, or useSession for specific needs.
 */
export function useSylphx(): UseSylphxReturn {
	const auth = useAuthContext()
	const platform = usePlatformContextInternal()

	const setTokens = useCallback((accessToken: string, refreshToken: string) => {
		// Store tokens in localStorage using namespaced keys
		const appId = platform.appId
		localStorage.setItem(`sylphx_${appId}_access_token`, accessToken)
		localStorage.setItem(`sylphx_${appId}_refresh_token`, refreshToken)
		// The provider's storage listener will pick this up and update state
		window.dispatchEvent(new StorageEvent('storage', {
			key: `sylphx_${appId}_access_token`,
			newValue: accessToken,
		}))
	}, [platform.appId])

	return {
		...auth,
		config: {
			appId: platform.appId,
			platformUrl: platform.platformUrl,
		},
		setTokens,
	}
}

// ============================================
// useOrganization
// Organization SDK endpoints are not yet available on the platform.
// This hook provides a stable API surface - mutations direct users to Console.
// ============================================

// Import Organization types from types.ts (SSOT)
import type { Organization, OrganizationMember, OrgRole } from '../types'
export type { Organization, OrganizationMember, OrgRole }

/**
 * Return type for useOrganization hook
 *
 * Organization SDK endpoints are not yet available.
 * Organization management is currently only available via the Sylphx Console.
 */
export interface UseOrganizationReturn {
	/** Current organization (if any) - always null in current implementation */
	organization: Organization | null
	/** List of all user's organizations */
	organizations: Organization[]
	/** Members of current organization */
	members: OrganizationMember[]
	/** Whether data is loading */
	isLoading: boolean
	/** User's role in current organization */
	role: OrgRole | null
	/** Check if user has a specific permission */
	hasPermission: (permission: 'manage_members' | 'access_billing' | 'manage_apps' | 'view_analytics') => boolean
	/** Switch to a different organization */
	setOrganization: (orgId: string | null) => void
	/** Create a new organization */
	createOrganization: (data: { name: string; slug: string }) => Promise<Organization>
	/** Invite a member to current organization */
	inviteMember: (email: string, role: OrgRole) => Promise<void>
	/** Update a member's role */
	updateMemberRole: (userId: string, role: OrgRole) => Promise<void>
	/** Remove a member from organization */
	removeMember: (userId: string) => Promise<void>
	/** Refresh organization data */
	refresh: () => Promise<void>
}

/**
 * Hook to manage organizations and RBAC
 *
 * Organization SDK endpoints are not yet available on the platform.
 * Organization management is available via the Sylphx Console.
 *
 * **Current behavior:**
 * - `organization` is always `null`
 * - `organizations` is always `[]`
 * - All mutation methods throw errors directing users to Console
 *
 * @example
 * ```tsx
 * function OrgSettings() {
 *   const { organization, isLoading } = useOrganization()
 *
 *   if (isLoading) return <Spinner />
 *   if (!organization) return <div>Organizations are managed via Console</div>
 *
 *   return <div>{organization.name}</div>
 * }
 * ```
 */
export function useOrganization(): UseOrganizationReturn {
	// Organization SDK endpoints not yet available - management via Console only
	return {
		organization: null,
		organizations: [],
		members: [],
		isLoading: false,
		role: null,
		hasPermission: () => false,
		setOrganization: () => {
			console.warn('[Sylphx] Organization management is not yet available via SDK. Use the Console.')
		},
		createOrganization: async () => {
			throw new Error('Organization management is not yet available via SDK. Use the Sylphx Console.')
		},
		inviteMember: async () => {
			throw new Error('Organization management is not yet available via SDK. Use the Sylphx Console.')
		},
		updateMemberRole: async () => {
			throw new Error('Organization management is not yet available via SDK. Use the Sylphx Console.')
		},
		removeMember: async () => {
			throw new Error('Organization management is not yet available via SDK. Use the Sylphx Console.')
		},
		refresh: async () => {},
	}
}

// Note: useStorage has been moved to storage-hooks.ts
// Import it from there instead:
// import { useStorage } from '@sylphx/platform-sdk/react'
// The storage-hooks.ts version uses proper React Context (StorageContext)
