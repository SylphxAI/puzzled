'use client'

import { Button } from '@sylphx/ui'
import { ExternalLink } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ConsoleCard, ConsoleHeader } from '@/features/console/components/console-chrome'
import { Link } from '@/lib/i18n/routing'
import { useSafeUser } from '@/lib/identity/react'

/** The account centre that owns the display name and avatar. */
const PROFILE_CENTRE_URL = 'https://platform.sylphx.com/settings/profile'

/**
 * Profile section.
 *
 * The name and avatar on a player card come from the account authority; this
 * surface states what they are, shows where to change them, and links to the
 * visibility control that decides whether they appear on boards.
 */
export function ProfileSettingsContent() {
	const t = useTranslations('settings')
	const { user, isLoading } = useSafeUser()
	const displayName = user?.name?.trim() || t('playerCard.nameFallback')

	return (
		<>
			<ConsoleHeader
				headingLevel={2}
				title={t('profile.title')}
				description={t('profile.description')}
			/>

			<ConsoleCard
				title={t('profile.identityTitle')}
				description={t('profile.identityDescription')}
				actions={
					<Button asChild variant="outline" className="min-h-11 gap-2">
						<a href={PROFILE_CENTRE_URL} target="_blank" rel="noopener noreferrer">
							{t('profile.editCta')}
							<ExternalLink className="h-4 w-4" aria-hidden="true" />
						</a>
					</Button>
				}
			>
				{isLoading ? (
					<p className="text-sm text-muted-foreground">{t('account.loading')}</p>
				) : (
					<dl className="space-y-2 text-sm">
						<div className="flex flex-wrap items-baseline gap-x-2">
							<dt className="text-muted-foreground">{t('profile.displayName')}</dt>
							<dd className="font-semibold">{displayName}</dd>
						</div>
						{user?.email ? (
							<div className="flex flex-wrap items-baseline gap-x-2">
								<dt className="text-muted-foreground">{t('profile.email')}</dt>
								<dd className="font-semibold">{user.email}</dd>
							</div>
						) : null}
					</dl>
				)}
				<p className="mt-3 text-xs leading-relaxed text-muted-foreground">
					{t('profile.identityNote')}
				</p>
			</ConsoleCard>

			<ConsoleCard
				title={t('profile.visibilityTitle')}
				description={t('profile.visibilityDescription')}
			>
				<Link
					href="/settings/privacy"
					className="inline-flex min-h-11 items-center rounded-xl border border-border bg-background px-4 text-sm font-semibold transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					{t('profile.visibilityCta')}
				</Link>
			</ConsoleCard>

			<ConsoleCard title={t('profile.boardsTitle')} description={t('profile.boardsDescription')}>
				<Link
					href="/leaderboard"
					className="inline-flex min-h-11 items-center rounded-xl border border-border bg-background px-4 text-sm font-semibold transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					{t('profile.boardsCta')}
				</Link>
			</ConsoleCard>
		</>
	)
}
