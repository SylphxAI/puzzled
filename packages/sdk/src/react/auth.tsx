/**
 * Auth Provider
 *
 * Composable authentication provider with hooks.
 * Handles token storage, refresh, and session management.
 */

'use client'

import {
	createContext,
	useContext,
	useCallback,
	useEffect,
	useMemo,
	useState,
	useRef,
	type ReactNode,
} from 'react'
import { useSylphxConfig } from './composable/core'
import {
	signIn as signInFn,
	signOut as signOutFn,
	refreshToken as refreshTokenFn,
	getSession,
	type SignInInput,
	type SignInResult,
} from '../auth'
import { withToken, type SylphxConfig } from '../config'

// ============================================================================
// Types
// ============================================================================

export interface AuthState {
	isLoaded: boolean
	isSignedIn: boolean
	user: {
		id: string
		email: string
		name: string | null
		image: string | null
	} | null
	accessToken: string | null
	refreshToken: string | null
}

interface AuthContextValue extends AuthState {
	signIn: (input: SignInInput) => Promise<SignInResult>
	signOut: () => Promise<void>
	getAuthenticatedConfig: () => SylphxConfig
}

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_PREFIX = 'sylphx_'

function getStorageKey(appId: string, key: string): string {
	return `${STORAGE_PREFIX}${appId}_${key}`
}

// ============================================================================
// Context
// ============================================================================

const AuthContext = createContext<AuthContextValue | null>(null)

// ============================================================================
// Provider
// ============================================================================

interface AuthProviderProps {
	children: ReactNode
	/** URL to redirect to after sign out */
	afterSignOutUrl?: string
}

/**
 * Auth provider with automatic token refresh
 *
 * @example
 * ```tsx
 * <SylphxCore appId="my-app" secretKey={key}>
 *   <AuthProvider>
 *     <App />
 *   </AuthProvider>
 * </SylphxCore>
 * ```
 */
