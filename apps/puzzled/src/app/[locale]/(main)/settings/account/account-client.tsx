'use client'

import { Button, ConfirmDialog } from '@sylphx/ui'
import { BadgeCheck, ExternalLink, LogOut, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { ConsoleCard, ConsoleHeader } from '@/features/console/components/console-chrome'
import { deleteAccountData } from '@/lib/connect/preferences-client'
import { accountPortalAnchor, accountPortalLink } from '@/lib/identity/account-portal'
import { useSafeAuth, useSafeUser } from '@/lib/identity/react'

/** Auth's Account Portal on the app domain, or the in-app support page. */
const ACCOUNT_PORTAL = accountPortalLink()

function initials(value: string): string {
	const words = value.trim().split(/\s+/).slice(0, 2)
	return words.map((word) => word[0]?.toUpperCase() ?? '').join('') || '?'
}

/**
 * Account section.
 *
 * The session the page already verified supplies the identity; email, password
 * and sign-in method changes stay with the account authority, which this
 * surface links to instead of pretending to own them.
 */
export function AccountSettingsContent() {
	const t = useTranslations('settings')
	const { user, isLoading } = useSafeUser()
	const { signOut } = useSafeAuth()
	const [signingOut, setSigningOut] = useState(false)
	const [confirmingDelete, setConfirmingDelete] = useState(false)
	const [deleting, setDeleting] = useState(false)
	const [deleteFailed, setDeleteFailed] = useState(false)

	const displayName = user?.name?.trim() || t('playerCard.nameFallback')

	async function handleSignOut() {
		setSigningOut(true)
		try {
			await signOut()
			window.location.href = '/'
		} finally {
			setSigningOut(false)
		}
	}

	async function handleDelete() {
		setDeleting(true)
		setDeleteFailed(false)
		try {
			await deleteAccountData()
			await signOut()
			window.location.href = '/'
		} catch {
			setDeleteFailed(true)
			setDeleting(false)
		}
	}

	return (
		<>
			<ConsoleHeader
				headingLevel={2}
				title={t('account.title')}
				description={t('account.description')}
			/>

			<ConsoleCard
				title={t('account.signedInTitle')}
				description={t('account.signedInDescription')}
			>
				{isLoading ? (
					<p className="text-sm text-muted-foreground">{t('account.loading')}</p>
				) : user ? (
					<div className="flex items-start gap-4">
						<span
							className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 font-display text-base font-extrabold text-primary"
							aria-hidden="true"
						>
							{initials(displayName)}
						</span>
						<div className="min-w-0">
							<p className="font-semibold">{displayName}</p>
							{user.email ? (
								<p className="mt-0.5 truncate text-sm text-muted-foreground">{user.email}</p>
							) : null}
							{user.emailVerified ? (
								<span className="chip mt-2 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
									<BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
									{t('playerCard.verified')}
								</span>
							) : null}
						</div>
					</div>
				) : (
					<p className="text-sm text-muted-foreground">{t('account.signedOut')}</p>
				)}
			</ConsoleCard>

			<ConsoleCard
				title={t('account.centreTitle')}
				description={t('account.centreDescription')}
				actions={
					<Button asChild variant="outline" className="min-h-11 gap-2">
						<a {...accountPortalAnchor(ACCOUNT_PORTAL)}>
							{t('account.centreCta')}
							{ACCOUNT_PORTAL.external ? (
								<ExternalLink className="h-4 w-4" aria-hidden="true" />
							) : null}
						</a>
					</Button>
				}
			>
				<ul className="space-y-1.5 text-sm text-muted-foreground">
					<li>{t('account.centreEmail')}</li>
					<li>{t('account.centrePassword')}</li>
					<li>{t('account.centreDeletion')}</li>
				</ul>
				{ACCOUNT_PORTAL.external ? (
					<p className="mt-3 text-xs leading-relaxed text-muted-foreground">
						{t('account.centreNote')}
					</p>
				) : null}
			</ConsoleCard>

			<ConsoleCard title={t('account.signOutTitle')} description={t('account.signOutDescription')}>
				<Button
					variant="destructive"
					onClick={handleSignOut}
					disabled={signingOut}
					className="min-h-11 gap-2"
				>
					<LogOut className="h-4 w-4" aria-hidden="true" />
					{signingOut ? t('account.signingOut') : t('account.signOut')}
				</Button>
			</ConsoleCard>

			{user ? (
				<ConsoleCard title={t('account.deleteTitle')} description={t('account.deleteDescription')}>
					<Button
						variant="destructive"
						onClick={() => setConfirmingDelete(true)}
						disabled={deleting}
						className="min-h-11 gap-2"
					>
						<Trash2 className="h-4 w-4" aria-hidden="true" />
						{deleting ? t('account.deleting') : t('account.deleteCta')}
					</Button>
					{deleteFailed ? (
						<p role="alert" className="mt-3 text-sm text-destructive">
							{t('account.deleteFailed')}
						</p>
					) : null}
					<ConfirmDialog
						open={confirmingDelete}
						onOpenChange={setConfirmingDelete}
						title={t('account.deleteConfirmTitle')}
						description={t('account.deleteConfirmDescription')}
						confirmLabel={t('account.deleteConfirmCta')}
						cancelLabel={t('account.deleteCancel')}
						onConfirm={handleDelete}
						variant="destructive"
					/>
				</ConsoleCard>
			) : null}
		</>
	)
}
