'use client'

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@sylphx/ui'
import { LogOut, Settings } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ReactElement } from 'react'
import { Link } from '@/lib/i18n/routing'

/**
 * The signed-in account menu. Kept out of `user-menu.tsx` so the dropdown
 * runtime is fetched when the menu is first reached for, not with every page.
 */
export default function UserMenuDropdown({
	trigger,
	name,
	email,
	menuWidth,
	onSignOut,
}: {
	trigger: ReactElement
	name?: string | null
	email?: string | null
	menuWidth: string
	onSignOut: () => void
}) {
	const t = useTranslations()
	return (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className={menuWidth}>
				<DropdownMenuLabel className="font-normal">
					<div className="flex flex-col space-y-1">
						<p className="truncate text-sm font-medium">{name}</p>
						<p className="truncate text-xs text-muted-foreground">{email}</p>
					</div>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem asChild>
						<Link href="/settings" className="flex items-center gap-2">
							<Settings className="h-4 w-4" />
							{t('common.settings')}
						</Link>
					</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem destructive onClick={onSignOut}>
					<LogOut className="mr-2 h-4 w-4" />
					{t('common.signOut')}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
