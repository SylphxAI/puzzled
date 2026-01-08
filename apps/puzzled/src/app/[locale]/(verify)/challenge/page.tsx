'use client'

import { ArrowLeft, Shield } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useMemo } from 'react'
import { ChallengeForm, type ChallengeRequirement } from '@/features/auth/components'
// Import admin theme CSS (scoped to .admin-theme class, safe to always include)
import '@/features/admin/admin.css'

// ==================
// Types
// ==================

const VALID_REQUIREMENTS = ['identity', 'mfa', 'both'] as const

// ==================
// Loading Fallback
// ==================

function ChallengePageSkeleton() {
	return (
		<div className="flex min-h-screen items-center justify-center p-4 bg-background">
			<div className="mx-auto w-full max-w-md rounded-xl border bg-card p-8 shadow-sm animate-pulse">
				<div className="mb-6 text-center">
					<div className="mx-auto mb-4 h-14 w-14 rounded-full bg-muted" />
					<div className="mx-auto h-6 w-48 rounded bg-muted" />
					<div className="mx-auto mt-2 h-4 w-64 rounded bg-muted" />
				</div>
				<div className="space-y-4">
					<div className="h-10 rounded bg-muted" />
					<div className="h-10 rounded bg-muted" />
				</div>
			</div>
		</div>
	)
}

// ==================
// Inner Component (uses searchParams)
// ==================

function ChallengePageContent() {
	const router = useRouter()
	const searchParams = useSearchParams()

	// Parse query parameters
	const require = useMemo(() => {
		const param = searchParams.get('require')
		if (param && VALID_REQUIREMENTS.includes(param as ChallengeRequirement)) {
			return param as ChallengeRequirement
		}
		return 'mfa' as ChallengeRequirement
	}, [searchParams])

	const redirectUrl = searchParams.get('redirect') || '/'
	const theme = searchParams.get('theme')
	const isAdminTheme = theme === 'admin'

	// Compute UI text based on requirement
	const { title, description } = useMemo(() => {
		switch (require) {
			case 'both':
				return {
					title: 'Security Verification Required',
					description: 'This action requires additional security verification.',
				}
			case 'identity':
				return {
					title: 'Confirm Your Identity',
					description: 'Please verify your identity to continue.',
				}
			case 'mfa':
			default:
				return {
					title: 'Verify Your Identity',
					description: 'Enter your authenticator code to continue.',
				}
		}
	}, [require])

	// Handle successful verification
	const handleSuccess = useCallback(() => {
		router.push(redirectUrl)
		router.refresh()
	}, [router, redirectUrl])

	// Handle cancel (go back)
	const handleCancel = useCallback(() => {
		router.back()
	}, [router])

	// ==================
	// Render
	// ==================

	if (isAdminTheme) {
		return (
			<div className="admin-theme flex min-h-screen items-center justify-center p-4">
				<div className="admin-card mx-auto w-full max-w-md p-8">
					{/* Header */}
					<div className="mb-6 text-center">
						<div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--admin-primary)]/10">
							<Shield className="h-7 w-7 text-[var(--admin-primary)]" />
						</div>
						<h1 className="text-xl font-semibold text-[var(--admin-text-primary)]">
							{title}
						</h1>
						<p className="mt-2 text-sm text-[var(--admin-text-secondary)]">
							{description}
						</p>
					</div>

					{/* Challenge Form */}
					<ChallengeForm
						require={require}
						onSuccess={handleSuccess}
						onCancel={handleCancel}
						showCancel={false}
						autoFocus
					/>

					{/* Back link */}
					<div className="mt-6 border-t border-[var(--admin-border)] pt-6">
						<Link
							href="/"
							className="flex items-center justify-center gap-2 text-sm text-[var(--admin-text-muted)] hover:text-[var(--admin-text-secondary)]"
						>
							<ArrowLeft className="h-4 w-4" />
							Back to app
						</Link>
					</div>
				</div>
			</div>
		)
	}

	// Default theme
	return (
		<div className="flex min-h-screen items-center justify-center p-4 bg-background">
			<div className="mx-auto w-full max-w-md rounded-xl border bg-card p-8 shadow-sm">
				{/* Header */}
				<div className="mb-6 text-center">
					<div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
						<Shield className="h-7 w-7 text-primary" />
					</div>
					<h1 className="text-xl font-semibold">
						{title}
					</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						{description}
					</p>
				</div>

				{/* Challenge Form */}
				<ChallengeForm
					require={require}
					onSuccess={handleSuccess}
					onCancel={handleCancel}
					showCancel={false}
					autoFocus
				/>

				{/* Back link */}
				<div className="mt-6 border-t pt-6">
					<Link
						href="/"
						className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
					>
						<ArrowLeft className="h-4 w-4" />
						Back to app
					</Link>
				</div>
			</div>
		</div>
	)
}

// ==================
// Page Export (with Suspense boundary)
// ==================

/**
 * Unified Challenge Page
 *
 * Central step-up authentication page for server-side redirects.
 * Uses query parameters to configure behavior:
 *
 * @example
 * /challenge?require=mfa&redirect=/admin
 * /challenge?require=identity&redirect=/settings/security
 * /challenge?require=both&redirect=/settings/danger-zone
 *
 * Query Parameters:
 * - require: 'identity' | 'mfa' | 'both' (default: 'mfa')
 * - redirect: URL to redirect to on success (default: '/')
 * - theme: 'admin' for admin panel styling (default: 'default')
 *
 * For client-side operations, use ChallengeDialog instead.
 */
export default function ChallengePage() {
	return (
		<Suspense fallback={<ChallengePageSkeleton />}>
			<ChallengePageContent />
		</Suspense>
	)
}