export function AuthProvider({ children, afterSignOutUrl = '/' }: AuthProviderProps) {
	const config = useSylphxConfig()

	const [authState, setAuthState] = useState<AuthState>({
		isLoaded: false,
		isSignedIn: false,
		user: null,
		accessToken: null,
		refreshToken: null,
	})

	const refreshingRef = useRef<Promise<boolean> | null>(null)

	// Storage helpers
	const storage = useMemo(
		() => ({
			get: (key: string) => {
				if (typeof window === 'undefined') return null
				return localStorage.getItem(getStorageKey(config.appId, key))
			},
			set: (key: string, value: string) => {
				if (typeof window === 'undefined') return
				localStorage.setItem(getStorageKey(config.appId, key), value)
			},
			remove: (key: string) => {
				if (typeof window === 'undefined') return
				localStorage.removeItem(getStorageKey(config.appId, key))
			},
		}),
		[config.appId]
	)

	// Save tokens to storage and state
	const saveTokens = useCallback(
		(data: {
			accessToken: string
			refreshToken: string
			expiresIn: number
			user: AuthState['user']
		}) => {
			const expiresAt = Date.now() + data.expiresIn * 1000

			storage.set('access_token', data.accessToken)
			storage.set('refresh_token', data.refreshToken)
			storage.set('expires_at', expiresAt.toString())
			storage.set('user', JSON.stringify(data.user))

			setAuthState({
				isLoaded: true,
				isSignedIn: true,
				user: data.user,
				accessToken: data.accessToken,
				refreshToken: data.refreshToken,
			})
		},
		[storage]
	)

	// Clear tokens
	const clearTokens = useCallback(() => {
		storage.remove('access_token')
		storage.remove('refresh_token')
		storage.remove('expires_at')
		storage.remove('user')

		setAuthState({
			isLoaded: true,
			isSignedIn: false,
			user: null,
			accessToken: null,
			refreshToken: null,
		})
	}, [storage])

	// Refresh tokens
	const refresh = useCallback(
		async (token: string): Promise<boolean> => {
			if (refreshingRef.current) {
				return refreshingRef.current
			}

			const doRefresh = async (): Promise<boolean> => {
				try {
					const result = await refreshTokenFn(config, token)
					saveTokens(result)
					return true
				} catch {
					clearTokens()
					return false
				}
			}

			refreshingRef.current = doRefresh().finally(() => {
				refreshingRef.current = null
			})

			return refreshingRef.current
		},
		[config, saveTokens, clearTokens]
	)

	// Load auth state on mount
	useEffect(() => {
		const loadState = async () => {
			const accessToken = storage.get('access_token')
			const refreshToken = storage.get('refresh_token')
			const expiresAtStr = storage.get('expires_at')
			const userStr = storage.get('user')

			if (accessToken && refreshToken && userStr) {
				const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : 0
				const user = JSON.parse(userStr)

				// Token still valid
				if (expiresAt > Date.now()) {
					setAuthState({
						isLoaded: true,
						isSignedIn: true,
						user,
						accessToken,
						refreshToken,
					})
					return
				}

				// Try to refresh
				await refresh(refreshToken)
				return
			}

			setAuthState({
				isLoaded: true,
				isSignedIn: false,
				user: null,
				accessToken: null,
				refreshToken: null,
			})
		}

		loadState()
	}, [storage, refresh])

	// Auto-refresh before expiry
	useEffect(() => {
		if (!authState.isSignedIn || !authState.refreshToken) return

		const checkAndRefresh = () => {
			const expiresAtStr = storage.get('expires_at')
			const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : 0

			// Refresh if expires within 2 minutes
			const twoMinutes = 2 * 60 * 1000
			if (expiresAt > 0 && expiresAt < Date.now() + twoMinutes) {
				const token = storage.get('refresh_token')
				if (token) refresh(token)
			}
		}

		checkAndRefresh()
		const interval = setInterval(checkAndRefresh, 30 * 1000)
		return () => clearInterval(interval)
	}, [authState.isSignedIn, authState.refreshToken, refresh, storage])

	// Sign in
	const signIn = useCallback(
		async (input: SignInInput): Promise<SignInResult> => {
			const result = await signInFn(config, input)

			if (!result.requiresTwoFactor && result.accessToken) {
				saveTokens({
					accessToken: result.accessToken,
					refreshToken: result.refreshToken!,
					expiresIn: result.expiresIn!,
					user: result.user!,
				})
			}

			return result
		},
		[config, saveTokens]
	)

	// Sign out
	const signOut = useCallback(async () => {
		try {
			const authenticatedConfig = withToken(config, authState.accessToken ?? '')
			await signOutFn(authenticatedConfig)
		} catch {
			// Best effort
		}

		clearTokens()

		if (typeof window !== 'undefined') {
			window.location.href = afterSignOutUrl
		}
	}, [config, authState.accessToken, clearTokens, afterSignOutUrl])

	// Get config with current access token
	const getAuthenticatedConfig = useCallback((): SylphxConfig => {
		if (!authState.accessToken) {
			return config
		}
		return withToken(config, authState.accessToken)
	}, [config, authState.accessToken])

	const value = useMemo(
		() => ({
			...authState,
			signIn,
			signOut,
			getAuthenticatedConfig,
		}),
		[authState, signIn, signOut, getAuthenticatedConfig]
	)

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Full auth context with state and actions
 *
 * @example
 * ```tsx
 * function Profile() {
 *   const { user, isSignedIn, signOut } = useAuth()
 *
 *   if (!isSignedIn) return <SignInButton />
 *   return <p>Welcome, {user.name}!</p>
 * }
 * ```
 */
export function useAuth(): AuthContextValue {
	const context = useContext(AuthContext)
	if (!context) {
		throw new Error('useAuth must be used within an AuthProvider')
	}
	return context
}

/**
 * Just the user (convenience hook)
 *
 * @example
 * ```tsx
 * function Avatar() {
 *   const user = useUser()
 *   return user ? <img src={user.image} /> : null
 * }
 * ```
 */
export function useUser(): AuthState['user'] {
	return useAuth().user
}

/**
 * Sign in action
 *
 * @example
 * ```tsx
 * function LoginForm() {
 *   const signIn = useSignIn()
 *
 *   const handleSubmit = async (e) => {
 *     const result = await signIn({ email, password })
 *     if (result.requiresTwoFactor) {
 *       // Show 2FA form
 *     }
 *   }
 * }
 * ```
 */
export function useSignIn() {
	return useAuth().signIn
}

/**
 * Sign out action
 *
 * @example
 * ```tsx
 * function LogoutButton() {
 *   const signOut = useSignOut()
 *   return <button onClick={signOut}>Sign Out</button>
 * }
 * ```
 */
export function useSignOut() {
	return useAuth().signOut
}

// ============================================================================
// Standalone Auth Hooks (no provider needed)
// ============================================================================

import {
	signUp as signUpFn,
	forgotPassword as forgotPasswordFn,
	resetPassword as resetPasswordFn,
	verifyEmail as verifyEmailFn,
	type SignUpInput,
	type SignUpResult,
} from '../auth'

/**
 * Sign up hook (standalone - no provider needed)
 *
 * @example
 * ```tsx
 * function SignUpForm() {
 *   const { signUp, isLoading, error, result } = useSignUp()
 *
 *   const handleSubmit = async (data) => {
 *     const result = await signUp(data)
 *     if (result.requiresVerification) {
 *       // Show check email message
 *     }
 *   }
 * }
 * ```
 */
export function useSignUp() {
	const config = useSylphxConfig()
	const [state, setState] = useState<{
		isLoading: boolean
		error: Error | null
		result: SignUpResult | null
	}>({
		isLoading: false,
		error: null,
		result: null,
	})

	const signUp = useCallback(
		async (input: SignUpInput): Promise<SignUpResult> => {
			setState({ isLoading: true, error: null, result: null })

			try {
				const result = await signUpFn(config, input)
				setState({ isLoading: false, error: null, result })
				return result
			} catch (e) {
				const error = e instanceof Error ? e : new Error('Sign up failed')
				setState({ isLoading: false, error, result: null })
				throw error
			}
		},
		[config]
	)

	return {
		signUp,
		...state,
	}
}

/**
 * Forgot password hook (standalone - no provider needed)
 *
 * @example
 * ```tsx
 * function ForgotPasswordForm() {
 *   const { sendResetEmail, isLoading, error, success } = useForgotPassword()
 *
 *   const handleSubmit = async (email) => {
 *     await sendResetEmail(email)
 *     // Show success message
 *   }
 * }
 * ```
 */
export function useForgotPassword() {
	const config = useSylphxConfig()
	const [state, setState] = useState<{
		isLoading: boolean
		error: Error | null
		success: boolean
	}>({
		isLoading: false,
		error: null,
		success: false,
	})

	const sendResetEmail = useCallback(
		async (email: string): Promise<void> => {
			setState({ isLoading: true, error: null, success: false })

			try {
				await forgotPasswordFn(config, email)
				setState({ isLoading: false, error: null, success: true })
			} catch (e) {
				const error = e instanceof Error ? e : new Error('Failed to send reset email')
				setState({ isLoading: false, error, success: false })
				throw error
			}
		},
		[config]
	)

	return {
		sendResetEmail,
		...state,
	}
}

/**
 * Reset password hook (standalone - no provider needed)
 *
 * @example
 * ```tsx
 * function ResetPasswordForm({ token }) {
 *   const { resetPassword, isLoading, error, success } = useResetPassword()
 *
 *   const handleSubmit = async (password) => {
 *     await resetPassword(token, password)
 *     // Redirect to login
 *   }
 * }
 * ```
 */
export function useResetPassword() {
	const config = useSylphxConfig()
	const [state, setState] = useState<{
		isLoading: boolean
		error: Error | null
		success: boolean
	}>({
		isLoading: false,
		error: null,
		success: false,
	})

	const resetPassword = useCallback(
		async (token: string, password: string): Promise<void> => {
			setState({ isLoading: true, error: null, success: false })

			try {
				await resetPasswordFn(config, { token, password })
				setState({ isLoading: false, error: null, success: true })
			} catch (e) {
				const error = e instanceof Error ? e : new Error('Password reset failed')
				setState({ isLoading: false, error, success: false })
				throw error
			}
		},
		[config]
	)

	return {
		resetPassword,
		...state,
	}
}

/**
 * Email verification hook (standalone - no provider needed)
 *
 * @example
 * ```tsx
 * function VerifyEmailPage({ token }) {
 *   const { verify, isLoading, error, verified } = useVerifyEmail()
 *
 *   useEffect(() => {
 *     verify(token)
 *   }, [token])
 *
 *   if (isLoading) return <Spinner />
 *   if (error) return <Error message={error.message} />
 *   if (verified) return <Success />
 * }
 * ```
 */
export function useVerifyEmail() {
	const config = useSylphxConfig()
	const [state, setState] = useState<{
		isLoading: boolean
		error: Error | null
		verified: boolean
	}>({
		isLoading: false,
		error: null,
		verified: false,
	})

	const verify = useCallback(
		async (token: string): Promise<void> => {
			setState({ isLoading: true, error: null, verified: false })

			try {
				await verifyEmailFn(config, token)
				setState({ isLoading: false, error: null, verified: true })
			} catch (e) {
				const error = e instanceof Error ? e : new Error('Email verification failed')
				setState({ isLoading: false, error, verified: false })
				throw error
			}
		},
		[config]
	)

	return {
		verify,
		...state,
	}
}
