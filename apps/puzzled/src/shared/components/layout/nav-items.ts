import { BarChart3, Gamepad2, Home, Sparkles, Tag, Trophy, User } from 'lucide-react'
import type { ComponentType } from 'react'

export type NavItem = {
	href: string
	/** Translation key inside the `nav` namespace. */
	labelKey: string
	icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>
	/** Highlighted in the mobile bottom bar. */
	showInBottomNav?: boolean
	/** Shown in the desktop top bar. Account-only surfaces stay out of it. */
	showInTopNav?: boolean
}

/**
 * One navigation model for every shell surface (top nav, mobile sheet, bottom
 * bar). Order is the reading order a guest sees: play first, deepen later.
 */
export const NAV_ITEMS: readonly NavItem[] = [
	{ href: '/', labelKey: 'home', icon: Home, showInBottomNav: true, showInTopNav: true },
	{ href: '/games', labelKey: 'games', icon: Gamepad2, showInBottomNav: true, showInTopNav: true },
	{ href: '/stats', labelKey: 'stats', icon: BarChart3, showInBottomNav: true, showInTopNav: true },
	{ href: '/leaderboard', labelKey: 'leaderboard', icon: Trophy, showInTopNav: true },
	{ href: '/pricing', labelKey: 'pricing', icon: Sparkles, showInTopNav: true },
	{ href: '/profile', labelKey: 'profile', icon: User, showInBottomNav: true },
] as const

export const SUPPORT_NAV_ITEM: NavItem = {
	href: '/support',
	labelKey: 'support',
	icon: Tag,
}

/** True when `pathname` is inside `href` (with `/` matching only the root). */
export function isActivePath(pathname: string | null, href: string): boolean {
	if (!pathname) return false
	if (href === '/') return pathname === '/'
	return pathname === href || pathname.startsWith(`${href}/`)
}
