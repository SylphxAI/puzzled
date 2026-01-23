/**
 * Protected Route Components
 *
 * Conditionally render content based on auth state.
 */

'use client'

import { useSafeUser } from './hooks'
import { safeRedirect } from './security-utils'

interface ChildrenProps {
	children: React.ReactNode
}

/**
 * Only renders children when user is signed in
 *
 * @example
 * ```tsx
 * <SignedIn>
 *   <UserButton />
 *   <Link href="/dashboard">Dashboard</Link>
 * </SignedIn>
 * ```
 */
export function SignedIn({ children }: ChildrenProps) {
	const { isConfigured, isLoaded, isSignedIn } = useSafeUser()

	// Gracefully handle unconfigured SDK
	if (!isConfigured || !isLoaded || !isSignedIn) {
		return null
	}

	return <>{children}</>
}

/**
 * Only renders children when user is NOT signed in
 *
 * @example
 * ```tsx
 * <SignedOut>
 *   <Link href="/login">Sign In</Link>
 *   <Link href="/signup">Sign Up</Link>
 * </SignedOut>
 * ```
 */
export function SignedOut({ children }: ChildrenProps) {
	const { isConfigured, isLoaded, isSignedIn } = useSafeUser()

	// Gracefully handle unconfigured SDK - show SignedOut content
	if (!isConfigured) {
		return <>{children}</>
	}

	if (!isLoaded || isSignedIn) {
		return null
	}

	return <>{children}</>
}

interface ProtectedRouteProps extends ChildrenProps {
	/** URL to redirect to if not authenticated */
	redirectTo?: string
	/** Content to show while loading auth state */
	fallback?: React.ReactNode
}

/**
 * Redirects to login if user is not authenticated
 *
 * @example
 * ```tsx
 * <ProtectedRoute redirectTo="/login">
 *   <Dashboard />
 * </ProtectedRoute>
 * ```
 */
export function ProtectedRoute({
	children,
	redirectTo = '/login',
	fallback = null,
}: ProtectedRouteProps) {
	const { isConfigured, isLoaded, isSignedIn } = useSafeUser()

	// Gracefully handle unconfigured SDK - render children (dev experience)
	if (!isConfigured) {
		return <>{children}</>
	}

	if (!isLoaded) {
		return <>{fallback}</>
	}

	if (!isSignedIn) {
		// Client-side redirect (use safeRedirect to prevent XSS)
		safeRedirect(redirectTo, { fallback: '/login' })
		return <>{fallback}</>
	}

	return <>{children}</>
}

interface AuthLoadingProps extends ChildrenProps {
	/** Content to show when auth is loading */
	loading?: React.ReactNode
}

/**
 * Shows loading content while auth state is being determined
 *
 * @example
 * ```tsx
 * <AuthLoading loading={<Spinner />}>
 *   <App />
 * </AuthLoading>
 * ```
 */
export function AuthLoading({ children, loading = null }: AuthLoadingProps) {
	const { isConfigured, isLoaded } = useSafeUser()

	// Gracefully handle unconfigured SDK - render children
	if (!isConfigured) {
		return <>{children}</>
	}

	if (!isLoaded) {
		return <>{loading}</>
	}

	return <>{children}</>
}
