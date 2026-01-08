'use client'

import { Gamepad2, Link2, Loader2, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useState } from 'react'
import { authClient, ChallengeDialog, useChallenge } from '@/features/auth'
import { cn } from '@/lib/utils'
import { Badge, Progress } from '@sylphx/ui'
import { trpc } from '@/trpc/client'
import { PROVIDER_CONFIG, ProviderCard } from './provider-card'

type ProviderKey = keyof typeof PROVIDER_CONFIG

/**
 * OAuth account with per-provider permissions from SSOT (auth-state.ts)
 */
interface OAuthAccount {
	id: string
	provider: string
	accountId: string
	connectedAt: Date
	canDisconnect: boolean
	disconnectBlockedReason: string | null
}

export function ConnectedAccounts() {
	const t = useTranslations('settings.connectedAccounts')
	const [error, setError] = useState('')

	// tRPC utils for cache invalidation
	const utils = trpc.useUtils()

	// Challenge for sensitive operations (identity verification)
	const {
		verify,
		showDialog,
		onSuccess: onChallengeSuccess,
		onCancel: onChallengeCancel,
		isVerified,
	} = useChallenge('identity')

	// Pending action state for challenge flow
	const [pendingAction, setPendingAction] = useState<{
		type: 'connect' | 'disconnect'
		provider?: ProviderKey
		accountId?: string
	} | null>(null)

	// Fetch connected accounts and enabled providers via tRPC
	const { data: accountsData, isLoading: accountsLoading } =
		trpc.account.getConnectedAccounts.useQuery()
	const { data: enabledProviders, isLoading: providersLoading } =
		trpc.account.getEnabledProviders.useQuery()

	const isLoading = accountsLoading || providersLoading

	// Invalidate connected accounts cache (used after connect/disconnect)
	const invalidateConnectedAccounts = useCallback(() => {
		utils.account.getConnectedAccounts.invalidate()
	}, [utils])

	// Disconnect mutation
	const disconnectMutation = trpc.account.disconnectAccount.useMutation({
		onSuccess: () => {
			invalidateConnectedAccounts()
		},
		onError: (err) => {
			setError(err.message)
		},
	})

	// Execute connect action after identity verification
	// Note: linkSocial redirects to OAuth provider, then back to callbackURL
	// Cache is fresh on return since it's a full page load
	const executeConnect = useCallback(
		async (provider: ProviderKey) => {
			setError('')
			try {
				await authClient.linkSocial({
					provider,
					callbackURL: '/settings/account',
				})
				// No need for router.refresh() - OAuth redirects away and back with fresh page load
			} catch (_err) {
				setError(t('connectError', { provider }))
			}
		},
		[t],
	)

	// Execute disconnect action after identity verification
	const executeDisconnect = useCallback(
		async (accountId: string) => {
			setError('')
			await disconnectMutation.mutateAsync({ accountId })
		},
		[disconnectMutation],
	)

	// Handle challenge success - execute pending action
	const handleChallengeSuccess = useCallback(() => {
		onChallengeSuccess()
		if (pendingAction) {
			if (pendingAction.type === 'connect' && pendingAction.provider) {
				executeConnect(pendingAction.provider)
			} else if (pendingAction.type === 'disconnect' && pendingAction.accountId) {
				executeDisconnect(pendingAction.accountId)
			}
		}
		setPendingAction(null)
	}, [onChallengeSuccess, pendingAction, executeConnect, executeDisconnect])

	// Handle challenge cancel
	const handleChallengeCancel = useCallback(() => {
		onChallengeCancel()
		setPendingAction(null)
	}, [onChallengeCancel])

	// Connect with identity verification check
	const handleConnect = async (provider: ProviderKey) => {
		if (isVerified) {
			await executeConnect(provider)
			return
		}
		setPendingAction({ type: 'connect', provider })
		verify()
	}

	// Disconnect with identity verification check
	const handleDisconnect = async (accountId: string) => {
		if (isVerified) {
			await executeDisconnect(accountId)
			return
		}
		setPendingAction({ type: 'disconnect', accountId })
		verify()
	}

	if (isLoading || !enabledProviders || !accountsData) {
		return (
			<div className="flex flex-col items-center justify-center gap-3 py-12">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
				<p className="text-sm text-muted-foreground">{t('loading')}</p>
			</div>
		)
	}

	// Get list of actually enabled providers from backend
	// Only show providers that: 1) are enabled in env, 2) have UI config
	const enabledProviderKeys = Object.entries(enabledProviders)
		.filter(([key, enabled]) => enabled && key in PROVIDER_CONFIG)
		.map(([key]) => key as ProviderKey)

	// Map connected accounts with full data (including per-provider permissions from SSOT)
	const connectedProviders = new Map<string, OAuthAccount>(
		accountsData.oauthAccounts.map((account: OAuthAccount) => [account.provider, account]),
	)

	// Check if any provider can be disconnected (for summary warning)
	const anyCanDisconnect = accountsData.oauthAccounts.some((a: OAuthAccount) => a.canDisconnect)

	// Count connected providers
	const connectedCount = accountsData.oauthAccounts.length
	const totalProviders = enabledProviderKeys.length
	const connectionProgress = (connectedCount / Math.max(totalProviders, 1)) * 100

	// Group enabled providers by category (derived from PROVIDER_CONFIG)
	const categoryConfig = {
		primary: { label: t('categories.primary'), icon: <ShieldCheck className="h-4 w-4" /> },
		gaming: { label: t('categories.gaming'), icon: <Gamepad2 className="h-4 w-4" /> },
		social: { label: t('categories.social'), icon: <Users className="h-4 w-4" /> },
		developer: { label: t('categories.social'), icon: <Users className="h-4 w-4" /> }, // Group with social
	} as const

	// Build categories dynamically from enabled providers
	const categoryProviders = new Map<string, ProviderKey[]>()
	for (const provider of enabledProviderKeys) {
		const category = PROVIDER_CONFIG[provider].category
		// Map 'developer' to 'social' for display grouping
		const displayCategory = category === 'developer' ? 'social' : category
		if (!categoryProviders.has(displayCategory)) {
			categoryProviders.set(displayCategory, [])
		}
		categoryProviders.get(displayCategory)!.push(provider)
	}

	// Convert to array with config, maintaining order
	const categoryOrder = ['primary', 'gaming', 'social'] as const
	const categories = categoryOrder
		.filter((key) => categoryProviders.has(key))
		.map((key) => ({
			key,
			...categoryConfig[key],
			providers: categoryProviders.get(key)!,
		}))

	return (
		<div className="space-y-6">
			{/* Connection Summary Card */}
			<div className="rounded-xl border bg-gradient-to-br from-background to-muted/30 p-4">
				<div className="flex items-start justify-between">
					<div className="space-y-1">
						<div className="flex items-center gap-2">
							<Link2 className="h-5 w-5 text-primary" />
							<h3 className="font-semibold">{t('title')}</h3>
						</div>
						<p className="text-sm text-muted-foreground">
							{t('summary', { connected: connectedCount, total: totalProviders })}
						</p>
					</div>
					{connectedCount >= 2 ? (
						<Badge variant="success" className="gap-1.5">
							<ShieldCheck className="h-3.5 w-3.5" />
							{t('secured')}
						</Badge>
					) : (
						<Badge
							variant="outline"
							className="gap-1.5 text-yellow-600 border-yellow-300 dark:border-yellow-800"
						>
							<Sparkles className="h-3.5 w-3.5" />
							{t('addMore')}
						</Badge>
					)}
				</div>

				{/* Progress bar */}
				<div className="mt-4 space-y-2">
					<div className="flex justify-between text-xs">
						<span className="text-muted-foreground">{t('connectionStrength')}</span>
						<span
							className={cn(
								'font-medium',
								connectionProgress >= 66
									? 'text-success'
									: connectionProgress >= 33
										? 'text-yellow-600'
										: 'text-muted-foreground',
							)}
						>
							{Math.round(connectionProgress)}%
						</span>
					</div>
					<Progress value={connectionProgress} className="h-2" />
				</div>
			</div>

			{error && (
				<div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
			)}

			{!anyCanDisconnect && connectedCount > 0 && (
				<div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 text-sm text-yellow-700 dark:text-yellow-400">
					{accountsData.hasPassword ? t('lastAccountWarning') : t('noPasswordWarning')}
				</div>
			)}

			{/* Provider Categories */}
			{categories.map((category) => (
				<div key={category.key} className="space-y-3">
					<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
						{category.icon}
						<span>{category.label}</span>
					</div>
					<div className="space-y-2">
						{category.providers.map((provider) => {
							const connection = connectedProviders.get(provider)
							return (
								<ProviderCard
									key={provider}
									provider={provider}
									connected={!!connection}
									accountId={connection?.id}
									connectedAt={connection?.connectedAt}
									// Per-provider permission from SSOT (not global)
									canDisconnect={connection?.canDisconnect ?? false}
									disconnectBlockedReason={connection?.disconnectBlockedReason}
									onConnect={handleConnect}
									onDisconnect={handleDisconnect}
								/>
							)
						})}
					</div>
				</div>
			))}

			{/* Help Text */}
			<div className="rounded-lg border border-dashed p-4 text-center">
				<p className="text-sm text-muted-foreground">{t('helpText')}</p>
				<p className="mt-1 text-xs text-muted-foreground/70">{t('securityTip')}</p>
			</div>

			{/* ChallengeDialog for identity verification */}
			<ChallengeDialog
				open={showDialog}
				require="identity"
				onSuccess={handleChallengeSuccess}
				onCancel={handleChallengeCancel}
				title={t('verifyIdentity')}
				description={t('verifyIdentityDescription')}
			/>
		</div>
	)
}
