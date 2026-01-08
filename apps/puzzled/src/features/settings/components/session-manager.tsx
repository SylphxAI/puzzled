'use client'

import { formatDistanceToNow } from 'date-fns'
import { Clock, Globe, Loader2, LogOut, Shield } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Badge, Button, Skeleton, useAlertDialog, useToast } from '@/shared/components/ui'
import { trpc } from '@/trpc/client'
import { DeviceIcon } from './device-icon'

/**
 * Session list skeleton loader
 */
function SessionSkeleton() {
	return (
		<div className="space-y-3">
			{[1, 2, 3].map((i) => (
				<div key={i} className="flex items-center justify-between rounded-lg border p-4">
					<div className="flex items-center gap-4">
						<Skeleton className="h-10 w-10 rounded-full" />
						<div className="space-y-2">
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-3 w-48" />
						</div>
					</div>
					<Skeleton className="h-8 w-20" />
				</div>
			))}
		</div>
	)
}

/**
 * SessionManager Component
 *
 * Displays and manages user's active sessions with the ability to:
 * - View all active sessions with device/browser/location info
 * - Revoke individual sessions
 * - Revoke all other sessions at once
 */
export function SessionManager() {
	const t = useTranslations('settings.sessions')
	const toastApi = useToast()
	const { showAlert, AlertDialog: AlertDialogComponent } = useAlertDialog()

	const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null)
	const [revokingAll, setRevokingAll] = useState(false)

	// Fetch active sessions
	const {
		data: sessions,
		isLoading,
		error,
		refetch,
	} = trpc.security.getActiveSessions.useQuery(undefined, {
		staleTime: 30000, // 30 seconds
	})

	// Revoke single session mutation
	const revokeSession = trpc.security.revokeSession.useMutation({
		onSuccess: () => {
			toastApi.success(t('sessionRevoked'), t('sessionRevokedDescription'))
			refetch()
		},
		onError: (err) => {
			toastApi.error(t('revokeError'), err.message)
		},
		onSettled: () => {
			setRevokingSessionId(null)
		},
	})

	// Revoke all other sessions mutation
	const revokeAllOther = trpc.security.revokeAllOtherSessions.useMutation({
		onSuccess: (data) => {
			toastApi.success(
				t('allSessionsRevoked'),
				t('allSessionsRevokedDescription', { count: data.revokedCount }),
			)
			refetch()
		},
		onError: (err) => {
			toastApi.error(t('revokeAllError'), err.message)
		},
		onSettled: () => {
			setRevokingAll(false)
		},
	})

	const handleRevokeSession = (sessionId: string) => {
		showAlert({
			title: t('confirmRevoke'),
			description: t('confirmRevokeDescription'),
			confirmLabel: t('signOut'),
			cancelLabel: t('cancel'),
			variant: 'destructive',
			onConfirm: () => {
				setRevokingSessionId(sessionId)
				revokeSession.mutate({ sessionId })
			},
		})
	}

	const handleRevokeAllOther = () => {
		const otherCount = sessions?.filter((s) => !s.isCurrent).length ?? 0
		showAlert({
			title: t('confirmRevokeAll'),
			description: t('confirmRevokeAllDescription', { count: otherCount }),
			confirmLabel: t('signOutAll'),
			cancelLabel: t('cancel'),
			variant: 'destructive',
			onConfirm: () => {
				setRevokingAll(true)
				revokeAllOther.mutate()
			},
		})
	}

	// Loading state
	if (isLoading) {
		return <SessionSkeleton />
	}

	// Error state
	if (error) {
		return (
			<div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
				<p className="text-sm text-destructive">{t('fetchError')}</p>
				<Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
					{t('retry')}
				</Button>
			</div>
		)
	}

	// Empty state
	if (!sessions || sessions.length === 0) {
		return <p className="py-4 text-center text-sm text-muted-foreground">{t('noSessions')}</p>
	}

	const otherSessions = sessions.filter((s) => !s.isCurrent)

	return (
		<div className="space-y-4">
			{AlertDialogComponent}

			{/* Session List */}
			<div className="space-y-3">
				{sessions.map((session) => (
					<div
						key={session.id}
						className={cn(
							'flex items-start justify-between rounded-lg border p-4 transition-colors',
							session.isCurrent && 'border-primary/50 bg-primary/5',
						)}
					>
						<div className="flex items-start gap-4">
							{/* Device Icon */}
							<div
								className={cn(
									'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
									session.isCurrent
										? 'bg-primary/10 text-primary'
										: 'bg-muted text-muted-foreground',
								)}
							>
								<DeviceIcon type={session.device.type} />
							</div>

							{/* Session Details */}
							<div className="min-w-0 flex-1">
								<div className="flex flex-wrap items-center gap-2">
									<p className="truncate font-medium">
										{session.browser.name}
										{session.browser.version && ` ${session.browser.version}`}
									</p>
									{session.isCurrent && (
										<Badge variant="default" className="shrink-0 text-xs">
											{t('currentSession')}
										</Badge>
									)}
								</div>

								{/* OS and Device */}
								<p className="mt-0.5 truncate text-sm text-muted-foreground">
									{session.os.name}
									{session.os.version && ` ${session.os.version}`}
									{session.device.type !== 'unknown' && ` (${session.device.name})`}
								</p>

								{/* Meta info */}
								<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
									{/* IP Address */}
									<span className="flex items-center gap-1">
										<Globe className="h-3 w-3" />
										{session.maskedIp}
									</span>

									{/* Last Active */}
									<span className="flex items-center gap-1">
										<Clock className="h-3 w-3" />
										{t('lastActive', {
											time: formatDistanceToNow(new Date(session.updatedAt), {
												addSuffix: true,
											}),
										})}
									</span>
								</div>
							</div>
						</div>

						{/* Actions */}
						{!session.isCurrent && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => handleRevokeSession(session.id)}
								disabled={revokingSessionId === session.id}
								className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
								aria-label={t('signOut')}
							>
								{revokingSessionId === session.id ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<LogOut className="h-4 w-4" />
								)}
								<span className="ml-2 hidden sm:inline">{t('signOut')}</span>
							</Button>
						)}
					</div>
				))}
			</div>

			{/* Revoke All Other Sessions */}
			{otherSessions.length > 0 && (
				<div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-4">
					<div className="flex items-center gap-3">
						<Shield className="h-5 w-5 shrink-0 text-destructive" />
						<div className="min-w-0">
							<p className="font-medium text-destructive">{t('signOutAllOther')}</p>
							<p className="text-sm text-muted-foreground">
								{t('signOutAllOtherDescription', { count: otherSessions.length })}
							</p>
						</div>
					</div>
					<Button
						variant="destructive"
						size="sm"
						onClick={handleRevokeAllOther}
						disabled={revokingAll}
						className="shrink-0"
					>
						{revokingAll ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<LogOut className="mr-2 h-4 w-4" />
						)}
						{t('signOutAll')}
					</Button>
				</div>
			)}
		</div>
	)
}
