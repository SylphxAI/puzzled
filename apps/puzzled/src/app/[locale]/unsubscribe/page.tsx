'use client'

import { CheckCircle, Loader2, Mail, XCircle } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { Link } from '@/lib/i18n/routing'
import { Button, GamepadIcon } from '@sylphx/ui'

type UnsubscribeState = 'loading' | 'success' | 'error' | 'idle'

export default function UnsubscribePage() {
	return (
		<Suspense
			fallback={
				<div className="flex min-h-screen flex-col items-center justify-center px-4">
					<Loader2 className="h-8 w-8 animate-spin text-primary" />
				</div>
			}
		>
			<UnsubscribeContent />
		</Suspense>
	)
}

function UnsubscribeContent() {
	const searchParams = useSearchParams()
	const success = searchParams.get('success')
	const error = searchParams.get('error')
	const token = searchParams.get('token')

	const [state, setState] = useState<UnsubscribeState>('idle')
	const [errorMessage, setErrorMessage] = useState('')

	// Handle redirect results from GET endpoint or POST-based unsubscribe
	useEffect(() => {
		const handleUnsubscribe = async (unsubToken: string) => {
			setState('loading')
			try {
				const response = await fetch('/api/email/unsubscribe', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ token: unsubToken }),
				})

				const data = await response.json()

				if (response.ok) {
					setState('success')
				} else {
					setState('error')
					setErrorMessage(data.error || 'Failed to unsubscribe')
				}
			} catch {
				setState('error')
				setErrorMessage('Network error. Please try again.')
			}
		}

		if (success === 'true') {
			setState('success')
		} else if (error) {
			setState('error')
			switch (error) {
				case 'missing_token':
					setErrorMessage('No unsubscribe token provided.')
					break
				case 'invalid_token':
					setErrorMessage('Invalid or expired unsubscribe link.')
					break
				case 'not_found':
					setErrorMessage('User not found.')
					break
				default:
					setErrorMessage('Failed to unsubscribe. Please try again.')
			}
		} else if (token) {
			// Handle POST-based unsubscribe
			handleUnsubscribe(token)
		}
	}, [success, error, token])

	return (
		<div className="flex min-h-screen flex-col items-center justify-center px-4">
			<div className="w-full max-w-sm space-y-6 text-center">
				{/* Logo */}
				<div>
					<h1 className="mb-2 flex items-center justify-center gap-2 text-2xl font-bold">
						<GamepadIcon size={28} className="text-primary" />
						Puzzled
					</h1>
				</div>

				{/* Loading State */}
				{state === 'loading' && (
					<div className="space-y-4">
						<Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
						<p className="text-muted-foreground">Processing your request...</p>
					</div>
				)}

				{/* Success State */}
				{state === 'success' && (
					<div className="space-y-4">
						<CheckCircle className="mx-auto h-12 w-12 text-correct" />
						<div>
							<h2 className="text-xl font-semibold">Unsubscribed Successfully</h2>
							<p className="text-muted-foreground">
								You've been unsubscribed from marketing emails. You'll still receive important
								account notifications.
							</p>
						</div>
						<Link href="/">
							<Button className="w-full">Return to Puzzled</Button>
						</Link>
					</div>
				)}

				{/* Error State */}
				{state === 'error' && (
					<div className="space-y-4">
						<XCircle className="mx-auto h-12 w-12 text-wrong" />
						<div>
							<h2 className="text-xl font-semibold">Unsubscribe Failed</h2>
							<p className="text-muted-foreground">{errorMessage}</p>
						</div>
						<div className="space-y-2">
							<Link href="/settings">
								<Button className="w-full">Manage Email Preferences</Button>
							</Link>
							<Link href="/">
								<Button variant="outline" className="w-full">
									Return to Puzzled
								</Button>
							</Link>
						</div>
					</div>
				)}

				{/* Idle State (no token provided) */}
				{state === 'idle' && !token && !success && !error && (
					<div className="space-y-4">
						<Mail className="mx-auto h-12 w-12 text-primary" />
						<div>
							<h2 className="text-xl font-semibold">Email Preferences</h2>
							<p className="text-muted-foreground">
								To manage your email preferences, please use the unsubscribe link in any of our
								emails or visit your account settings.
							</p>
						</div>
						<div className="space-y-2">
							<Link href="/settings">
								<Button className="w-full">Go to Settings</Button>
							</Link>
							<Link href="/">
								<Button variant="outline" className="w-full">
									Return to Puzzled
								</Button>
							</Link>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
