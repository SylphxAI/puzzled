'use client'

import { ArrowLeft, Shield } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo } from 'react'
// Import admin theme CSS (scoped to .admin-theme class, safe to always include)
import '@/features/admin/admin.css'

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

	const redirectUrl = searchParams.get('redirect') || '/'
	const theme = searchParams.get('theme')
	const isAdminTheme = theme === 'admin'

	// Authentication challenges are handled by the Sylphx Platform.
	// This page redirects to the target URL since the platform handles MFA verification.
	useEffect(() => {
		router.replace(redirectUrl)
	}, [router, redirectUrl])

	const { title, description } = useMemo(
		() => ({
			title: 'Redirecting...',
			description: 'Authentication is being handled by the platform.',
		}),
		[],
	)

	// ==================
	// Render (shown briefly while redirecting)
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
						<h1 className="text-xl font-semibold text-[var(--admin-text-primary)]">{title}</h1>
						<p className="mt-2 text-sm text-[var(--admin-text-secondary)]">{description}</p>
					</div>

					{/* Loading indicator */}
					<div className="flex justify-center">
						<div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--admin-primary)] border-t-transparent" />
					</div>

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
					<h1 className="text-xl font-semibold">{title}</h1>
					<p className="mt-2 text-sm text-muted-foreground">{description}</p>
				</div>

				{/* Loading indicator */}
				<div className="flex justify-center">
					<div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
				</div>

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
 * Challenge Page (Legacy)
 *
 * This page previously handled step-up authentication (MFA/identity verification).
 * Authentication challenges are now handled by the platform SDK.
 *
 * This page now simply redirects to the target URL since the platform
 * handles all authentication challenges.
 *
 * Query Parameters:
 * - redirect: URL to redirect to (default: '/')
 * - theme: 'admin' for admin panel styling (default: 'default')
 */
export default function ChallengePage() {
	return (
		<Suspense fallback={<ChallengePageSkeleton />}>
			<ChallengePageContent />
		</Suspense>
	)
}
