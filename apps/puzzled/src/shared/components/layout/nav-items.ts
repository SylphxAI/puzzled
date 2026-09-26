import {
	CalendarDays,
	ChartNoAxesColumn,
	CircleUserRound,
	LayoutGrid,
	LifeBuoy,
	Sparkles,
	Sun,
	Trophy,
} from 'lucide-react'
import type { ComponentType } from 'react'

export type NavItem = {
	href: string
	/** Translation key inside the `nav` namespace. */
	labelKey: string
	icon: ComponentType<{
		className?: string
		strokeWidth?: number
		'aria-hidden'?: boolean | 'true' | 'false'
	}>
	/** A tab in the phone tab bar. */
	showInBottomNav?: boolean
	/** Shown in the desktop top bar. Account surfaces stay in the account menu. */
	showInTopNav?: boolean
}

/**
 * One navigation model for every shell surface (top bar, phone tab bar,
 * menu sheet). It follows the player's day: today's puzzles, the catalogue,
 * past days, their record, and their account.
 */
export const NAV_ITEMS: readonly NavItem[] = [
	{ href: '/', labelKey: 'today', icon: Sun, showInBottomNav: true, showInTopNav: true },
	{
		href: '/games',
		labelKey: 'games',
		icon: LayoutGrid,
		showInBottomNav: true,
		showInTopNav: true,
	},
	{
		href: '/archive',
		labelKey: 'archive',
		icon: CalendarDays,
		showInBottomNav: true,
		showInTopNav: true,
	},
	{
		href: '/stats',
		labelKey: 'stats',
		icon: ChartNoAxesColumn,
		showInBottomNav: true,
		showInTopNav: true,
	},
	{ href: '/profile', labelKey: 'account', icon: CircleUserRound, showInBottomNav: true },
] as const

/** Secondary destinations: the menu sheet and the footer, never a tab. */
export const SECONDARY_NAV_ITEMS: readonly NavItem[] = [
	{ href: '/pricing', labelKey: 'plus', icon: Sparkles },
	{ href: '/leaderboard', labelKey: 'leaderboard', icon: Trophy },
	{ href: '/support', labelKey: 'support', icon: LifeBuoy },
] as const

export const SUPPORT_NAV_ITEM: NavItem = SECONDARY_NAV_ITEMS[2] as NavItem

/** True when `pathname` is inside `href` (with `/` matching only the root). */
export function isActivePath(pathname: string | null, href: string): boolean {
	if (!pathname) return false
	if (href === '/') return pathname === '/'
	return pathname === href || pathname.startsWith(`${href}/`)
}
